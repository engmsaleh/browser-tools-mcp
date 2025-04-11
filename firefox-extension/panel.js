// panel.js - Refactored for Content Script Console & HAR Network

// Debugger and WebSocket state
let ws = null;
let wsReconnectTimeout = null;
let intentionalClosure = false;

// Log storage (moved here from devtools.js)
const consoleLogs = [];
const consoleErrors = [];
const networkLogEntries = []; // Changed from Map to Array for HAR

// Store settings
let settings = {
  logLimit: 50,
  queryLimit: 30000,
  stringSizeLimit: 500,
  showRequestHeaders: false,
  showResponseHeaders: false,
  maxLogSize: 20000,
  screenshotPath: "",
  serverHost: "localhost",
  serverPort: 3025,
  allowAutoPaste: false,
};

// Track connection status
let serverConnected = false;
let reconnectAttemptTimeout = null;
let isDiscoveryInProgress = false;
let discoveryController = null;
let connectionBanner = null;
let statusIcon = null;
let statusText = null;
let connectionStatusDiv = null;

// Get the current tab ID
// This needs to run within the DevTools panel context
let currentTabId = null;
function getCurrentTabId() {
  try {
    // Use the devtools API available in panel context
    currentTabId = browser.devtools.inspectedWindow.tabId;
    console.log("Panel: Inspected tab ID:", currentTabId);
  } catch (e) {
    console.error("Panel: Failed to get inspectedWindow.tabId", e);
    // Handle error, maybe show a message in the panel?
  }
}

/**
 * Initialize the panel
 */
async function initPanel() {
  console.log("Panel: Initializing...");
  
  getCurrentTabId();
  if (!currentTabId) {
     console.error("Panel: Could not determine inspected tab ID. Aborting initialization.");
     return;
  }
  
  await loadSettings();
  setupEventListeners();
  createConnectionBanner();
  updateUIFromSettings();

  // Set up WebSocket connection (can happen earlier now)
  setupWebSocket(); 
  
  // Discover server
  discoverServer(true);

  // Listen for Network HAR entries
  try {
    browser.devtools.network.onRequestFinished.addListener(handleNetworkHAR);
    console.log("Panel: Added network HAR listener.");
  } catch (e) {
    console.error("Panel: Failed to add network listener", e);
  }

  // Listen for messages from the BACKGROUND script (forwarded console logs)
  try {
    browser.runtime.onMessage.addListener(handleBackgroundMessage);
    console.log("Panel: Added background message listener.");
  } catch (e) {
    console.error("Panel: Failed to add runtime message listener", e);
  }
}

/**
 * Load saved settings
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
 * Save settings
 */
async function saveSettings() {
  try {
    await browserAPI.storage.local.set({
      browserConnectorSettings: settings
    });
    console.log("Settings saved");
    
    // Notify devtools.js about the settings change
    await browserAPI.runtime.sendMessage({
      type: "SETTINGS_UPDATED",
      settings: settings
    });
  } catch (error) {
    console.error("Error saving settings:", browserAPI.getErrorMessage(error));
  }
}

/**
 * Update UI elements from settings
 */
function updateUIFromSettings() {
  // Server connection settings
  document.getElementById("server-host").value = settings.serverHost || "";
  document.getElementById("server-port").value = settings.serverPort || 3025;
  
  // Screenshot settings
  document.getElementById("screenshot-path").value = settings.screenshotPath || "";
  document.getElementById("allow-auto-paste").checked = settings.allowAutoPaste || false;
  
  // Advanced settings
  document.getElementById("log-limit").value = settings.logLimit || 50;
  document.getElementById("query-limit").value = settings.queryLimit || 30000;
  document.getElementById("string-size-limit").value = settings.stringSizeLimit || 500;
  document.getElementById("max-log-size").value = settings.maxLogSize || 20000;
  document.getElementById("show-request-headers").checked = settings.showRequestHeaders || false;
  document.getElementById("show-response-headers").checked = settings.showResponseHeaders || false;
}

/**
 * Set up UI event listeners
 */
