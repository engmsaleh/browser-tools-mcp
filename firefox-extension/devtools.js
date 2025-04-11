// devtools.js - Firefox compatible version

// Store settings with defaults
let settings = {
  logLimit: 50,
  queryLimit: 30000,
  stringSizeLimit: 500,
  maxLogSize: 20000,
  showRequestHeaders: false,
  showResponseHeaders: false,
  screenshotPath: "",
  serverHost: "localhost",
  serverPort: 3025,
  allowAutoPaste: false,
};

// Keep track of debugger state
let isDebuggerAttached = false;
let attachDebuggerRetries = 0;
const MAX_ATTACH_RETRIES = 3;
const ATTACH_RETRY_DELAY = 1000; // 1 second

// Storage for logs
const consoleLogs = [];
const consoleErrors = [];
const networkRequests = [];
const networkErrors = [];

// Get the current tab ID - Firefox uses browser.devtools
const currentTabId = isFirefox 
  ? browser.devtools.inspectedWindow.tabId 
  : chrome.devtools.inspectedWindow.tabId;

// WebSocket connection
let ws = null;
let wsReconnectTimeout = null;
let intentionalClosure = false;

/**
 * Load saved settings on startup
 */
async function loadSettings() {
  try {
    const result = await browserAPI.storage.local.get(["browserConnectorSettings"]);
    if (result.browserConnectorSettings) {
      settings = { ...settings, ...result.browserConnectorSettings };
      console.log("Loaded settings:", settings);
    }
  } catch (error) {
    console.error("Error loading settings:", browserAPI.getErrorMessage(error));
  }
}

/**
 * Initialize the DevTools panel
 */
async function initDevToolsPanel() {
  console.log("Initializing DevTools panel for tab:", currentTabId);
  
  // Load settings
  await loadSettings();
  
  // Create the panel UI
  createPanel();
  
  // Try to attach the debugger
  await attachDebugger();
  
  // Set up WebSocket connection to the server
  setupWebSocket();
  
  // Request the current URL
  updateCurrentUrl();
  
  // Add listener for page navigation (refreshes)
  if (isFirefox) {
    browser.devtools.network.onNavigated.addListener(handleNavigated);
  } else {
    chrome.devtools.network.onNavigated.addListener(handleNavigated);
  }
}

/**
 * Create the DevTools panel
 */
function createPanel() {
  const panelName = "BrowserTools MCP";
  
  // Firefox uses browser.devtools.panels
  if (isFirefox) {
    browser.devtools.panels.create(
      panelName,
      "", // No icon path for now
      "panel.html"
    ).then(panel => {
      console.log("Panel created successfully");
    }).catch(error => {
      console.error("Error creating panel:", error);
    });
  } else {
    // Chrome version
    chrome.devtools.panels.create(
      panelName,
      "", // No icon path for now 
      "panel.html",
      panel => {
        console.log("Panel created successfully");
      }
    );
  }
}

/**
 * Attempt to attach the debugger
 */
async function attachDebugger() {
  console.log("Attempting to attach debugger to tab:", currentTabId);
  
  if (isDebuggerAttached) {
    console.log("Debugger is already attached");
    return;
  }
  
  try {
    await performAttach();
    isDebuggerAttached = true;
    attachDebuggerRetries = 0;
    console.log("Debugger attached successfully");
  } catch (error) {
    console.error("Error attaching debugger:", browserAPI.getErrorMessage(error));
    
    // Retry logic
    attachDebuggerRetries++;
    if (attachDebuggerRetries <= MAX_ATTACH_RETRIES) {
      console.log(`Retrying attach (${attachDebuggerRetries}/${MAX_ATTACH_RETRIES})...`);
      setTimeout(attachDebugger, ATTACH_RETRY_DELAY);
    } else {
      console.error("Max attach retries reached");
    }
  }
}

/**
 * Actual attach implementation - different between Firefox and Chrome
 */
