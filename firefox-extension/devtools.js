// devtools.js - Simplified version for Firefox

// This script's main purpose is to create the DevTools panel.
// Debugger and WebSocket logic will be handled by the panel script (panel.js).

console.log("devtools.js: Initializing...");

/**
 * Create the DevTools panel
 */
function createPanel() {
  const panelName = "BrowserTools MCP";
  const panelPath = "panel.html";
  const iconPath = "icons/icon-48.svg"; // Assuming icon path

  console.log(`devtools.js: Attempting to create panel '${panelName}'...`);

  const creationCallback = (panel) => {
    // Check for errors after creation attempt
    if (browser.runtime.lastError) {
       console.error(`Error creating panel: ${browser.runtime.lastError.message}`);
    } else {
       console.log("devtools.js: Panel created successfully.", panel);
    }
    // Panel setup or communication can happen here if needed,
    // but main logic resides in panel.js now.
  };

  try {
    // Use the Firefox API directly
    browser.devtools.panels.create(panelName, iconPath, panelPath)
      .then(creationCallback)
      .catch(error => console.error("Error creating panel (Promise):", error));

  } catch (error) {
     console.error("Exception during panel creation:", error);
  }
}

// Run the panel creation function
createPanel();

console.log("devtools.js: Initialization complete.");

// No further logic needed here - panel.js takes over. 