function setupEventListeners() {
  // Capture screenshot button
  document.getElementById("capture-screenshot").addEventListener("click", captureScreenshot);
  
  // Wipe logs button
  document.getElementById("wipe-logs").addEventListener("click", wipeLogs);
  
  // Test connection button
  document.getElementById("test-connection").addEventListener("click", () => {
    const host = document.getElementById("server-host").value;
    const port = parseInt(document.getElementById("server-port").value, 10);
    testConnection(host, port);
  });
  
  // Discover server button
  document.getElementById("discover-server").addEventListener("click", () => {
    discoverServer(false);
  });
  
  // Server host input
  document.getElementById("server-host").addEventListener("change", (e) => {
    settings.serverHost = e.target.value;
    saveSettings();
  });
  
  // Server port input
  document.getElementById("server-port").addEventListener("change", (e) => {
    settings.serverPort = parseInt(e.target.value, 10);
    saveSettings();
  });
  
  // Screenshot path input
  document.getElementById("screenshot-path").addEventListener("change", (e) => {
    settings.screenshotPath = e.target.value;
    saveSettings();
  });
  
  // Auto-paste checkbox
  document.getElementById("allow-auto-paste").addEventListener("change", (e) => {
    settings.allowAutoPaste = e.target.checked;
    saveSettings();
  });
  
  // Advanced settings toggles
  document.getElementById("advanced-settings-header").addEventListener("click", () => {
    const content = document.getElementById("advanced-settings-content");
    const chevron = document.querySelector(".chevron");
    
    if (content.classList.contains("visible")) {
      content.classList.remove("visible");
      chevron.classList.remove("open");
    } else {
      content.classList.add("visible");
      chevron.classList.add("open");
    }
  });
  
  // Advanced settings inputs
  document.getElementById("log-limit").addEventListener("change", (e) => {
    settings.logLimit = parseInt(e.target.value, 10);
    saveSettings();
  });
  
  document.getElementById("query-limit").addEventListener("change", (e) => {
    settings.queryLimit = parseInt(e.target.value, 10);
    saveSettings();
  });
  
  document.getElementById("string-size-limit").addEventListener("change", (e) => {
    settings.stringSizeLimit = parseInt(e.target.value, 10);
    saveSettings();
  });
  
  document.getElementById("max-log-size").addEventListener("change", (e) => {
    settings.maxLogSize = parseInt(e.target.value, 10);
    saveSettings();
  });
  
  document.getElementById("show-request-headers").addEventListener("change", (e) => {
    settings.showRequestHeaders = e.target.checked;
    saveSettings();
  });
  
  document.getElementById("show-response-headers").addEventListener("change", (e) => {
    settings.showResponseHeaders = e.target.checked;
    saveSettings();
  });
}

/**
 * Create connection status banner
 */