async function performAttach() {
  // In Firefox, we use the browser.debugger API
  // This is a significant difference from Chrome's implementation
  if (isFirefox) {
    try {
      await browser.debugger.attach({ tabId: currentTabId }, "1.3");
      
      // Enable necessary debugger features
      await browser.debugger.sendCommand(
        { tabId: currentTabId },
        "Network.enable"
      );
      
      await browser.debugger.sendCommand(
        { tabId: currentTabId },
        "Console.enable"
      );
      
      // Add event listeners for console and network events
      browser.debugger.onEvent.addListener(onDebuggerEvent);
      
      return true;
    } catch (error) {
      console.error("Firefox debugger attach failed:", error);
      throw error;
    }
  } else {
    // Chrome implementation
    return new Promise((resolve, reject) => {
      try {
        chrome.debugger.attach({ tabId: currentTabId }, "1.3", () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          
          // Enable necessary debugger features
          chrome.debugger.sendCommand(
            { tabId: currentTabId },
            "Network.enable",
            {},
            () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
              }
              
              chrome.debugger.sendCommand(
                { tabId: currentTabId },
                "Console.enable",
                {},
                () => {
                  if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                  }
                  
                  // Add event listeners for Chrome
                  chrome.debugger.onEvent.addListener(onDebuggerEvent);
                  resolve();
                }
              );
            }
          );
        });
      } catch (e) {
        reject(e);
      }
    });
  }
}

/**
 * Handle debugger events (console messages, network events)
 */
function onDebuggerEvent(debuggeeId, message, params) {
  // Only process events for our tab
  if (debuggeeId.tabId !== currentTabId) {
    return;
  }
  
  // Log for debugging
  // console.log(`Debugger event: ${message}`, params);
  
  try {
    // Handle console events
    if (message === "Console.messageAdded") {
      handleConsoleMessage(params.message);
    }
    
    // Handle network events
    if (message.startsWith("Network.")) {
      handleNetworkEvent(message, params);
    }
  } catch (error) {
    console.error("Error handling debugger event:", error);
  }
}

/**
 * Handle console messages
 */
function handleConsoleMessage(message) {
  try {
    // Format the message similar to Chrome's format for compatibility with the server
    let formattedText = message.text || "";
    
    // Add arguments if available
    if (message.arguments && message.arguments.length > 0) {
      try {
        formattedText = message.arguments
          .map(arg => {
            // Handle different types of arguments similar to Chrome
            if (typeof arg === 'string') {
              return arg;
            } else if (arg && typeof arg === 'object') {
              return JSON.stringify(arg);
            } else {
              return String(arg);
            }
          })
          .join(" ");
      } catch (e) {
        console.error("Error processing console arguments:", e);
      }
    }
    
    // Create formatted log entry
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: message.level === "error" ? "console-error" : "console-log",
      message: formattedText, // Use server-expected field name
      level: message.level,
      source: message.source || "console",
      url: message.url,
      line: message.line,
      column: message.column,
      stackTrace: message.stackTrace,
    };
    
    // Process the log based on level
    switch (message.level) {
      case "error":
        // Add to errors array with limit
        if (consoleErrors.length >= settings.logLimit) {
          consoleErrors.shift();
        }
        consoleErrors.push(logEntry);
        break;
        
      default:
        // Add to regular logs array with limit
        if (consoleLogs.length >= settings.logLimit) {
          consoleLogs.shift();
        }
        consoleLogs.push(logEntry);
        break;
    }
    
    // Send to server via WebSocket if connected
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: message.level === "error" ? "console-error" : "console-log",
        data: logEntry
      }));
    }
  } catch (error) {
    console.error("Error handling console message:", error);
  }
}

// Network request storage - maps requestId to request data
const networkRequestsMap = new Map();

/**
 * Handle network events
 */
function handleNetworkEvent(eventName, params) {
  try {
    switch (eventName) {
      case "Network.requestWillBeSent":
        handleNetworkRequest(params);
        break;
        
      case "Network.responseReceived":
        handleNetworkResponse(params);
        break;
        
      case "Network.loadingFailed":
        handleNetworkFailure(params);
        break;
        
      case "Network.loadingFinished":
        finalizeNetworkRequest(params);
        // After finishing, fetch the response body
        getResponseBody(params.requestId);
        break;
    }
  } catch (error) {
    console.error(`Error handling network event ${eventName}:`, error);
  }
}

