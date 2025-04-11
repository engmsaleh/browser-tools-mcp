#!/usr/bin/env bash

# Firefox Developer Edition Testing Script
# This script automates testing of the BrowserTools MCP Firefox extension
# in Firefox Developer Edition

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===== BrowserTools MCP Firefox Extension Testing =====${NC}"

# Function to check if Firefox Developer Edition is installed
check_firefox_dev() {
  echo -e "${YELLOW}Checking for Firefox Developer Edition...${NC}"
  
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS path
    if [ -d "/Applications/Firefox Developer Edition.app" ]; then
      FIREFOX_DEV_PATH="/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox"
      echo -e "${GREEN}Firefox Developer Edition found at: ${FIREFOX_DEV_PATH}${NC}"
      return 0
    fi
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux path
    if command -v firefox-developer-edition &> /dev/null; then
      FIREFOX_DEV_PATH="firefox-developer-edition"
      echo -e "${GREEN}Firefox Developer Edition found in PATH${NC}"
      return 0
    elif [ -f "/usr/bin/firefox-developer-edition" ]; then
      FIREFOX_DEV_PATH="/usr/bin/firefox-developer-edition"
      echo -e "${GREEN}Firefox Developer Edition found at: ${FIREFOX_DEV_PATH}${NC}"
      return 0
    fi
  elif [[ "$OSTYPE" == "msys"* || "$OSTYPE" == "win32" ]]; then
    # Windows path (if running in Git Bash or similar)
    if [ -f "/c/Program Files/Firefox Developer Edition/firefox.exe" ]; then
      FIREFOX_DEV_PATH="/c/Program Files/Firefox Developer Edition/firefox.exe"
      echo -e "${GREEN}Firefox Developer Edition found at: ${FIREFOX_DEV_PATH}${NC}"
      return 0
    fi
  fi
  
  echo -e "${RED}Firefox Developer Edition not found. Please install it first.${NC}"
  echo -e "${YELLOW}Download from: https://www.mozilla.org/en-US/firefox/developer/${NC}"
  return 1
}

# Function to create a testing profile
create_testing_profile() {
  echo -e "${YELLOW}Creating a dedicated testing profile...${NC}"
  
  # Set profile directory
  PROFILE_DIR="$(pwd)/firefox-test-profile"
  
  # Create profile directory if it doesn't exist
  mkdir -p "$PROFILE_DIR"
  
  echo -e "${GREEN}Testing profile created at: ${PROFILE_DIR}${NC}"
  return 0
}

# Function to package the extension
package_extension() {
  echo -e "${YELLOW}Packaging the extension...${NC}"
  
  # Check if package.sh exists and is executable
  if [ ! -x "./package.sh" ]; then
    chmod +x ./package.sh
  fi
  
  # Run the packaging script
  ./package.sh
  
  # Check if packaging was successful
  if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to package the extension.${NC}"
    return 1
  fi
  
  # Get the packaged extension path
  VERSION=$(grep -o '"version": *"[^"]*"' manifest.json | cut -d'"' -f4)
  EXTENSION_PATH="$(pwd)/dist/BrowserTools-${VERSION}-firefox-extension.zip"
  
  if [ ! -f "$EXTENSION_PATH" ]; then
    echo -e "${RED}Packaged extension not found at: ${EXTENSION_PATH}${NC}"
    return 1
  fi
  
  echo -e "${GREEN}Extension packaged successfully at: ${EXTENSION_PATH}${NC}"
  return 0
}

# Function to create a test page
create_test_page() {
  echo -e "${YELLOW}Setting up test page...${NC}"

  TEST_DIR="$(pwd)/test-page"
  mkdir -p "$TEST_DIR"

  # Ensure the source auto-test.html exists
  if [ ! -f "$TEST_DIR/auto-test.html" ]; then
    echo -e "${RED}Source test file auto-test.html not found in ${TEST_DIR}${NC}"
    return 1
  fi

  # Copy auto-test.html to index.html for the script to launch
  cp "$TEST_DIR/auto-test.html" "$TEST_DIR/index.html"
  if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to copy auto-test.html to index.html${NC}"
    return 1
  fi

  # No longer need to copy test-network-requests.js as it's embedded
  echo -e "${GREEN}Test page set up at: ${TEST_DIR}/index.html (using embedded JS in auto-test.html)${NC}"
  return 0
}

# Function to launch Firefox Developer Edition
launch_firefox_dev() {
  echo -e "${YELLOW}Launching Firefox Developer Edition with the extension...${NC}"

  # Set the profile directory
  PROFILE_DIR="$(pwd)/firefox-test-profile"

  # Launch Firefox Developer Edition with the test page and debugging page
  TEST_PAGE_URL="file://$(pwd)/test-page/index.html" # Now points to the copied auto-test.html
  DEBUG_URL="about:debugging#/runtime/this-firefox"

  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS: Use the direct path to the executable
    # The 'open -a' command sometimes struggles with multiple URLs
    "$FIREFOX_DEV_PATH" -profile "$PROFILE_DIR" -url "$TEST_PAGE_URL" "$DEBUG_URL"
  else
    # Linux and Windows
    "$FIREFOX_DEV_PATH" -profile "$PROFILE_DIR" -url "$TEST_PAGE_URL" "$DEBUG_URL"
  fi

  echo -e "${GREEN}Firefox Developer Edition launched!${NC}"
  echo -e "${YELLOW}Please follow these steps:${NC}"
  echo -e "1. In the about:debugging page (should open automatically), click 'Load Temporary Add-on'"
  echo -e "2. Navigate to the firefox-extension/dist/ directory and select the BrowserTools-...-firefox-extension.zip file"
  echo -e "3. Once loaded, navigate to the test page tab ('BrowserTools MCP Automated Test')"
  echo -e "4. Tests should start automatically after a few seconds."
  echo -e "5. Monitor the test results directly on the page."

  return 0
}

# Main execution
main() {
  # Change to the directory containing the script
  cd "$(dirname "$0")"
  
  # Check for Firefox Developer Edition
  check_firefox_dev || exit 1
  
  # Create testing profile
  create_testing_profile || exit 1
  
  # Package the extension
  package_extension || exit 1
  
  # Create test page
  create_test_page || exit 1
  
  # Launch Firefox Developer Edition
  launch_firefox_dev || exit 1
  
  echo -e "${GREEN}Setup complete! Follow the instructions above to complete testing.${NC}"
}

# Run main function
main 