# BrowserTools MCP - Firefox Extension

> Make your AI tools 10x more aware and capable of interacting with your Firefox browser

This is the Firefox port of the BrowserTools MCP extension, which enables AI-powered applications to capture and analyze browser data through Anthropic's Model Context Protocol (MCP).

![BrowserTools MCP Logo](icons/icon-128.svg)

## Features

- **Console Logging**: Capture and analyze browser console output
- **Network Monitoring**: Track XHR/fetch requests, responses, and errors
- **Screenshot Capture**: Take screenshots of the current tab
- **DOM Inspection**: Analyze selected elements (limited in Firefox)
- **Settings Management**: Configure data capture limits and preferences
- **MCP Integration**: Seamless communication with AI tools through MCP

## Installation

### From Firefox Add-ons (Coming Soon)

1. Visit [BrowserTools MCP on Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/)
2. Click "Add to Firefox"
3. Follow the installation prompts

### Manual Installation (Development)

1. Download the latest release ZIP from [GitHub Releases](https://github.com/AgentDeskAI/browser-tools-mcp/releases)
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select the ZIP file or manifest.json from the extracted directory

## Setup

BrowserTools MCP requires three components to function correctly:

1. **Firefox Extension**: This repository/package
2. **Node.js Server**: Acts as middleware between the extension and MCP
   ```bash
   npx @agentdeskai/browser-tools-server@latest
   ```
3. **MCP Server**: Enables AI tools to interact with the browser
   ```bash
   npx @agentdeskai/browser-tools-mcp@latest
   ```

### Quick Start

1. Install the Firefox extension using one of the methods above
2. Open a terminal and run:
   ```bash
   npx @agentdeskai/browser-tools-server@latest
   ```
3. Open another terminal or your IDE integrated terminal and run:
   ```bash
   npx @agentdeskai/browser-tools-mcp@latest
   ```
4. Open Firefox DevTools (F12) and select the "BrowserTools MCP" panel
5. Verify the connection status shows "Connected to WebSocket"
6. Your AI tool (like Cursor) can now interact with your browser!

## Usage

### In Firefox

1. Open the Firefox DevTools panel (F12)
2. Navigate to the "BrowserTools MCP" tab
3. Configure settings as needed:
   - Log Limit: Maximum number of logs to store
   - String Size Limit: Length at which to truncate large strings
   - Show Request/Response Headers: Toggle header visibility
   - Server Host/Port: Connection details (defaults are usually fine)

### In Your AI Tool

You can use commands like:

- "Get console logs"
- "Get network requests"
- "Take a screenshot of my browser"
- "Check for errors in my browser"

The AI tool will connect to the MCP server, which communicates with the browser extension to retrieve the requested information.

## Firefox-Specific Notes

This Firefox port has a few differences from the Chrome version:

1. **WebSocket Monitoring**: Limited compared to Chrome
2. **Redirect Tracking**: Implemented differently due to Firefox's debugging protocol
3. **Element Selection**: More limited capabilities in Firefox
4. **Binary Data Handling**: Enhanced with detailed metadata

For full details on Firefox-specific implementation notes, see [FIREFOX_SPECIFIC_NOTES.md](FIREFOX_SPECIFIC_NOTES.md).

## Testing

We provide comprehensive testing tools and documentation:

- **Automated Testing**: Run `./firefox-dev-testing.sh` to streamline testing with Firefox Developer Edition
- **Firefox Developer Edition Guide**: See [FIREFOX_DEV_TESTING.md](FIREFOX_DEV_TESTING.md) for details
- **Testing Script**: Copy and paste test functions from [test-network-requests.js](test-network-requests.js)
- **Test Plan**: Detailed testing procedures in [test-plan.md](test-plan.md)
- **Final Testing Guide**: Complete validation steps in [FINAL_TESTING_GUIDE.md](FINAL_TESTING_GUIDE.md)

## Troubleshooting

### Common Issues

1. **Connection Failures**:
   - Ensure the browser-tools-server is running
   - Check for correct host/port settings
   - Verify no firewall is blocking connections

2. **Missing Data**:
   - Refresh the page to reinitialize the debugger
   - Check console for any extension errors
   - Ensure the debugger is attached (message will appear in extension panel)

3. **Performance Issues**:
   - Reduce log limits for better performance
   - Disable header capture if not needed
   - Close and reopen DevTools if it becomes unresponsive

### Getting Help

If you encounter issues:

1. Check our [documentation](https://browsertools.agentdesk.ai/)
2. Open an issue on [GitHub](https://github.com/AgentDeskAI/browser-tools-mcp/issues) with the "firefox" label
3. Reach out to [@tedx_ai on X](https://x.com/tedx_ai)

## Development

### Building From Source

1. Clone the repository
2. Navigate to the firefox-extension directory
3. Make your changes
4. Use the packaging script to build:
   ```bash
   cd firefox-extension
   ./package.sh
   ```
5. The packaged extension will be in the `dist` directory

### Contributing

We welcome contributions to improve the Firefox port! See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## License

Same as the main project.

## Acknowledgments

- Based on the Chrome extension by AgentDeskAI
- Firefox WebExtensions API documentation and Mozilla Developer Network
- The open source community for testing and feedback 