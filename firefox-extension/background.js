// background.js - Firefox compatible version

// Load the compatibility layer
// Note: In Firefox, we need to ensure this is properly loaded
if (typeof browserAPI === 'undefined') {
  try {
    importScripts('browser-compat.js');
  } catch (e) {
    console.error("Failed to import browser-compat.js:", e);
  }
}

// Track URLs for each tab
const tabUrls = new Map();

// Listen for messages from the devtools panel
browserAPI.runtime.onMessage.addListener((message, sender) => {
  // Handle URL requests
  if (message.type === "GET_CURRENT_URL" && message.tabId) {
    return getCurrentTabUrl(message.tabId)
      .then(url => ({ success: true, url: url }))
      .catch(error => ({ success: false, error: error.message }));
  }

  // Handle explicit request to update the server with the URL
  if (message.type === "UPDATE_SERVER_URL" && message.tabId && message.url) {
    console.log(
      `Background: Received request to update server with URL for tab ${message.tabId}: ${message.url}`
    );
    
    return updateServerWithUrl(
      message.tabId, 
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
  if (message.type === "CAPTURE_SCREENSHOT" && message.tabId) {
    return handleScreenshotRequest(message);
  }

  // Handle WebSocket connection notifications
  if (message.type === "WEBSOCKET_CONNECTED") {
    console.log(`WebSocket connected to ${message.serverHost}:${message.serverPort}`);
    return Promise.resolve({ success: true });
  }

  return false; // Not handled
});

/**
 * Handle screenshot capture requests
 */
async function handleScreenshotRequest(message) {
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`http://${host}:${port}/.identity`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`Invalid server response: ${response.status}`);
      return false;
    }

    const identity = await response.json();

    // Validate the server signature
    if (identity.signature !== "mcp-browser-connector-24x7") {
      console.error("Invalid server signature - not the browser tools server");
      return false;
    }

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
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url,
        tabId,
        source
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
  try {
    const tabId = message.tabId;
    
    console.log(`Capturing screenshot for tab ${tabId}`);
    
    // Capture the screenshot
    // In Firefox we use browser.tabs.captureTab
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
    
    if (!screenshotDataUrl) {
      return {
        success: false,
        error: "Screenshot capture returned empty data"
      };
    }
    
    console.log("Screenshot captured, sending to server");
    
    // Send to server
    const serverUrl = `http://${settings.serverHost}:${settings.serverPort}/screenshot`;
    
    // We need to convert the data URL to a binary blob
    const base64Data = screenshotDataUrl.split(',')[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });
    
    // Create form data
    const formData = new FormData();
    formData.append('screenshot', blob, 'screenshot.png');
    formData.append('autoPaste', settings.allowAutoPaste ? 'true' : 'false');
    
    // Add optional screenshot path if specified
    if (settings.screenshotPath) {
      formData.append('path', settings.screenshotPath);
    }
    
    // Send the screenshot
    const response = await fetch(serverUrl, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const responseData = await response.json();
    
    return {
      success: true,
      data: responseData
    };
  } catch (error) {
    console.error("Error sending screenshot to server:", error);
    return {
      success: false,
      error: `Failed to send screenshot to server: ${error.message}`
    };
  }
}

// Set up listeners for tab changes
if (isFirefox) {
  // Firefox API
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Track URL changes
    if (changeInfo.url) {
      console.log(`URL changed in tab ${tabId} to ${changeInfo.url}`);
      tabUrls.set(tabId, changeInfo.url);
      
      // Send URL update to server
      updateServerWithUrl(tabId, changeInfo.url, "tab_url_change")
        .catch(error => console.error("Error updating server with URL:", error));
    }
    
    // Check if this is a page refresh (status becoming "complete")
    if (changeInfo.status === "complete") {
      // Update URL in our cache
      if (tab.url) {
        tabUrls.set(tabId, tab.url);
        
        // Send URL update to server
        updateServerWithUrl(tabId, tab.url, "page_complete")
          .catch(error => console.error("Error updating server with URL:", error));
      }
    }
  });
  
  // Listen for tab activation (switching between tabs)
  browser.tabs.onActivated.addListener((activeInfo) => {
    const tabId = activeInfo.tabId;
    console.log(`Tab activated: ${tabId}`);
    
    // Get the URL of the newly activated tab
    browser.tabs.get(tabId)
      .then(tab => {
        if (tab && tab.url) {
          tabUrls.set(tabId, tab.url);
          
          // Update server with URL
          return updateServerWithUrl(tabId, tab.url, "tab_activated");
        }
      })
      .catch(error => console.error("Error processing activated tab:", error));
  });
} else {
  // Chrome API (for compatibility)
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Similar implementation as Firefox but with callbacks
    // This would be expanded in a full implementation
  });
  
  chrome.tabs.onActivated.addListener((activeInfo) => {
    // Similar implementation as Firefox but with callbacks
  });
}

console.log("Background script initialized"); 