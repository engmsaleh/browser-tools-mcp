// panel.js - Firefox compatible version

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

/**
 * Initialize the panel
 */
async function initPanel() {
  console.log("Initializing panel");
  
  // Load settings
  await loadSettings();
  
  // Set up UI event listeners
  setupEventListeners();
  
  // Create connection status banner
  createConnectionBanner();
  
  // Update UI from settings
  updateUIFromSettings();
  
  // Auto-discover server
  discoverServer(true);
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
  
  // Try to find the server
  for (const host of hosts) {
    if (serverFound) break;
    
    for (const port of ports) {
      if (serverFound) break;
      
      try {
        console.log(`Checking ${host}:${port}...`);
        
        // Use the identity endpoint for validation
        const response = await fetch(`http://${host}:${port}/.identity`, {
          signal: discoveryController.signal,
        });
        
        if (response.ok) {
          const identity = await response.json();
          
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
            await browserAPI.runtime.sendMessage({
              type: "SERVER_VALIDATION_SUCCESS",
              serverHost: host,
              serverPort: port,
              serverInfo: identity
            });
            
            break;
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
  
  try {
    // Try to connect to the server
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`http://${host}:${port}/.identity`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const identity = await response.json();
    
    // Verify this is actually our server
    if (identity.signature === "mcp-browser-connector-24x7") {
      // Connection successful
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
      throw new Error("Invalid server signature - not a BrowserTools server");
    }
  } catch (error) {
    // Connection failed
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
 * Capture screenshot
 */
async function captureScreenshot() {
  try {
    // First get the current tab ID from the DevTools
    const tabId = isFirefox 
      ? browser.devtools.inspectedWindow.tabId
      : chrome.devtools.inspectedWindow.tabId;
    
    if (!tabId) {
      console.error("Could not get current tab ID");
      return;
    }
    
    console.log("Capturing screenshot for tab:", tabId);
    
    // Send message to the background script to capture the screenshot
    const response = await browserAPI.runtime.sendMessage({
      type: "CAPTURE_SCREENSHOT",
      tabId: tabId
    });
    
    console.log("Screenshot capture response:", response);
    
    if (response && response.success) {
      // Show success message
      alert("Screenshot captured successfully");
    } else {
      // Show error message
      alert(`Failed to capture screenshot: ${response?.error || "Unknown error"}`);
    }
  } catch (error) {
    console.error("Error capturing screenshot:", error);
    alert(`Error capturing screenshot: ${browserAPI.getErrorMessage(error)}`);
  }
}

/**
 * Wipe all logs
 */
async function wipeLogs() {
  if (!confirm("Are you sure you want to wipe all logs?")) {
    return;
  }
  
  try {
    // Get server settings
    const host = settings.serverHost;
    const port = settings.serverPort;
    
    if (!host || !port) {
      throw new Error("Server host or port not configured");
    }
    
    // Send wipe request to server
    const response = await fetch(`http://${host}:${port}/wipe-logs`, {
      method: "POST"
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    alert("Logs wiped successfully");
  } catch (error) {
    console.error("Error wiping logs:", error);
    alert(`Error wiping logs: ${error.message}`);
  }
}

// Initialize the panel
document.addEventListener("DOMContentLoaded", initPanel); 