function createConnectionBanner() {
  // Check if banner already exists
  if (document.getElementById("connection-banner")) {
    return;
  }
  
  // Create the banner
  const banner = document.createElement("div");
  banner.id = "connection-banner";
  banner.style.cssText = `
    padding: 6px 0px; 
    margin-bottom: 4px;
    width: 40%; 
    display: flex; 
    flex-direction: column;
    align-items: flex-start; 
    background-color:rgba(0,0,0,0);
    border-radius: 11px;
    font-size: 11px;
    font-weight: 500;
    color: #ffffff;
  `;
  
  // Create reconnect button
  const reconnectButton = document.createElement("button");
  reconnectButton.id = "banner-reconnect-btn";
  reconnectButton.textContent = "Reconnect";
  reconnectButton.style.cssText = `
    background-color: #333333;
    color: #ffffff;
    border: 1px solid #444444;
    border-radius: 3px;
    padding: 2px 8px;
    font-size: 10px;
    cursor: pointer;
    margin-bottom: 6px;
    align-self: flex-start;
    display: none;
    transition: background-color 0.2s;
  `;
  reconnectButton.addEventListener("click", () => {
    discoverServer(false);
  });
  banner.appendChild(reconnectButton);
  
  // Create status line
  const statusLine = document.createElement("div");
  statusLine.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
  `;
  
  // Create status indicator
  const indicator = document.createElement("span");
  indicator.className = "status-indicator status-disconnected";
  statusLine.appendChild(indicator);
  statusIcon = indicator;
  
  // Create status text
  const text = document.createElement("span");
  text.textContent = "Disconnected";
  statusLine.appendChild(text);
  statusText = text;
  
  banner.appendChild(statusLine);
  
  // Add to page
  document.body.insertBefore(banner, document.body.firstChild);
  connectionBanner = banner;
  
  // Initialize connection status div reference
  connectionStatusDiv = document.getElementById("connection-status");
}

/**
 * Update connection banner
 */
function updateConnectionBanner(connected, serverInfo) {
  if (!connectionBanner || !statusIcon || !statusText) {
    return;
  }
  
  // Update connected state
  serverConnected = connected;
  
  // Update reconnect button
  const reconnectButton = document.getElementById("banner-reconnect-btn");
  if (reconnectButton) {
    reconnectButton.style.display = connected ? "none" : "block";
  }
  
  // Update status indicator
  if (connected) {
    statusIcon.className = "status-indicator status-connected";
    
    if (serverInfo) {
      statusText.textContent = `Connected to ${serverInfo.name || "server"} on ${serverInfo.host || settings.serverHost}:${serverInfo.port || settings.serverPort}`;
    } else {
      statusText.textContent = `Connected to server on ${settings.serverHost}:${settings.serverPort}`;
    }
  } else {
    statusIcon.className = "status-indicator status-disconnected";
    statusText.textContent = "Disconnected";
    
    // If we were previously connected, schedule a reconnect attempt
    if (serverConnected) {
      scheduleReconnectAttempt();
    }
  }
}

/**
 * Schedule a reconnect attempt
 */
function scheduleReconnectAttempt() {
  // Clear any existing timeout
  if (reconnectAttemptTimeout) {
    clearTimeout(reconnectAttemptTimeout);
  }
  
  // Schedule a new attempt
  reconnectAttemptTimeout = setTimeout(() => {
    console.log("Attempting to reconnect...");
    discoverServer(false);
  }, 5000);
}

/**
 * Cancel ongoing discovery
 */
function cancelOngoingDiscovery() {
  if (isDiscoveryInProgress) {
    console.log("Cancelling ongoing server discovery");
    
    // Abort any ongoing fetch requests
    if (discoveryController) {
      discoveryController.abort();
      discoveryController = null;
    }
    
    isDiscoveryInProgress = false;
  }
  
  // Clear any scheduled reconnect attempts
  if (reconnectAttemptTimeout) {
    clearTimeout(reconnectAttemptTimeout);
    reconnectAttemptTimeout = null;
  }
}

/**
 * Discover server
 */
async function discoverServer(quietMode = false) {
  // Cancel any ongoing discovery
  cancelOngoingDiscovery();
  
  isDiscoveryInProgress = true;
  console.log("Starting server discovery...");
  
  // Update UI to show we're searching for the server
  if (!quietMode && connectionStatusDiv) {
    connectionStatusDiv.style.display = "block";
    if (statusIcon) statusIcon.className = "status-indicator";
    if (statusText) statusText.textContent = "Searching for server...";
  }
  
  // Common hosts to try
  const hosts = [settings.serverHost, "127.0.0.1", "localhost"];
  
  // Ports to try (start with default, then try fallback range)
  const defaultPort = settings.serverPort || 3025;
  const ports = [defaultPort];
  
  // Add additional ports (fallback range)
  for (let p = 3025; p <= 3035; p++) {
    if (p !== defaultPort) {
      ports.push(p);
    }
  }
  
  console.log(`Server discovery: Will try hosts: ${hosts.join(", ")}`);
  console.log(`Server discovery: Will try ports: ${ports.join(", ")}`);
  
  let serverFound = false;
  
  // Create an abort controller for timeouts
  discoveryController = new AbortController();
  
  // Set a longer global timeout for the whole discovery process
  const maxDiscoveryTime = setTimeout(() => {
    if (discoveryController) {
      console.log("Discovery timed out after 30 seconds");
      discoveryController.abort();
    }
  }, 30000);
  
  // Try to find the server
  for (const host of hosts) {
    if (serverFound || !discoveryController) break;
    
    for (const port of ports) {
      if (serverFound || !discoveryController) break;
      
      try {
        console.log(`Checking ${host}:${port}...`);
        
        // Use the identity endpoint for validation with a 5 second timeout per attempt
        const timeoutId = setTimeout(() => {
          if (discoveryController) {
            console.log(`Individual request to ${host}:${port} timed out`);
          }
        }, 5000);
        
        // Use the identity endpoint for validation
        const response = await fetch(`http://${host}:${port}/.identity`, {
          signal: discoveryController.signal,
          mode: 'cors',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        clearTimeout(timeoutId);
        
        console.log(`Response from ${host}:${port}: status ${response.status}`);
        
        if (response.ok) {
          const identity = await response.json();
          console.log(`Server identity from ${host}:${port}:`, identity);
          
          // Verify this is actually our server by checking the signature
          if (identity.signature === "mcp-browser-connector-24x7") {
            console.log(`Successfully found server at ${host}:${port}`);
            
            // Update settings with discovered connection
            settings.serverHost = host;
            settings.serverPort = port;
            await saveSettings();
            
            // Update UI
            document.getElementById("server-host").value = host;
            document.getElementById("server-port").value = port;
            
            // Update connection status
            serverFound = true;
            serverConnected = true;
            updateConnectionBanner(true, {
              name: identity.name || "Browser Tools Server",
              version: identity.version || "unknown",
              host: host,
              port: port
            });
            
            // Hide connection status dialog
            if (connectionStatusDiv) {
              connectionStatusDiv.style.display = "none";
            }
            
            // Notify the background script and DevTools panel
            console.log("Sending server validation success message");
            await browserAPI.runtime.sendMessage({
              type: "SERVER_VALIDATION_SUCCESS",
              serverHost: host,
              serverPort: port,
              serverInfo: identity
            });
            
            break;
          } else {
            console.log(`Server at ${host}:${port} has invalid signature: ${identity.signature}`);
          }
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log("Discovery operation was aborted");
          break; // Exit loop if discovery was aborted
        }
        
        // Otherwise just log and continue trying
        console.log(`Error checking ${host}:${port}: ${error.message}`);
      }
    }
  }
  
  // Clear the global timeout
  clearTimeout(maxDiscoveryTime);
  
  // Update UI if no server was found
  if (!serverFound && !quietMode) {
    console.error("No server found during discovery");
    serverConnected = false;
    updateConnectionBanner(false, null);
    
    if (connectionStatusDiv) {
      if (statusIcon) statusIcon.className = "status-indicator status-disconnected";
      if (statusText) statusText.textContent = "No server found. Please check that the server is running.";
    }
  }
  
  // Clean up
  discoveryController = null;
  isDiscoveryInProgress = false;
  
  return serverFound;
}