/**
 * Handle network request
 */
function handleNetworkRequest(params) {
  try {
    // Basic request info
    const requestData = {
      requestId: params.requestId,
      url: params.request.url,
      method: params.request.method,
      timestamp: params.timestamp || new Date().getTime(),
      type: params.type,
      initiator: params.initiator,
      headers: settings.showRequestHeaders ? params.request.headers : undefined,
      status: "pending",
      // Add request body if available
      requestBody: params.request.postData || "",
    };
    
    // Store in map for updating later
    networkRequestsMap.set(params.requestId, requestData);
    
    // Send to server via WebSocket if connected
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "network_request",
        data: requestData
      }));
    }
  } catch (error) {
    console.error("Error handling network request:", error);
  }
}

/**
 * Get response body for a network request
 */
async function getResponseBody(requestId) {
  try {
    const requestData = networkRequestsMap.get(requestId);
    if (!requestData) {
      return;
    }

    // Only attempt to get body for XHR/fetch requests or if it's JSON/text content
    if (isXhrOrFetchRequest(requestData) || isTextualContent(requestData)) {
      const result = await browser.debugger.sendCommand(
        { tabId: currentTabId },
        "Network.getResponseBody",
        { requestId: requestId }
      );
      
      if (result && (result.body !== undefined)) {
        // Update the request data with response body
        requestData.responseBody = result.body;
        
        // Send updated data to server
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "network-request", // Use Chrome format type
            data: formatRequestForServer(requestData)
          }));
        }
      }
    }
  } catch (error) {
    console.error(`Error getting response body for request ${requestId}:`, error);
  }
}

/**
 * Format request data to match Chrome's format for server compatibility
 */
function formatRequestForServer(requestData) {
  return {
    type: "network-request", // Chrome format
    url: requestData.url,
    method: requestData.method,
    status: requestData.status,
    requestHeaders: requestData.headers,
    responseHeaders: requestData.responseHeaders,
    requestBody: requestData.requestBody || "",
    responseBody: requestData.responseBody || "",
    timestamp: requestData.timestamp
  };
}

/**
 * Check if the request is an XHR or fetch request based on its properties
 */
function isXhrOrFetchRequest(requestData) {
  // Check for XHR/fetch type indicators
  if (requestData.type === 'xhr' || requestData.type === 'fetch') {
    return true;
  }
  
  // Check headers for XHR indicator
  if (requestData.headers && 
     (requestData.headers['X-Requested-With'] === 'XMLHttpRequest' ||
      requestData.headers['Accept'] === 'application/json')) {
    return true;
  }
  
  return false;
}

/**
 * Check if the content type is textual (JSON, HTML, text)
 */
function isTextualContent(requestData) {
  if (!requestData.mimeType) {
    return false;
  }
  
  const textualTypes = [
    'application/json',
    'text/plain',
    'text/html',
    'text/javascript',
    'application/javascript',
    'application/xml',
    'text/xml',
    'application/x-www-form-urlencoded'
  ];
  
  return textualTypes.some(type => requestData.mimeType.includes(type));
}

/**
 * Handle network response
 */
function handleNetworkResponse(params) {
  try {
    const requestId = params.requestId;
    const requestData = networkRequestsMap.get(requestId);
    
    if (!requestData) {
      return;
    }
    
    // Update with response info
    requestData.status = params.response.status;
    requestData.statusText = params.response.statusText;
    requestData.mimeType = params.response.mimeType;
    requestData.responseTimestamp = params.timestamp || new Date().getTime();
    requestData.responseHeaders = settings.showResponseHeaders ? params.response.headers : undefined;
    
    // Update in map
    networkRequestsMap.set(requestId, requestData);
    
    // Add to completed requests if status indicates an error
    if (params.response.status >= 400) {
      // Add to network errors array with limit
      if (networkErrors.length >= settings.logLimit) {
        networkErrors.shift();
      }
      networkErrors.push(requestData);
      
      // Send error to server
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "network_error",
          data: requestData
        }));
      }
    }
  } catch (error) {
    console.error("Error handling network response:", error);
  }
}

