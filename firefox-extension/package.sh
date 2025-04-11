#!/bin/bash

# Firefox extension packaging script

echo "Packaging Firefox extension..."

# Create output directory if it doesn't exist
mkdir -p ./dist

# Get version from manifest
VERSION=$(grep -o '"version": *"[^"]*"' manifest.json | cut -d'"' -f4)
echo "Extension version: $VERSION"

# Package name
PACKAGE_NAME="BrowserTools-${VERSION}-firefox-extension.zip"

# Create the ZIP file
zip -r "./dist/${PACKAGE_NAME}" \
  manifest.json \
  background.js \
  browser-compat.js \
  devtools.html \
  devtools.js \
  panel.html \
  panel.js \
  icons/

# Check if the packaging was successful
if [ $? -eq 0 ]; then
  echo "--------------------------------"
  echo "✅ Extension packaged successfully"
  echo "Output: ./dist/${PACKAGE_NAME}"
  echo "--------------------------------"
  echo "To test in Firefox:"
  echo "1. Go to about:debugging#/runtime/this-firefox"
  echo "2. Click 'Load Temporary Add-on'"
  echo "3. Select the extension zip file"
  echo ""
  echo "To submit to Firefox Add-ons:"
  echo "1. Go to https://addons.mozilla.org/developers/"
  echo "2. Upload the generated zip file"
else
  echo "❌ Error packaging extension"
fi 