/**
 * Test connection to server
 */
async function testConnection(host, port) {
  // Update status indication
  connectionStatusDiv.style.display = "block";
  statusIcon.className = "status-indicator";
  statusText.textContent = `Testing connection to ${host}:${port}...`;
  
  console.log(`Testing connection to ${host}:${port}...`);
  
  try {
    // Try to connect to the server
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased timeout to 10s
    
    console.log(`Sending fetch request to http://${host}:${port}/.identity`);
    const response = await fetch(`http://${host}:${port}/.identity`, {
      signal: controller.signal,
      mode: 'cors', // Add CORS mode
      headers: {
        'Accept': 'application/json'
      }
    });
    
    clearTimeout(timeoutId);
    
    console.log(`Server response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const identity = await response.json();
    console.log("Server identity response:", identity);
    
    // Verify this is actually our server
    if (identity.signature === "mcp-browser-connector-24x7") {
      // Connection successful
      console.log("Connection successful: Valid server signature");
      statusIcon.className = "status-indicator status-connected";
      statusText.textContent = `Connected successfully to ${identity.name || "Browser Tools Server"} v${identity.version || "unknown"}`;
      
      // Update connection status
      serverConnected = true;
      updateConnectionBanner(true, {
        name: identity.name || "Browser Tools Server",
        version: identity.version || "unknown",
        host: host,
        port: port
      });
      
      // Update settings if changed
      if (settings.serverHost !== host || settings.serverPort !== port) {
        settings.serverHost = host;
        settings.serverPort = port;
        await saveSettings();
      }
      
      // Notify the background script and DevTools panel
      console.log("Sending server validation success message");
      await browserAPI.runtime.sendMessage({
        type: "SERVER_VALIDATION_SUCCESS",
        serverHost: host,
        serverPort: port,
        serverInfo: identity
      });
      
      // Hide status after a delay
      setTimeout(() => {
        connectionStatusDiv.style.display = "none";
      }, 3000);
    } else {
      console.error("Invalid server signature:", identity.signature);
      throw new Error("Invalid server signature - not a BrowserTools server");
    }
  } catch (error) {
    // Connection failed
    console.error("Connection test failed:", error);
    statusIcon.className = "status-indicator status-disconnected";
    statusText.textContent = `Connection failed: ${error.message}`;
    
    // Update connection status
    serverConnected = false;
    updateConnectionBanner(false, null);
    
    // Notify the background script and DevTools panel
    await browserAPI.runtime.sendMessage({
      type: "SERVER_VALIDATION_FAILED",
      reason: error.name === "AbortError" ? "timeout" : "connection_error",
      serverHost: host,
      serverPort: port,
      error: error.message
    });
  }
}

/**
 * Capture screenshot - Modified to ensure background message is sent
 */
async function captureScreenshot() {
  if (!currentTabId) {
    console.error("Panel: Cannot capture screenshot, missing tab ID.");
    alert("Error: Could not determine the current tab ID.");
    return;
  }
  try {
    console.log(`Panel: Requesting screenshot for tab: ${currentTabId}`);
    
    // Send message to the background script to capture the screenshot
    const response = await browserAPI.runtime.sendMessage({
      type: "CAPTURE_SCREENSHOT",
      tabId: currentTabId
      // Pass settings directly if needed by background, or let background load them
      // settings: settings 
    });
    
    console.log("Panel: Screenshot capture response:", response);
    
    if (response && response.success) {
      // Show success message (maybe more detailed)
      alert(`Screenshot captured successfully! Saved to: ${response.path || 'default location'}`);
    } else {
      // Show error message
      alert(`Failed to capture screenshot: ${response?.error || "Unknown error"}`);
    }
  } catch (error) {
    console.error("Panel: Error capturing screenshot:", error);
    alert(`Error capturing screenshot: ${browserAPI.getErrorMessage(error)}`);
  }
}

/**
 * Wipe all logs - Modified to use sendToServer if WS is primary
 */
async function wipeLogs() {
  if (!confirm("Are you sure you want to wipe all logs?")) {
    return;
  }
  
  console.log("Panel: Wiping local logs...");
  consoleLogs.length = 0;
  consoleErrors.length = 0;
  networkLogEntries.length = 0; // Clear HAR logs
  
  console.log("Panel: Requesting server to wipe logs...");
  // Primary method: Send command via WebSocket if connected
  if (sendToServer("wipe-logs", {})) {
    alert("Wipe command sent to server.");
    return;
  } 
  
  // Fallback: Send via HTTP if WebSocket failed
  console.warn("Panel: WebSocket unavailable, falling back to HTTP POST for wipe logs.");
  try {
    const host = settings.serverHost;
    const port = settings.serverPort;
    if (!host || !port) throw new Error("Server host/port not configured");
    
    const response = await fetch(`http://${host}:${port}/wipe-logs`, {
      method: "POST",
      mode: 'cors' // Ensure CORS for HTTP fallback
    });
    
    if (!response.ok) throw new Error(`Server error ${response.status}`);
    const result = await response.json();
    console.log("Panel: Server wipe response (HTTP):", result);
    alert("Logs wiped successfully (via HTTP).");

  } catch (error) {
    console.error("Panel: Error wiping logs via HTTP:", error);
    alert(`Error wiping logs: ${error.message}`);
  }
}

