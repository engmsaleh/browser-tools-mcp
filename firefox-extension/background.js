// background.js - Firefox compatible version

// Compatibility layer is now loaded via manifest.json, no need for importScripts

// Track URLs for each tab
const tabUrls = new Map();

// Store injected script status per tab
const injectedTabs = new Set();

// Function to inject the console proxy content script
async function injectContentScript(tabId) {
  if (injectedTabs.has(tabId)) {
    // console.log(`Background: Content script already injected in tab ${tabId}`);
    return; // Already injected
  }
  try {
    console.log(`Background: Attempting to inject console-proxy.js code directly into tab ${tabId} using tabs.executeScript`);
    console.log(`Background: Attempting to inject console-proxy.js code directly into tab ${tabId}`);
    // Injecting the code content directly using scripting.executeScript with 'func'
    await browser.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        // --- Start of console-proxy.js code ---
        // NOTE: This code is duplicated here from console-proxy.js
        // Any changes there need to be reflected here.

        // Avoid re-injecting if already present
        if (window.hasBrowserToolsConsoleProxy) {
          console.log("[BrowserTools MCP] Console proxy already injected.");
          return;
        }
        window.hasBrowserToolsConsoleProxy = true; // Set flag

        console.log("[BrowserTools MCP] Initializing console proxy content script (injected code).");

        const originalConsole = {
          log: console.log,
          warn: console.warn,
          error: console.error,
          info: console.info,
          debug: console.debug,
        };

        let isProxyLogging = false;

        function serializeArgs(args) {
            const serialized = [];
            for (const arg of args) {
                try {
                    if (arg instanceof Error) {
                         serialized.push({ type: 'error', message: arg.message, stack: arg.stack });
                    } else if (arg instanceof Node) {
                         serialized.push({ type: 'domnode', outerHTML: arg.outerHTML.substring(0, 200) + (arg.outerHTML.length > 200 ? '...' : '') });
                    } else if (typeof arg === 'object' && arg !== null) {
                         // Basic stringify, handle potential errors
                         try {
                            serialized.push(JSON.stringify(arg));
                         } catch (stringifyError) {
                            serialized.push(`[Unserializable Object: ${stringifyError.message}]`);
                         }
                    } else {
                         serialized.push(arg);
                    }
                } catch (e) {
                    serialized.push(`[Serialization Error: ${e.message}]`);
                }
            }
            return serialized;
        }

        Object.keys(originalConsole).forEach(level => {
          console[level] = function(...args) {
            originalConsole[level].apply(console, args);
            if (isProxyLogging) return;
            try {
                isProxyLogging = true;
                const messagePayload = {
                    type: "CONSOLE_LOG_CAPTURED",
                    payload: {
                        level: level,
                        args: serializeArgs(args),
                        timestamp: new Date().toISOString(),
                        url: window.location.href
                    }
                };
                const api = typeof browser !== 'undefined' ? browser : null; // Firefox uses 'browser'
                if (api && api.runtime && api.runtime.sendMessage) {
                    api.runtime.sendMessage(messagePayload)
                        .catch(err => {
                            originalConsole.error('[BrowserTools MCP] Error sending console log to background:', err);
                        })
                        .finally(() => {
                            isProxyLogging = false;
                        });
                } else {
                     originalConsole.error('[BrowserTools MCP] Extension API not available to send console log.');
                     isProxyLogging = false;
                }
            } catch (e) {
                originalConsole.error('[BrowserTools MCP] Error in console proxy:', e);
                isProxyLogging = false;
            }
          };
        });
        console.log("[BrowserTools MCP] Initialization check: Console logging should be active now (injected code).");
        console.log("[BrowserTools MCP] Console proxy script loaded and active (injected code).");
        // --- End of console-proxy.js code ---
      }
    });
    injectedTabs.add(tabId);
    console.log(`Background: Successfully injected console-proxy.js into tab ${tabId}`);
  } catch (err) {
    console.error(`Background: Failed to inject content script into tab ${tabId}: ${err}`);
    // Common reasons: No permission for the page (e.g., about: pages, AMO), tab closed.
  }
}

// Listen for DevTools opening (approximated by panel creation message or first message from panel)
// Keep track of tabs where DevTools might be open
const devToolsTabs = new Set();

