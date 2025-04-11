# Firefox Extension Console Logging - Testing Guide

This guide will help you test the fix for console logging in the Firefox extension.

## Fix Summary

We identified and fixed an issue with the communication between the browser extension components:

1. The main issue was in `background.js`, which was using `browser.tabs.sendMessage()` to send logs to the DevTools panel. This doesn't work because DevTools panels are not accessible via tab messaging.
2. Changed to use `browser.runtime.sendMessage()` instead, which is the correct method for communicating with DevTools panels.
3. Added additional debugging logs throughout the system to make the flow more visible.

## Testing Steps

### 1. Prerequisites

Make sure you have:
- Both servers running:
  ```
  npx @agentdeskai/browser-tools-server@latest
  npx @agentdeskai/browser-tools-mcp@latest
  ```
- Firefox browser installed
- The extension loaded in Firefox (via about:debugging or the package)

### 2. Test Using Console Log Test Page

1. Open Firefox and navigate to the extension's test page:
   ```
   file:///[path-to-repo]/firefox-extension/test-page/console-log-test.html
   ```
   (Replace `[path-to-repo]` with the actual path to your repository)

2. Open Firefox DevTools (F12)

3. Navigate to the "BrowserTools MCP" panel in DevTools

4. Verify the connection status shows "Connected to WebSocket"

5. In the test page, click each button to generate different types of console logs:
   - "Log Simple Message" - Basic string message
   - "Log Object" - JavaScript object
   - "Log Array" - Array with mixed types
   - "Log Error" - Error message (should show in console errors)
   - "Log Warning" - Warning message
   - "Log Complex Data" - Multiple arguments with different types
   - "Network Request" - Triggers an API call (also tests network logging)

6. Check the browser-tools-server terminal output for incoming logs

7. Use an MCP client (e.g., Cursor) to request the logs using commands like:
   ```
   Get console logs
   Get console errors
   ```

### 3. Debugging Flow

If logs aren't appearing, you can trace the flow through these debug messages:

1. In the web page's console:
   - Look for: "[BrowserTools MCP] Console proxy script loaded and active"
   - Look for: "[BrowserTools MCP] Initialization check: Console logging should be active now"
   - If these don't appear, the content script isn't being injected properly

2. In the extension's background page console (access via about:debugging):
   - Look for: "Background: Received console log from content script for tab [id]"
   - Look for: "Background: Console log details: {messageType, level, args, tabId}"
   - If these don't appear, messages from the content script aren't reaching the background

3. In the extension's panel console (right-click in panel and choose "Inspect"):
   - Look for: "Panel: Received message from background: FORWARDED_CONSOLE_LOG"
   - Look for: "Panel: Message details: {type, hasPayload, tabId, from}"
   - Look for: "Panel: Formatted forwarded log entry: [entry]"
   - If these don't appear, messages from the background aren't reaching the panel

4. In the browser-tools-server terminal:
   - Look for: "=== Received Extension Log ==="
   - Look for: "Processing console-log log entry"
   - If these don't appear, messages from the panel aren't reaching the server

### 4. Common Issues

- **No logs in browser-tools-server**: Check if WebSocket connection is established in panel
- **WebSocket connected but no logs**: Verify content script is injected and background forwarding is working
- **Content script not injected**: Check browser console for errors; may need to reload page or extension
- **Panel can't connect to server**: Check the server host/port settings in panel

## Additional Tests

- Try reloading the page to ensure that the console proxy is re-injected correctly
- Test with different Firefox tabs to verify tab-specific logging works
- Test with the browser closed and reopened to ensure persistence
- Try with complex web applications to ensure the extension works with real-world scenarios

If all tests pass, the fix has been successful!