// Initialize the panel when the DOM is ready
document.addEventListener("DOMContentLoaded", initPanel);

// Add listeners to detach debugger when panel is closed/hidden
// These might not work in all Firefox versions or contexts
window.addEventListener('unload', () => {
  console.log("Panel unloading, detaching debugger...");
  // Close WebSocket cleanly if open
  if (ws) {
    intentionalClosure = true;
    ws.close();
  }
});

// --- WebSocket Logic (Keep) ---

/**
 * Setup WebSocket connection
 */
async function setupWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log("Panel: WebSocket already open.");
    return;
  }
  if (ws && ws.readyState === WebSocket.CONNECTING) {
    console.log("Panel: WebSocket connection attempt already in progress.");
    return;
  }

  if (!settings.serverHost || !settings.serverPort) {
    console.warn("Panel: Cannot connect WebSocket, server host/port not set.");
    updateConnectionBanner(false, null);
    return;
  }
  
  // Validate server before connecting (optional but good practice)
  console.log(`Panel: Validating server before WebSocket connection: http://${settings.serverHost}:${settings.serverPort}/.identity`);
  try {
    const identityResponse = await fetch(`http://${settings.serverHost}:${settings.serverPort}/.identity`, { mode: 'cors' });
    if (!identityResponse.ok) throw new Error(`Identity check failed: ${identityResponse.status}`);
    const identity = await identityResponse.json();
    console.log("Panel: Server identity:", identity);
    if (identity.signature !== "mcp-browser-connector-24x7") throw new Error("Invalid server signature");
    console.log("Panel: Server validation successful, proceeding with WebSocket connection.");
  } catch (validationError) {
    console.error("Panel: Server validation failed before WebSocket connect:", validationError);
    updateConnectionBanner(false, null); // Show disconnected
    // Optionally schedule a reconnect attempt for discovery?
    scheduleReconnectAttempt(); 
    return;
  }

  const wsUrl = `ws://${settings.serverHost}:${settings.serverPort}/extension-ws`;
  console.log(`Panel: Connecting to WebSocket: ${wsUrl}`);

  try {
    ws = new WebSocket(wsUrl);
  } catch (error) {
    console.error("Panel: WebSocket constructor failed:", error);
    updateConnectionBanner(false, null);
    scheduleReconnectAttempt();
    return;
  }

  ws.onopen = () => {
    console.log("Panel: WebSocket connection opened successfully");
    serverConnected = true;
    intentionalClosure = false;
    updateConnectionBanner(true, { host: settings.serverHost, port: settings.serverPort });
    if (reconnectAttemptTimeout) clearTimeout(reconnectAttemptTimeout);

    // Send identification and initial data
    console.log("Panel: Sending identification message...");
    sendToServer("extension_connected", { 
        extension: "firefox-browser-tools-mcp", 
        version: browser.runtime.getManifest().version, // Get version dynamically
        tabId: currentTabId 
    });
    sendToServer("ping", {});
    sendInitialData();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("Panel: Received WebSocket message:", data);
      handleWebSocketMessage(data);
    } catch (error) {
      console.error("Panel: Error processing WebSocket message:", error);
    }
  };

  ws.onerror = (event) => {
    console.error("Panel: WebSocket error:", event);
    // UI update is handled by onclose
  };

  ws.onclose = (event) => {
    console.log(`Panel: WebSocket closed. Code: ${event.code}, Reason: ${event.reason}, Intentional: ${intentionalClosure}`);
    ws = null;
    serverConnected = false;
    updateConnectionBanner(false, null);
    if (!intentionalClosure) {
      scheduleReconnectAttempt(); // Attempt to reconnect if closure was unexpected
    }
  };
}

