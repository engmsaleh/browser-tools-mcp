// Controller script to communicate with test page
(() => {
  // Wait for BrowserTools panel to initialize
  const checkInterval = setInterval(() => {
    // Check for the BrowserTools panel being open
    const browserToolsPanel = document.querySelector('.devtools-browsertools-mcp');
    
    if (browserToolsPanel || document.querySelector('#browsertools-panel')) {
      clearInterval(checkInterval);
      console.log('BrowserTools panel detected, starting tests...');
      
      // Find the test tab
      chrome.tabs.query({url: "**/auto-test.html"}, (tabs) => {
        if (tabs && tabs.length > 0) {
          // Send message to test page to start testing
          chrome.tabs.sendMessage(tabs[0].id, {type: 'run-tests'});
        } else {
          console.error('Test page not found');
        }
      });
    }
  }, 1000);
  
  // After 30 seconds, give up
  setTimeout(() => {
    clearInterval(checkInterval);
    console.error('Timed out waiting for BrowserTools panel');
  }, 30000);
})();