/**
 * Handle network request failure
 */
function handleNetworkFailure(params) {
  try {
    const requestId = params.requestId;
    const requestData = networkRequestsMap.get(requestId);
    
    if (!requestData) {
      return;
    }
    
    // Update with failure info
    requestData.status = "failed";
    requestData.errorText = params.errorText;
    requestData.canceled = params.canceled;
    requestData.blockedReason = params.blockedReason;
    
    // Update in map
    networkRequestsMap.set(requestId, requestData);
    
    // Add to network errors
    if (networkErrors.length >= settings.logLimit) {
      networkErrors.shift();
    }
    networkErrors.push(requestData);
    
    // Send error to server
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "network_error",
        data: requestData
      }));
    }
  } catch (error) {
    console.error("Error handling network failure:", error);
  }
}

/**
 * Finalize network request when loading is finished
 */
function finalizeNetworkRequest(params) {
  try {
    const requestId = params.requestId;
    const requestData = networkRequestsMap.get(requestId);
    
    if (!requestData) {
      return;
    }
    
    // Update with completion info
    requestData.encodedDataLength = params.encodedDataLength;
    requestData.loadingFinished = true;
    
    // Add to completed network requests
    if (networkRequests.length >= settings.logLimit) {
      networkRequests.shift();
    }
    networkRequests.push(requestData);
    
    // Send completed request to server
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "network_request_complete",
        data: requestData
      }));
    }
    
    // Clean up the map to avoid memory leaks
    networkRequestsMap.delete(requestId);
  } catch (error) {
    console.error("Error finalizing network request:", error);
  }
}

/**
 * Set up WebSocket connection to the server
 */
async function setupWebSocket() {
  // Close existing connection if any
  if (ws) {
    try {
      ws.close();
    } catch (e) {
      console.error("Error closing existing WebSocket:", e);
    }
    ws = null;
  }
  
  // Clear any reconnect timeouts
  if (wsReconnectTimeout) {
    clearTimeout(wsReconnectTimeout);
    wsReconnectTimeout = null;
  }
  
  const wsUrl = `ws://${settings.serverHost}:${settings.serverPort}/extension`;
  console.log("Connecting to WebSocket:", wsUrl);
  
  try {
    ws = new WebSocket(wsUrl);
    
    ws.onopen = async () => {
      console.log("WebSocket connected");
      
      // Notify background.js about connection
      await browserAPI.runtime.sendMessage({
        type: "WEBSOCKET_CONNECTED",
        serverHost: settings.serverHost,
        serverPort: settings.serverPort
      });
      
      // Send initial data
      updateCurrentUrl();
      
      // Send any existing logs
      sendInitialData();
    };
    
    ws.onclose = (event) => {
      console.log(`WebSocket closed: ${event.code} ${event.reason}`);
      
      // Auto-reconnect unless it was intentionally closed
      if (!intentionalClosure) {
        wsReconnectTimeout = setTimeout(setupWebSocket, 5000);
      }
    };
    
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
    
    ws.onmessage = (event) => {
      try {
        handleWebSocketMessage(event.data);
      } catch (e) {
        console.error("Error handling WebSocket message:", e);
      }
    };
  } catch (error) {
    console.error("Error setting up WebSocket:", error);
    
    // Schedule reconnect attempt
    wsReconnectTimeout = setTimeout(setupWebSocket, 5000);
  }
}

/**
 * Send initial data to the server
 */