/**
 * Handle incoming WebSocket messages from the server
 */
function handleWebSocketMessage(data) {
  switch (data.type) {
    case "pong":
      console.log("Panel: Received pong from server.");
      break;
    case "server-shutdown":
      console.log("Panel: Server initiated shutdown.");
      intentionalClosure = true;
      if (ws) ws.close();
      updateConnectionBanner(false, null);
      break;
    // Add handlers for other potential server -> client messages if needed
    default:
      console.warn(`Panel: Unhandled WebSocket message type from server: ${data.type}`);
  }
}

/**
 * Send data to the server via WebSocket
 */
function sendToServer(type, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      const message = JSON.stringify({ type, data });
      // Optional: Truncate large messages for logging
      const logMessage = message.length > 500 ? message.substring(0, 500) + '... (truncated)' : message;
      console.log(`Panel: Sending WebSocket message: ${logMessage}`);
      ws.send(message);
      return true;
    } catch (error) {
      console.error("Panel: Failed to send WebSocket message:", error);
      return false;
    }
  } else {
    console.warn(`Panel: Cannot send WebSocket message, connection not open. Type: ${type}`);
    return false;
  }
}

/**
 * Send initial data (logs) to server on connection
 */
function sendInitialData() {
  console.log("Panel: Sending initial data (logs) to server...");
  // Send any logs that might have accumulated before connection
  consoleLogs.forEach(log => sendToServer("console-log", log));
  consoleErrors.forEach(log => sendToServer("console-error", log));
  networkLogEntries.forEach(req => sendToServer("network-request", req)); // Send stored HAR entries
  console.log("Panel: Initial data sent.");
}

/**
 * Handle HAR entry from browser.devtools.network.onRequestFinished
 */