// Listen for messages from the devtools panel or other scripts
browserAPI.runtime.onMessage.addListener((message, sender) => {
  const tabId = message.tabId || sender.tab?.id; // Get tabId preferably from message, fallback to sender

  // Allow settings request without tabId
  if (!tabId && message.type !== "GET_SETTINGS") {
      console.error("Background: Received message without identifiable tabId:", message);
      return Promise.resolve({ success: false, error: "Missing tabId" });
  }

  console.log(`Background: Received message type '${message.type}' for tab ${tabId || 'N/A'} from ${sender.url || 'background'}`);

  // If it's the first message from a panel script, assume DevTools opened for that tab
  if (sender.url && sender.url.endsWith('panel.html') && tabId && !devToolsTabs.has(tabId)) {
      console.log(`Background: Detected DevTools potentially opened for tab ${tabId}. Injecting content script.`);
      devToolsTabs.add(tabId);
      injectContentScript(tabId);
  }
  
  // Handle captured console logs from content script
  if (message.type === "CONSOLE_LOG_CAPTURED") {
    console.log(`Background: Received console log from content script for tab ${tabId}:`, message.payload.level);
    
    // Log more details to help with debugging
    console.log(`Background: Console log details:`, {
        messageType: message.type,
        level: message.payload.level,
        args: message.payload.args,
        tabId: tabId
    });
    
    // Forward the captured log using runtime.sendMessage instead of tabs.sendMessage
    // This will reach the DevTools panel since it's using runtime.onMessage.addListener
    if (tabId) {
        browser.runtime.sendMessage({
            type: "FORWARDED_CONSOLE_LOG",
            payload: message.payload,
            tabId: tabId  // Include tabId so panel knows which tab generated the log
        }).catch(err => {
            console.error(`Background: Error forwarding console log: ${err.message}`);
        });
    } else {
        console.error("Background: Cannot forward console log, missing tabId.");
    }
    
    return Promise.resolve({ success: true }); // Acknowledge message
  }

  // Handle URL requests
  if (message.type === "GET_CURRENT_URL") {
    return getCurrentTabUrl(tabId)
      .then(url => ({ success: true, url: url }))
      .catch(error => ({ success: false, error: error.message }));
  }

  // Handle explicit request to update the server with the URL
  if (message.type === "UPDATE_SERVER_URL" && message.url) {
    console.log(
      `Background: Received request to update server with URL for tab ${tabId}: ${message.url}`
    );

    return updateServerWithUrl(
      tabId,
      message.url,
      message.source || "explicit_update"
    )
      .then(() => ({ success: true }))
      .catch(error => ({
        success: false,
        error: error.message
      }));
  }

  // Handle screenshot capture requests
  if (message.type === "CAPTURE_SCREENSHOT") {
    // Pass tabId to the handler
    return handleScreenshotRequest({ ...message, tabId });
  }

  // Handle WebSocket connection notifications
  if (message.type === "WEBSOCKET_CONNECTED") {
    console.log(`Background: WebSocket connected confirmation from devtools for ${message.serverHost}:${message.serverPort}`);
    return Promise.resolve({ success: true });
  }

  // Handle settings request (added)
  if (message.type === "GET_SETTINGS") {
     // Assuming loadSettings exists and returns settings
     // Replace with actual settings loading logic if needed
     return browserAPI.storage.local.get(["browserConnectorSettings"])
             .then(result => ({ success: true, settings: result.browserConnectorSettings }))
             .catch(error => ({ success: false, error: error.message }));
  }

  console.warn(`Background: Unhandled message type: ${message.type}`);
  return Promise.resolve({ success: false, error: `Unhandled message type: ${message.type}` });
});

/**
 * Handle screenshot capture requests
 */
async function handleScreenshotRequest(message) {
  const tabId = message.tabId;
  if (!tabId) {
     console.error("Cannot capture screenshot: Missing tabId");
     return { success: false, error: "Missing tabId for screenshot request" };
  }
  try {
    // First get the server settings
    const result = await browserAPI.storage.local.get(["browserConnectorSettings"]);
    const settings = result.browserConnectorSettings || {
      serverHost: "localhost",
      serverPort: 3025,
      allowAutoPaste: false
    };

    // Validate server identity first
    const isValid = await validateServerIdentity(settings.serverHost, settings.serverPort);
    if (!isValid) {
      console.error("Cannot capture screenshot: Not connected to a valid browser tools server");
      return {
        success: false,
        error: "Not connected to a valid browser tools server. Please check your connection settings."
      };
    }

    // Capture the screenshot
    return await captureAndSendScreenshot(message, settings);
  } catch (error) {
    console.error("Error handling screenshot request:", error);
    return {
      success: false,
      error: `Failed to capture screenshot: ${error.message}`
    };
  }
}

/**
 * Validate server identity
 */
async function validateServerIdentity(host, port) {
  try {
    console.log(`Validating server identity at ${host}:${port}`);

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
      console.error(`Invalid server response: ${response.status}`);
      return false;
    }

    const identity = await response.json();
    console.log("Server identity response:", identity);

    // Validate the server signature
    if (identity.signature !== "mcp-browser-connector-24x7") {
      console.error("Invalid server signature - not the browser tools server");
      return false;
    }

    console.log("Server validation successful");
    return true;
  } catch (error) {
    console.error("Error validating server identity:", error);
    return false;
  }
}

/**
 * Function to get the current URL for a tab
 */
