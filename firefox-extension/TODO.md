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
- [~] Implement network request monitoring (Implementation added, needs testing)

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
- [~] Adapt network request/response monitoring
  - [x] Implement request/response body content retrieval in Firefox
  - [x] Format network data to match Chrome's format for server compatibility
  - [x] Handle XHR/fetch requests specifically
- [ ] Test and verify proper event handling

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
- [ ] Test basic extension loading
- [ ] Verify DevTools panel appears
- [ ] Test server discovery and connection
- [ ] Verify console log capturing
  - [ ] Test various log types (info, warn, error)
  - [ ] Test with different data types (strings, objects, arrays)
  - [ ] Verify logs appear in the server interface
- [ ] Test network request monitoring
  - [ ] Test XHR requests
  - [ ] Test fetch requests
  - [ ] Verify request/response details are captured
  - [ ] Verify errors are correctly reported
- [ ] Verify screenshot functionality
- [ ] Test settings persistence
- [ ] End-to-end test with MCP server integration

## Implementation Sequence
1. ✅ Create basic extension structure and manifest
2. ✅ Implement API compatibility layer
3. ✅ Port background script with basic functionality
4. ✅ Add DevTools panel UI
5. ✅ Implement console logging
6. ⬜ Add network monitoring
   - ✅ Enhance Network.* event handlers
   - ✅ Implement request/response body retrieval
   - ✅ Format data for server compatibility
   - ⬜ Test with different request types
7. ✅ Add screenshot functionality
8. ✅ Implement settings and persistence
9. ✅ Add server discovery mechanisms
10. ⬜ Comprehensive testing and debugging

## Next Steps
- Test console log capturing implementation
- Test network request monitoring implementation
- Set up packaging for Firefox Add-ons
- Create icons for the extension
- Test in Firefox Developer Edition
- Add documentation for Firefox-specific changes

## Resources
- [Firefox WebExtensions API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [Firefox Debugging Protocol](https://firefox-source-docs.mozilla.org/devtools-user/remote_debugging/index.html)
- [Browser Extension Porting Guide](https://extensionworkshop.com/documentation/develop/porting-a-google-chrome-extension/)
- [Firefox Debugger API](https://firefox-source-docs.mozilla.org/devtools-user/debugger-api/index.html) 