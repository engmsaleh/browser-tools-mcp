# Firefox Extension Port - TODO List

## Project Overview
Port the Chrome-based BrowserTools MCP extension to Firefox, maintaining all functionality while adapting to Firefox's extension APIs.

## Setup Tasks
- [x] Create firefox-extension directory
- [x] Set up basic extension structure
- [x] Create initial manifest.json for Firefox

## Core Components to Port

### 1. Extension Structure
- [x] Adapt manifest.json to Firefox (Manifest V2)
- [x] Set up proper permissions model
- [x] Configure devtools integration

### 2. Background Script
- [x] Port background.js with Firefox Promise-based APIs
- [x] Adapt tab tracking functionality
- [x] Implement server communication and validation
- [x] Port screenshot capture functionality

### 3. DevTools Integration
- [x] Port devtools.html with Firefox-compatible code
- [x] Adapt devtools.js to use Firefox's debugging protocol
- [x] Implement console log capturing (Basic implementation complete, needs testing)
- [x] Implement network request monitoring (Implementation completed with enhanced error handling)

### 4. Panel UI
- [x] Port panel.html (should work mostly as-is)
- [x] Adapt panel.js to use Firefox storage APIs
- [x] Implement server discovery mechanism
- [x] Add connection status indicators

### 5. Browser API Compatibility Layer
- [x] Create helper functions for cross-browser compatibility
- [x] Implement Promise-based wrappers for callbacks
- [x] Handle Firefox-specific API differences

## Technical Challenges

### Debugger Protocol
- [x] Research Firefox debugging protocol differences from CDP
- [x] Adapt console message listeners (Basic implementation in place)
- [x] Adapt network request/response monitoring
  - [x] Implement request/response body content retrieval in Firefox
  - [x] Format network data to match Chrome's format for server compatibility
  - [x] Handle XHR/fetch requests specifically
  - [x] Improve error handling for network events
  - [x] Enhance binary data representation with file type and size details
  - [x] Improve redirect chain tracking
- [x] Test and verify proper event handling

### Screenshot Functionality
- [x] Implement using browser.tabs.captureTab() API
- [x] Handle permission and security constraints
- [x] Test screenshot capture and transfer to server

### WebSocket Communication
- [x] Port WebSocket connection management
- [x] Implement reconnection logic
- [x] Add progress and status indicators

### Storage and Settings
- [x] Port extension settings using browser.storage.local
- [x] Adapt settings UI for Firefox
- [x] Implement proper data persistence

## Testing Plan
- [x] Test basic extension loading
- [x] Verify DevTools panel appears
- [x] Test server discovery and connection
- [x] Verify console log capturing
  - [x] Test various log types (info, warn, error)
  - [x] Test with different data types (strings, objects, arrays)
  - [x] Verify logs appear in the server interface
- [x] Test network request monitoring
  - [x] Test XHR requests
  - [x] Test fetch requests
  - [x] Test requests with different content types (JSON, text, binary)
  - [x] Verify request/response details are captured
  - [x] Verify errors are correctly reported
  - [x] Test with the detailed test plan in test-plan.md
  - [x] Document results in test-results.md
- [x] Verify screenshot functionality
- [x] Test settings persistence
- [x] End-to-end test with MCP server integration

## Implementation Sequence
1. ✅ Create basic extension structure and manifest
2. ✅ Implement API compatibility layer
3. ✅ Port background script with basic functionality
4. ✅ Add DevTools panel UI
5. ✅ Implement console logging
6. ✅ Add network monitoring
   - ✅ Enhance Network.* event handlers
   - ✅ Implement request/response body retrieval
   - ✅ Format data for server compatibility
   - ✅ Improve error handling and response processing
   - ✅ Enhance binary data representation
   - ✅ Improve redirect tracking
   - ✅ Test with different request types
7. ✅ Add screenshot functionality
8. ✅ Implement settings and persistence
9. ✅ Add server discovery mechanisms
10. ✅ Comprehensive testing and debugging

## Next Steps
- [x] Execute the network monitoring test plan (test-plan.md)
- [x] Document Firefox-specific behaviors discovered during testing (test-results.md)
- [x] Create Firefox-specific icons for the extension
- [x] Set up packaging for Firefox Add-ons
- [x] Add documentation for Firefox-specific changes (FIREFOX_SPECIFIC_NOTES.md)
- [x] Create final testing guide (FINAL_TESTING_GUIDE.md)
- [x] Test in Firefox Developer Edition with final package
- [x] Create automated testing script for Firefox Developer Edition (firefox-dev-testing.sh)
- [x] Document Firefox Developer Edition testing process (FIREFOX_DEV_TESTING.md)
- [ ] Submit to Firefox Add-ons for review

## Project Completion Status

The Firefox port of BrowserTools MCP is now ready for final testing and submission. All core functionality has been implemented, significant API differences and debugging protocol challenges have been addressed, and the extension has been packaged.

### Documentation
- [x] TODO.md - Tracking progress and tasks
- [x] README.md - General installation and usage

### Known Firefox-Specific Limitations

(Consolidated from `FIREFOX_SPECIFIC_NOTES.md`)

1.  **Network Event Timing**: Firefox reports slightly different timing for network events compared to Chrome.
2.  **WebSocket Monitoring**: More limited capabilities; cannot capture the full content of WebSocket messages (though connection events are tracked).
3.  **Redirect Tracking**: While improved, redirect chains might not capture every intermediate step compared to Chrome's event model.
4.  **Element Selection**: The implementation for selected element inspection (`devtools.js`) is limited compared to Chrome.
5.  **Response Handling**: Some complex responses might be formatted differently.
6.  **Binary Data**: Firefox handles binary data differently, which affects how it's displayed (though metadata like type/size is captured).

## Resources

(Consolidated from `FIREFOX_SPECIFIC_NOTES.md`)

- [Firefox WebExtensions API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [Firefox Debugger API](https://firefox-source-docs.mozilla.org/devtools-user/debugger-api/index.html)
- [Firefox Debugging Protocol](https://firefox-source-docs.mozilla.org/devtools-user/remote_debugging/index.html)
- [Browser Extension Porting Guide](https://extensionworkshop.com/documentation/develop/porting-a-google-chrome-extension/)
- [Mozilla Add-ons Documentation](https://extensionworkshop.com/)


// End of file 