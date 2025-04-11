// console-proxy.js - Content Script

console.log("[BrowserTools MCP] Initializing console proxy content script.");

const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
  // Add others if needed (table, dir, etc.)
};

// Flag to prevent infinite loops if our own logging triggers the proxy
let isProxyLogging = false;

// Function to safely serialize arguments
function serializeArgs(args) {
    const serialized = [];
    for (const arg of args) {
        try {
            // Simple types or basic JSON stringify
            if (arg instanceof Error) {
                 serialized.push({ type: 'error', message: arg.message, stack: arg.stack });
            } else if (arg instanceof Node) {
                 serialized.push({ type: 'domnode', outerHTML: arg.outerHTML.substring(0, 200) + (arg.outerHTML.length > 200 ? '...' : '') }); // Example serialization
            } else if (typeof arg === 'object' && arg !== null) {
                 // Basic stringify, could be enhanced with cycle detection
                 serialized.push(JSON.stringify(arg));
            } else {
                 serialized.push(arg); // primitives
            }
        } catch (e) {
            // Handle potential serialization errors (e.g., circular objects)
            serialized.push(`[Unserializable Object: ${e.message}]`);
        }
    }
    return serialized;
}


// Override console methods
Object.keys(originalConsole).forEach(level => {
  console[level] = function(...args) {
    // Call the original console method first
    originalConsole[level].apply(console, args);

    // Prevent feedback loop if our message sending logs something
    if (isProxyLogging) {
        return;
    }

    // Send the log data to the background script
    try {
        isProxyLogging = true; // Set flag
        const messagePayload = {
            type: "CONSOLE_LOG_CAPTURED",
            payload: {
                level: level,
                args: serializeArgs(args),
                timestamp: new Date().toISOString(),
                url: window.location.href // Include page URL
                // Could add stack trace here if needed, more complex
            }
        };
        // Use browserAPI if defined (for potential future Chrome compat), else browser
        const api = typeof browserAPI !== 'undefined' ? browserAPI : (typeof browser !== 'undefined' ? browser : null);
        if (api && api.runtime && api.runtime.sendMessage) {
            api.runtime.sendMessage(messagePayload)
                .catch(err => {
                    originalConsole.error('[BrowserTools MCP] Error sending console log to background:', err);
                })
                .finally(() => {
                    isProxyLogging = false; // Reset flag
                });
        } else {
             originalConsole.error('[BrowserTools MCP] Extension API not available to send console log.');
             isProxyLogging = false; // Reset flag
        }
    } catch (e) {
        originalConsole.error('[BrowserTools MCP] Error in console proxy:', e);
        isProxyLogging = false; // Reset flag
    }
  };
});
// Log the initialization once more to make it clearly visible
console.log("[BrowserTools MCP] Initialization check: Console logging should be active now");
console.log("[BrowserTools MCP] Console proxy script loaded and active.");