function sendInitialData() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  
  try {
    // Send console logs
    if (consoleLogs.length > 0) {
      ws.send(JSON.stringify({
        type: "initial_console_logs",
        data: consoleLogs.slice(-settings.logLimit)
      }));
    }
    
    // Send console errors
    if (consoleErrors.length > 0) {
      ws.send(JSON.stringify({
        type: "initial_console_errors",
        data: consoleErrors.slice(-settings.logLimit)
      }));
    }
    
    // Send network requests
    if (networkRequests.length > 0) {
      ws.send(JSON.stringify({
        type: "initial_network_requests",
        data: networkRequests.slice(-settings.logLimit)
      }));
    }
    
    // Send network errors
    if (networkErrors.length > 0) {
      ws.send(JSON.stringify({
        type: "initial_network_errors",
        data: networkErrors.slice(-settings.logLimit)
      }));
    }
  } catch (error) {
    console.error("Error sending initial data:", error);
  }
}

/**
 * Handle messages from the WebSocket server
 */
function handleWebSocketMessage(data) {
  try {
    const message = JSON.parse(data);
    console.log("Received WebSocket message:", message);
    
    // Handle specific message types
    switch (message.type) {
      case "get_logs":
        sendLogsToServer();
        break;
        
      case "get_console_logs":
        sendConsoleLogsToServer();
        break;
        
      case "get_console_errors":
        sendConsoleErrorsToServer();
        break;
        
      case "get_network_logs":
        sendNetworkLogsToServer();
        break;
        
      case "get_network_errors":
        sendNetworkErrorsToServer();
        break;
        
      case "take_screenshot":
        takeScreenshot();
        break;
        
      case "get_selected_element":
        getSelectedElement();
        break;
        
      case "wipe_logs":
        wipeLogs();
        break;
        
      case "ping":
        // Respond to ping
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "pong" }));
        }
        break;
        
      case "heartbeat":
        // Respond to heartbeat
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "heartbeat-response" }));
        }
        break;
        
      case "server-shutdown":
        // Server is shutting down, close connection gracefully
        console.log("Received server shutdown signal");
        intentionalClosure = true;
        if (ws) {
          ws.close(1000, "Server shutting down");
        }
        break;
    }
  } catch (e) {
    console.error("Error parsing WebSocket message:", e);
  }
}

/**
 * Send console logs to the server
 */
function sendConsoleLogsToServer() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  
  try {
    ws.send(JSON.stringify({
      type: "console_logs",
      data: consoleLogs.slice(-settings.logLimit).map(formatLogForServer)
    }));
  } catch (error) {
    console.error("Error sending console logs to server:", error);
  }
}

/**
 * Send console errors to the server
 */
function sendConsoleErrorsToServer() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  
  try {
    ws.send(JSON.stringify({
      type: "console_errors",
      data: consoleErrors.slice(-settings.logLimit).map(formatLogForServer)
    }));
  } catch (error) {
    console.error("Error sending console errors to server:", error);
  }
}

/**
 * Send network logs to the server
 */
function sendNetworkLogsToServer() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  
  try {
    ws.send(JSON.stringify({
      type: "network_logs",
      data: networkRequests.slice(-settings.logLimit).map(formatRequestForServer)
    }));
  } catch (error) {
    console.error("Error sending network logs to server:", error);
  }
}

/**
 * Send network errors to the server
 */
function sendNetworkErrorsToServer() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  
  try {
    ws.send(JSON.stringify({
      type: "network_errors",
      data: networkErrors.slice(-settings.logLimit).map(formatRequestForServer)
    }));
  } catch (error) {
    console.error("Error sending network errors to server:", error);
  }
}

/**
 * Format console log for server (to match Chrome format)
 */
function formatLogForServer(log) {
  return {
    type: log.type === "error" ? "console-error" : "console-log",
    message: log.text || log.message || "",
    level: log.level || "info",
    timestamp: log.timestamp || Date.now(),
    source: log.source,
    url: log.url,
    line: log.line,
    column: log.column
  };
}

/**
 * Take a screenshot and send it to the server
 */
