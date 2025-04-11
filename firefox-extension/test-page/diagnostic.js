/**
 * BrowserTools Connection Diagnostic Tool
 * 
 * This script provides comprehensive testing for BrowserTools connections:
 * - HTTP server validation
 * - WebSocket connection testing with multiple paths
 * - Path recommendation
 */

// WebSocket paths to test
const PATHS_TO_TEST = [
  '/extension-ws',  // Based on server code inspection
  '/extension',     // Path used originally by browser extension
  '/',              // Root path
  '/ws',            // Common WebSocket path
];

// Connection tracker
const connections = {};
const testResults = {};

// Initialize diagnostics
function initDiagnostics() {
  const logElement = document.getElementById('log');
  const resultsTable = document.getElementById('results-table');
  const serverHost = document.getElementById('server-host');
  const serverPort = document.getElementById('server-port');
  const identityResult = document.getElementById('identity-result');
  const recommendation = document.getElementById('recommendation');
  
  // Log message with timestamp
  function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const entry = document.createElement('div');
    entry.className = type;
    entry.textContent = `[${timestamp}] ${message}`;
    logElement.appendChild(entry);
    logElement.scrollTop = logElement.scrollHeight;
    console.log(`[${type}] ${message}`);
  }
  
  // Clear log
  function clearLog() {
    logElement.innerHTML = '';
  }
  
  // Test server identity
  async function testServerIdentity() {
    const host = serverHost.value;
    const port = serverPort.value;
    const url = `http://${host}:${port}/.identity`;
    
    log(`Testing server identity at ${url}...`);
    identityResult.innerHTML = `<span class="info">Testing...</span>`;
    
    try {
      const startTime = performance.now();
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      
      if (!response.ok) {
        log(`Server identity check failed: ${response.status} ${response.statusText}`, 'error');
        identityResult.innerHTML = `<span class="error">Failed: ${response.status} ${response.statusText}</span>`;
        return null;
      }
      
      const data = await response.json();
      log(`Server identity: ${JSON.stringify(data)}`, 'success');
      
      if (data.signature === 'mcp-browser-connector-24x7') {
        log(`Server signature verified. Version: ${data.version}`, 'success');
        identityResult.innerHTML = `<span class="success">Valid signature: "${data.signature}" - Version ${data.version}</span>`;
        return data;
      } else {
        log(`Invalid server signature: "${data.signature}"`, 'error');
        identityResult.innerHTML = `<span class="error">Invalid signature: "${data.signature}"</span>`;
        return null;
      }
    } catch (error) {
      log(`Error checking server identity: ${error.message}`, 'error');
      identityResult.innerHTML = `<span class="error">Error: ${error.message}</span>`;
      return null;
    }
  }
  
  // Test WebSocket connection for a specific path
  function testWebSocketConnection(path) {
    const host = serverHost.value;
    const port = serverPort.value;
    const url = `ws://${host}:${port}${path}`;
    
    // Close previous connection if exists
    if (connections[path] && connections[path].readyState !== WebSocket.CLOSED) {
      connections[path].close();
    }
    
    // Initialize result entry
    updateResultTable(path, 'Testing', 'Connection test in progress...');
    
    log(`Testing WebSocket connection to ${url}...`);
    
    return new Promise((resolve) => {
      let resolved = false;
      
      // Set timeout
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          log(`Connection timeout for ${url}`, 'error');
          updateResultTable(path, 'Failed', 'Connection timeout');
          
          if (connections[path] && connections[path].readyState !== WebSocket.CLOSED) {
            connections[path].close();
          }
          
          resolve({
            path,
            success: false,
            error: 'Connection timeout',
            timeToFail: 5000
          });
        }
      }, 5000);
      
      try {
        const startTime = performance.now();
        const ws = new WebSocket(url);
        connections[path] = ws;
        
        ws.onopen = () => {
          if (resolved) return;
          
          const endTime = performance.now();
          const connectionTime = Math.round(endTime - startTime);
          
          log(`Connection successful to ${url} (${connectionTime}ms)`, 'success');
          updateResultTable(path, 'Success', `Connected in ${connectionTime}ms`);
          
          // Send a ping message
          try {
            ws.send(JSON.stringify({
              type: 'ping',
              client: 'connection-diagnostic',
              timestamp: Date.now()
            }));
            log(`Ping sent to ${url}`, 'info');
          } catch (e) {
            log(`Error sending ping to ${url}: ${e.message}`, 'error');
          }
          
          // Auto-close after 2 seconds
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.close();
            }
          }, 2000);
          
          clearTimeout(timeout);
          resolved = true;
          resolve({
            path,
            success: true,
            connectionTime,
            url
          });
        };
        
        ws.onclose = (event) => {
          if (resolved) return;
          
          const endTime = performance.now();
          const timeToFail = Math.round(endTime - startTime);
          
          log(`Connection closed: ${url} - Code: ${event.code}`, event.wasClean ? 'info' : 'error');
          updateResultTable(path, 'Failed', `Closed with code ${event.code} (${timeToFail}ms)`);
          
          clearTimeout(timeout);
          resolved = true;
          resolve({
            path,
            success: false,
            error: `Connection closed: ${event.code}`,
            timeToFail
          });
        };
        
        ws.onerror = (error) => {
          if (resolved) return;
          
          const endTime = performance.now();
          const timeToFail = Math.round(endTime - startTime);
          
          log(`Connection error: ${url} - ${error.message || 'Unknown error'}`, 'error');
          updateResultTable(path, 'Failed', `Error: ${error.message || 'Unknown error'}`);
          
          // Don't resolve here, let onclose do it
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            log(`Received response from ${url}: ${JSON.stringify(data)}`, 'success');
          } catch (e) {
            log(`Received non-JSON response from ${url}: ${event.data}`, 'info');
          }
        };
      } catch (error) {
        if (resolved) return;
        
        log(`Error creating WebSocket connection to ${url}: ${error.message}`, 'error');
        updateResultTable(path, 'Failed', `Error: ${error.message}`);
        
        clearTimeout(timeout);
        resolved = true;
        resolve({
          path,
          success: false,
          error: error.message
        });
      }
    });
  }
  
  // Update the result table with test results
  function updateResultTable(path, status, message) {
    // Check if row already exists
    let row = document.getElementById(`result-${path.replace(/\//g, '-')}`);
    
    if (!row) {
      // Create a new row if it doesn't exist
      row = document.createElement('tr');
      row.id = `result-${path.replace(/\//g, '-')}`;
      resultsTable.appendChild(row);
    }
    
    // Set class based on status
    row.className = status.toLowerCase() === 'success' ? 'success' : status.toLowerCase() === 'failed' ? 'error' : '';
    
    // Update row content
    row.innerHTML = `
      <td>${path}</td>
      <td>${status}</td>
      <td>${message}</td>
    `;
  }
  
  // Run all WebSocket tests
  async function runAllTests() {
    const identity = await testServerIdentity();
    
    if (!identity) {
      log('Server identity check failed. WebSocket tests may not succeed.', 'warning');
    }
    
    // Clear previous results
    resultsTable.innerHTML = '';
    
    // Initialize all results as pending
    PATHS_TO_TEST.forEach(path => {
      updateResultTable(path, 'Pending', 'Waiting to test...');
    });
    
    log(`Running WebSocket connection tests for ${PATHS_TO_TEST.length} paths...`, 'info');
    
    // Run tests sequentially to avoid connection conflicts
    const results = [];
    for (const path of PATHS_TO_TEST) {
      const result = await testWebSocketConnection(path);
      results.push(result);
      testResults[path] = result;
      
      // Pause briefly between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Generate recommendation based on results
    generateRecommendation(results);
  }
  
  // Generate connection recommendation
  function generateRecommendation(results) {
    const successfulConnections = results.filter(result => result.success);
    
    if (successfulConnections.length === 0) {
      log('No successful WebSocket connections. Server might not support WebSockets.', 'error');
      recommendation.innerHTML = `
        <span class="error">No successful WebSocket connections were established. Possible issues:</span>
        <ul>
          <li>WebSocket server might not be running on this port</li>
          <li>WebSocket server might have path restrictions</li>
          <li>Firewall or network issues might be blocking WebSocket connections</li>
          <li>CORS or security policies might be preventing connections</li>
        </ul>
        <p>Verify that the server is running and properly configured for WebSocket connections.</p>
      `;
      return;
    }
    
    // Sort by connection time (fastest first)
    successfulConnections.sort((a, b) => a.connectionTime - b.connectionTime);
    const bestConnection = successfulConnections[0];
    
    log(`Best WebSocket connection: ${bestConnection.url} (${bestConnection.connectionTime}ms)`, 'success');
    
    // Firefox extension code snippet
    const firefoxCode = `// Update your WebSocket connection in the Firefox extension
const wsUrl = \`ws://\${settings.serverHost}:\${settings.serverPort}${bestConnection.path}\`;
console.log("Connecting to WebSocket:", wsUrl);
ws = new WebSocket(wsUrl);`;

    recommendation.innerHTML = `
      <div class="success">
        <p><strong>Recommended WebSocket connection:</strong> ${bestConnection.url} (Connected in ${bestConnection.connectionTime}ms)</p>
        <p>This path (${bestConnection.path}) should be used in the Firefox extension.</p>
      </div>
      
      <div>
        <h4>Suggested code update:</h4>
        <pre style="background-color: #f5f5f5; padding: 10px; overflow-x: auto;">${firefoxCode}</pre>
      </div>
    `;
  }
  
  // Expose public API
  return {
    log,
    clearLog,
    testServerIdentity,
    testWebSocketConnection,
    runAllTests
  };
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Make diagnostics globally available
  window.diagnostics = initDiagnostics();
  
  // Set up event listeners
  document.getElementById('test-identity-btn').addEventListener('click', window.diagnostics.testServerIdentity);
  document.getElementById('run-tests-btn').addEventListener('click', window.diagnostics.runAllTests);
  document.getElementById('clear-log-btn').addEventListener('click', window.diagnostics.clearLog);
  
  // Initial log
  window.diagnostics.log('Connection Diagnostic initialized. Click "Test Server Identity" to start.', 'info');
}); 