async function getCurrentTabUrl(tabId) {
  try {
    console.log("Background: Getting URL for tab", tabId);

    // First check if we have it cached
    if (tabUrls.has(tabId)) {
      const cachedUrl = tabUrls.get(tabId);
      console.log("Background: Found cached URL:", cachedUrl);
      return cachedUrl;
    }

    // Try to get the tab directly
    try {
      const tab = await browserAPI.tabs.get(tabId);
      if (tab && tab.url) {
        // Cache the URL
        tabUrls.set(tabId, tab.url);
        console.log("Background: Got URL from tab:", tab.url);
        return tab.url;
      }
    } catch (tabError) {
      console.error("Background: Error getting tab:", tabError);
    }

    // If we can't get the tab directly, try querying for active tabs
    try {
      const tabs = await browserAPI.tabs.query({
        active: true,
        currentWindow: true
      });

      if (tabs && tabs.length > 0 && tabs[0].url) {
        const activeUrl = tabs[0].url;
        console.log("Background: Got URL from active tab:", activeUrl);
        // Cache this URL as well
        tabUrls.set(tabId, activeUrl);
        return activeUrl;
      }
    } catch (queryError) {
      console.error("Background: Error querying tabs:", queryError);
    }

    console.log("Background: Could not find URL for tab", tabId);
    return null;
  } catch (error) {
    console.error("Background: Error getting tab URL:", error);
    return null;
  }
}

/**
 * Update the server with the current URL
 */
async function updateServerWithUrl(tabId, url, source = "background_update") {
  try {
    console.log(`Updating server with URL for tab ${tabId} (source: ${source}): ${url}`);

    // Get server settings
    const result = await browserAPI.storage.local.get(["browserConnectorSettings"]);
    const settings = result.browserConnectorSettings || {
      serverHost: "localhost",
      serverPort: 3025
    };

    // Update our local cache
    tabUrls.set(tabId, url);

    // Send to the server
    const response = await fetch(`http://${settings.serverHost}:${settings.serverPort}/current-url`, {
      method: "POST",
      mode: 'cors', // Added CORS mode
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url,
        tabId,
        source,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error("Error updating server with URL:", error);
    throw error;
  }
}

/**
 * Capture and send a screenshot to the server
 */
async function captureAndSendScreenshot(message, settings) {
  const tabId = message.tabId;
  try {
    console.log(`Capturing screenshot for tab ${tabId}`);

    // Capture the screenshot
    let screenshotDataUrl;
    try {
      screenshotDataUrl = await browserAPI.tabs.captureTab(tabId, { format: "png" });
    } catch (captureError) {
      console.error("Error capturing screenshot:", captureError);
      return {
        success: false,
        error: `Failed to capture screenshot: ${captureError.message}`
      };
    }

    // Send the screenshot to the server
    const serverUrl = `http://${settings.serverHost}:${settings.serverPort}/screenshot`;
    console.log(`Sending screenshot to ${serverUrl}`);

    // Using FormData to potentially handle large data better
    const formData = new FormData();
    formData.append("tabId", tabId);
    formData.append("data", screenshotDataUrl);
    if (settings.screenshotPath) {
       formData.append("path", settings.screenshotPath);
    }

    const response = await fetch(serverUrl, {
      method: 'POST',
      mode: 'cors', // Added CORS mode
      body: formData
      // Note: Don't set Content-Type header when using FormData,
      // the browser will set it correctly with the boundary.
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log("Screenshot successfully sent to server:", result);

    return {
      success: true,
      path: result.path,
      filename: result.filename
    };

  } catch (error) {
    console.error("Error sending screenshot to server:", error);
    return {
      success: false,
      error: `Failed to send screenshot: ${error.message}`
    };
  }
}

// Tab update listeners
browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    console.log(`Tab ${tabId} updated to complete status: ${tab.url}`);
    updateServerWithUrl(tabId, tab.url, "page_complete");
  } else if (changeInfo.url) {
    console.log(`Tab ${tabId} URL changed: ${changeInfo.url}`);
    updateServerWithUrl(tabId, changeInfo.url, "tab_url_change");
  }
}, { properties: ["status", "url"] });

browserAPI.tabs.onActivated.addListener((activeInfo) => {
  console.log(`Tab activated: ${activeInfo.tabId}`);
  browserAPI.tabs.get(activeInfo.tabId).then(tab => {
    if (tab && tab.url) {
      updateServerWithUrl(activeInfo.tabId, tab.url, "tab_activated");
    }
  }).catch(err => console.error("Error getting activated tab:", err));
});

// Listen for webNavigation events to inject content script early/reliably
browser.webNavigation.onCommitted.addListener((details) => {
  // Inject if it's the main frame and a potentially valid URL scheme
  if (details.frameId === 0) {
    // Check if the URL is one we can inject into (avoid about:, moz-extension:, etc.)
    if (details.url.startsWith('http') || details.url.startsWith('file')) {
       console.log(`Background: Navigation committed in tab ${details.tabId} to ${details.url}. Attempting content script injection.`);
       // Clear injection status on navigation before trying to inject (in case previous injection failed or script was removed)
       // injectedTabs.delete(details.tabId); // Let injectContentScript handle the check
       injectContentScript(details.tabId);
    } else {
       console.log(`Background: Skipping content script injection for non-injectable URL scheme: ${details.url}`);
    }
  }
});

// Clean up injection status when a tab is closed
browser.tabs.onRemoved.addListener((tabId) => {
  console.log(`Background: Tab ${tabId} removed, cleaning up state.`);
  injectedTabs.delete(tabId);
  devToolsTabs.delete(tabId);
});

console.log("Background script initialized"); 