function handleNetworkHAR(harEntry) {
    console.log("Panel: Received HAR entry for:", harEntry.request.url);
    try {
        // Format the HAR entry into something the server expects
        // This requires adapting the HAR structure to the previous format
        // or updating the server to accept HAR format directly.
        // Basic example assuming server wants previous format:
        const formattedEntry = {
            requestId: harEntry._request_id || `${harEntry.request.method}-${harEntry.request.url}-${harEntry.startedDateTime}`, // Generate unique ID if needed
            url: harEntry.request.url,
            method: harEntry.request.method,
            status: harEntry.response.status,
            statusText: harEntry.response.statusText,
            timestamp: new Date(harEntry.startedDateTime).toISOString(),
            time: harEntry.time, // Total duration
            mimeType: harEntry.response.content.mimeType,
            requestHeaders: settings.showRequestHeaders ? harEntry.request.headers : undefined,
            responseHeaders: settings.showResponseHeaders ? harEntry.response.headers : undefined,
            requestBody: harEntry.request.postData ? (harEntry.request.postData.text || "[Binary/Non-Text Request Body]") : "",
            responseBody: "", // Placeholder, needs population
            encodedDataLength: harEntry.response.content.size,
            // ... add other relevant fields if needed
        };

        // Handle response body content
        if (harEntry.response.content.text) {
            if (harEntry.response.content.encoding === "base64") {
                // Indicate binary data (similar to before)
                const mimeType = formattedEntry.mimeType || 'application/octet-stream';
                const fileExtension = mimeType.split('/').pop().split(';')[0];
                formattedEntry.responseBody = `[Binary data: ${mimeType}, size: ${formattedEntry.encodedDataLength} bytes, type: ${fileExtension}]`;
            } else {
                formattedEntry.responseBody = harEntry.response.content.text;
                // Truncate if necessary
                if (formattedEntry.responseBody.length > settings.stringSizeLimit) {
                    formattedEntry.responseBody = formattedEntry.responseBody.substring(0, settings.stringSizeLimit) + `... [truncated]`;
                }
            }
        } else {
            formattedEntry.responseBody = "[No Text Content]";
        }

        console.log("Panel: Formatted HAR entry:", formattedEntry);

        // Store and send
        if (networkLogEntries.length >= settings.logLimit) networkLogEntries.shift();
        networkLogEntries.push(formattedEntry);
        sendToServer("network-request", formattedEntry); // Send full details

    } catch (error) {
        console.error("Panel: Error processing HAR entry for", harEntry.request.url, error);
    }
}

/**
 * Handle messages forwarded from the background script
 */
function handleBackgroundMessage(message, sender) {
    // No need to check sender, background filters by tabId before sending
    console.log("Panel: Received message from background:", message.type);
    
    // Add detailed logging
    console.log("Panel: Message details:", {
        type: message.type,
        hasPayload: !!message.payload,
        tabId: message.tabId,
        from: sender?.id || "unknown"
    });

    if (message.type === "FORWARDED_CONSOLE_LOG") {
        handleForwardedConsoleMessage(message.payload);
    }
    // Handle other background messages if needed
}

/**
 * Handle forwarded console log message from background script
 */
function handleForwardedConsoleMessage(payload) {
  try {
    console.log("Panel: Handling forwarded console message", payload);
    
    // Payload should already be mostly formatted by content script
    const logEntry = {
      timestamp: payload.timestamp || new Date().toISOString(),
      type: payload.level === "error" ? "console-error" : "console-log",
      message: payload.args ? payload.args.join(' ') : '[No Message Arguments]', // Reconstruct message from args
      level: payload.level,
      source: "content-script", // Indicate source
      url: payload.url,
      // line, column, stackTrace might be missing from content script
    };

    console.log("Panel: Formatted forwarded log entry:", logEntry);

    // Store locally 
    switch (logEntry.level) {
      case "error":
        if (consoleErrors.length >= settings.logLimit) consoleErrors.shift();
        consoleErrors.push(logEntry);
        break;
      default:
        if (consoleLogs.length >= settings.logLimit) consoleLogs.shift();
        consoleLogs.push(logEntry);
        break;
    }

    // Send to server via WebSocket
    sendToServer(logEntry.type, logEntry);

  } catch (error) {
    console.error("Panel: Error handling forwarded console message:", error);
  }
} 