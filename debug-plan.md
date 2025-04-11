# Firefox Extension Console Logging Debug Plan

## Issue Identified
After analyzing the codebase, I've identified the root cause of why console logs aren't being forwarded to the browser-tools-server:

In the Firefox extension, the background script is using `browser.tabs.sendMessage()` to try to forward console logs to the DevTools panel. This won't work because:

1. The DevTools panel is not a content script and doesn't use the same messaging system as tabs
2. Messages sent with `tabs.sendMessage()` are meant for content scripts running in web pages, not DevTools panels

## Required Fixes

### 1. Fix in `background.js`

Change lines 58-69 from:

```javascript
if (tabId) {
    browser.tabs.sendMessage(tabId, {
        type: "FORWARDED_CONSOLE_LOG",
        payload: message.payload
    }).catch(err => {
        console.log(`Background: Could not forward console log to tab ${tabId} (panel likely closed): ${err.message}`);
        // If panel is closed, maybe remove from devToolsTabs?
        if (err.message.includes("Could not establish connection")) {
             devToolsTabs.delete(tabId);
             injectedTabs.delete(tabId); // Assume script is gone if panel is closed
        }
    });
}
```

To:

```javascript
// Forward the captured log using runtime.sendMessage instead of tabs.sendMessage
// This will reach the DevTools panel since it's using runtime.onMessage.addListener
browser.runtime.sendMessage({
    type: "FORWARDED_CONSOLE_LOG",
    payload: message.payload,
    tabId: tabId  // Include tabId so panel knows which tab generated the log
}).catch(err => {
    console.error(`Background: Error forwarding console log: ${err.message}`);
});
```

### 2. Additional Debugging Enhancements (Optional)

To help troubleshoot further, add these enhancements:

#### In `console-proxy.js`:
Add before line 87:

```javascript
// Log the initialization once more to make it clearly visible
console.log("[BrowserTools MCP] Initialization check: Console logging should be active now");
```

#### In `background.js`:
Add after line 56:

```javascript
// Log more details to help with debugging
console.log(`Background: Console log details:`, {
    messageType: message.type,
    level: message.payload.level,
    args: message.payload.args,
    tabId: tabId
});
```

#### In `panel.js`:
Add after line 949:

```javascript
// Add detailed logging
console.log("Panel: Message details:", {
    type: message.type,
    hasPayload: !!message.payload,
    tabId: message.tabId,
    from: sender?.id || "unknown"
});
```

## Implementation Steps

1. Open `firefox-extension/background.js`
2. Locate the `CONSOLE_LOG_CAPTURED` handler (around line 55)
3. Replace the `tabs.sendMessage` code with the `runtime.sendMessage` code provided above
4. Add the optional debugging enhancements if needed
5. Save the files
6. Reload the extension in Firefox
7. Test with a web page that outputs console logs
8. Check if logs appear in the browser-tools-server

## Verification

After making these changes, you should see:

1. "[BrowserTools MCP] Console proxy script loaded and active" in the web page console
2. "Background: Received console log from content script" in the extension's background page console
3. "Panel: Received message from background: FORWARDED_CONSOLE_LOG" in the extension's panel console
4. Console logs appearing in the browser-tools-server

## Additional Notes

The Firefox extension's architecture for console logging follows this path:

1. Web page executes `console.log()`
2. `console-proxy.js` (content script) intercepts and sends to background via `runtime.sendMessage()`
3. `background.js` receives and should forward to panel via `runtime.sendMessage()`
4. `panel.js` receives via `runtime.onMessage.addListener()` and forwards to server via WebSocket
5. `browser-tools-server` receives and stores logs

The current issue is in step 3, where it's using `tabs.sendMessage()` instead of `runtime.sendMessage()`.