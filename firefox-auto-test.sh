#!/bin/bash

# Firefox Auto-Test Script
# This script automates testing the Firefox extension with the BrowserTools server

# Configuration
FIREFOX_DEV_PATH="/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox"
EXTENSION_DIR="$(pwd)/firefox-extension"
PROFILE_NAME="browser-tools-test"
PROFILE_PATH="/tmp/firefox-dev-profile-$PROFILE_NAME"
SERVER_HOST="localhost"
SERVER_PORT="3025"

# Check if Firefox Developer Edition is installed
if [ ! -f "$FIREFOX_DEV_PATH" ]; then
  echo "Firefox Developer Edition not found at $FIREFOX_DEV_PATH"
  echo "Please install Firefox Developer Edition or update the path in this script."
  exit 1
fi

# Create Firefox profile if it doesn't exist
if [ ! -d "$PROFILE_PATH" ]; then
  echo "Creating Firefox test profile at $PROFILE_PATH..."
  mkdir -p "$PROFILE_PATH"
fi

# Package the extension
echo "Packaging the extension..."
cd "$EXTENSION_DIR" && zip -r ../firefox-extension.zip * && cd -

# Launch Firefox with the test profile and load testing pages
echo "Launching Firefox Developer Edition with test profile..."
"$FIREFOX_DEV_PATH" -profile "$PROFILE_PATH" \
  -url "about:debugging#/runtime/this-firefox" \
  -new-tab "http://$SERVER_HOST:$SERVER_PORT/.identity" \
  -new-tab "file://$(pwd)/firefox-extension/test-page/connection-diagnostic.html" \
  -new-tab "file://$(pwd)/firefox-extension/test-page/websocket-test.html" \
  -new-tab "file://$(pwd)/firefox-extension/test-page/log-inspector.html"

echo "Firefox Developer Edition launched with test profile and extension."
echo ""
echo "Testing Instructions:"
echo "1. Go to about:debugging#/runtime/this-firefox"
echo "2. Click 'Load Temporary Add-on' and select any file in the extension directory"
echo "3. Use the diagnostic tools to verify connection"
echo ""
echo "Diagnostic tools available at:"
echo "- Connection diagnostic: file://$(pwd)/firefox-extension/test-page/connection-diagnostic.html"
echo "- WebSocket test: file://$(pwd)/firefox-extension/test-page/websocket-test.html"
echo "- Log inspector: file://$(pwd)/firefox-extension/test-page/log-inspector.html" 