async function takeScreenshot() {
  try {
    console.log("Taking screenshot of tab:", currentTabId);
    
    // Send request to background script to take screenshot
    const response = await browserAPI.runtime.sendMessage({
      type: "TAKE_SCREENSHOT",
      tabId: currentTabId
    });
    
    if (response && response.success) {
      console.log("Screenshot taken successfully");
    } else {
      console.error("Error taking screenshot:", response?.error || "Unknown error");
    }
  } catch (error) {
    console.error("Error taking screenshot:", browserAPI.getErrorMessage(error));
  }
}

/**
 * Get the currently selected element in the inspector
 */
async function getSelectedElement() {
  try {
    // This is more complex in Firefox. We need to use the inspector API
    // or send a command to get the selected element. For simplicity,
    // we'll just notify that this feature is not fully supported yet.
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "selected_element",
        data: {
          message: "Element selection not fully implemented in Firefox extension yet"
        }
      }));
    }
  } catch (error) {
    console.error("Error getting selected element:", error);
  }
}

/**
 * Send current logs to the server
 */
function sendLogsToServer() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  
  try {
    ws.send(JSON.stringify({
      type: "current_logs",
      data: {
        consoleLogs: consoleLogs.slice(-settings.logLimit),
        consoleErrors: consoleErrors.slice(-settings.logLimit),
        networkRequests: networkRequests.slice(-settings.logLimit),
        networkErrors: networkErrors.slice(-settings.logLimit)
      }
    }));
  } catch (error) {
    console.error("Error sending logs to server:", error);
  }
}

/**
 * Wipe all logs
 */
function wipeLogs() {
  // Clear all log arrays
  consoleLogs.length = 0;
  consoleErrors.length = 0;
  networkRequests.length = 0;
  networkErrors.length = 0;
  networkRequestsMap.clear();
  
  console.log("All logs wiped");
}

/**
 * Get and update the current URL
 */
async function updateCurrentUrl() {
  try {
    // Send message to background script to get URL
    const response = await browserAPI.runtime.sendMessage({
      type: "GET_CURRENT_URL",
      tabId: currentTabId
    });
    
    if (response && response.success && response.url) {
      console.log("Current URL:", response.url);
      
      // Send to server if WebSocket is connected
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "url_update",
          tabId: currentTabId,
          url: response.url
        }));
      }
    } else {
      console.error("Error getting current URL:", response?.error || "Unknown error");
    }
  } catch (error) {
    console.error("Error updating current URL:", browserAPI.getErrorMessage(error));
  }
}

/**
 * Handle page navigation events (refreshes)
 */
function handleNavigated(url) {
  console.log("Page navigated/refreshed to:", url);
  
  // Wipe logs on navigation
  wipeLogs();
  
  // Send the new URL to the server
  if (ws && ws.readyState === WebSocket.OPEN && url) {
    console.log("Sending page-navigated event with URL:", url);
    ws.send(JSON.stringify({
      type: "page-navigated",
      url: url,
      tabId: currentTabId,
      timestamp: Date.now()
    }));
  }
  
  // Update current URL
  updateCurrentUrl();
  
  // Re-attach debugger if needed
  if (!isDebuggerAttached) {
    console.log("Re-attaching debugger after navigation");
    attachDebugger();
  }
}

/**
 * Detach the debugger
 */
async function detachDebugger() {
  if (!isDebuggerAttached) {
    return;
  }
  
  console.log("Detaching debugger from tab:", currentTabId);
  
  try {
    if (isFirefox) {
      // Remove event listener first
      browser.debugger.onEvent.removeListener(onDebuggerEvent);
      
      // Then detach
      await browser.debugger.detach({ tabId: currentTabId });
    } else {
      // Remove event listener first
      chrome.debugger.onEvent.removeListener(onDebuggerEvent);
      
      // Then detach
      await new Promise((resolve, reject) => {
        chrome.debugger.detach({ tabId: currentTabId }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    }
    
    isDebuggerAttached = false;
    console.log("Debugger detached successfully");
  } catch (error) {
    console.error("Error detaching debugger:", browserAPI.getErrorMessage(error));
  }
}

// Initialize the DevTools panel
initDevToolsPanel(); 