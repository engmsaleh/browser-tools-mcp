/**
 * Test Network Requests Script
 * 
 * This script provides functions to test various types of network requests
 * for validating the Firefox extension's network monitoring functionality.
 * 
 * Usage:
 * 1. Copy and paste this entire script into the Firefox DevTools Console
 * 2. Call any of the test functions (e.g., testXhrGet())
 */

const BrowserToolsTest = {
  // Base URL for testing
  baseUrl: 'https://jsonplaceholder.typicode.com',
  
  /**
   * Test simple XHR GET request
   */
  testXhrGet: function() {
    console.log('🧪 Testing XHR GET request...');
    
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `${this.baseUrl}/posts/1`, true);
    
    xhr.onload = function() {
      if (xhr.status >= 200 && xhr.status < 300) {
        console.log('✅ XHR GET request successful:', JSON.parse(xhr.responseText));
      } else {
        console.error('❌ XHR GET request failed:', xhr.status, xhr.statusText);
      }
    };
    
    xhr.onerror = function() {
      console.error('❌ XHR GET network error');
    };
    
    xhr.send();
  },
  
  /**
   * Test XHR POST request with JSON body
   */
  testXhrPost: function() {
    console.log('🧪 Testing XHR POST request with JSON body...');
    
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${this.baseUrl}/posts`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    
    xhr.onload = function() {
      if (xhr.status >= 200 && xhr.status < 300) {
        console.log('✅ XHR POST request successful:', JSON.parse(xhr.responseText));
      } else {
        console.error('❌ XHR POST request failed:', xhr.status, xhr.statusText);
      }
    };
    
    xhr.onerror = function() {
      console.error('❌ XHR POST network error');
    };
    
    const data = JSON.stringify({
      title: 'Browser Tools Test',
      body: 'This is a test POST request',
      userId: 1
    });
    
    xhr.send(data);
  },
  
  /**
   * Test Fetch GET request
   */
  testFetchGet: function() {
    console.log('🧪 Testing Fetch GET request...');
    
    fetch(`${this.baseUrl}/todos/1`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('✅ Fetch GET request successful:', data);
      })
      .catch(error => {
        console.error('❌ Fetch GET request failed:', error);
      });
  },
  
  /**
   * Test Fetch POST request with JSON body
   */
  testFetchPost: function() {
    console.log('🧪 Testing Fetch POST request with JSON body...');
    
    fetch(`${this.baseUrl}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Header': 'FirefoxExtensionTest'
      },
      body: JSON.stringify({
        title: 'Browser Tools Test Fetch',
        body: 'This is a test Fetch POST request',
        userId: 1
      })
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('✅ Fetch POST request successful:', data);
      })
      .catch(error => {
        console.error('❌ Fetch POST request failed:', error);
      });
  },
  
  /**
   * Test error response handling
   */
  testErrorResponse: function() {
    console.log('🧪 Testing error response handling...');
    
    fetch(`${this.baseUrl}/nonexistent-endpoint`)
      .then(response => {
        if (!response.ok) {
          console.log(`✅ Expected error status received: ${response.status}`);
          return response.text();
        }
        return response.json();
      })
      .then(data => {
        console.log('Response data:', data);
      })
      .catch(error => {
        console.error('❌ Request error:', error);
      });
  },
  
  /**
   * Test binary data request
   */
  testBinaryData: function() {
    console.log('🧪 Testing binary data (image) request...');
    
    fetch('https://picsum.photos/200')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.blob();
      })
      .then(blob => {
        console.log(`✅ Binary data received: ${blob.size} bytes, type: ${blob.type}`);
      })
      .catch(error => {
        console.error('❌ Binary data request failed:', error);
      });
  },
  
  /**
   * Test multiple concurrent requests
   */
  testConcurrentRequests: function() {
    console.log('🧪 Testing multiple concurrent requests...');
    
    Promise.all([
      fetch(`${this.baseUrl}/posts/1`).then(r => r.json()),
      fetch(`${this.baseUrl}/posts/2`).then(r => r.json()),
      fetch(`${this.baseUrl}/posts/3`).then(r => r.json())
    ])
      .then(dataArray => {
        console.log('✅ All concurrent requests successful:', dataArray);
      })
      .catch(error => {
        console.error('❌ Concurrent requests failed:', error);
      });
  },
  
  /**
   * Test redirect handling
   */
  testRedirect: function() {
    console.log('🧪 Testing redirect handling...');
    
    fetch('https://httpstat.us/302')
      .then(response => {
        console.log(`✅ Redirect followed. Final URL: ${response.url}, status: ${response.status}`);
        return response.text();
      })
      .then(text => {
        console.log('Response text:', text);
      })
      .catch(error => {
        console.error('❌ Redirect test failed:', error);
      });
  },
  
  /**
   * Run all tests in sequence
   */
  runAllTests: function() {
    console.log('🧪🧪🧪 Running all network request tests 🧪🧪🧪');
    
    // Run tests with slight delays to avoid overwhelming the browser
    this.testXhrGet();
    
    setTimeout(() => this.testXhrPost(), 1000);
    setTimeout(() => this.testFetchGet(), 2000);
    setTimeout(() => this.testFetchPost(), 3000);
    setTimeout(() => this.testErrorResponse(), 4000);
    setTimeout(() => this.testBinaryData(), 5000);
    setTimeout(() => this.testConcurrentRequests(), 6000);
    setTimeout(() => this.testRedirect(), 7000);
    
    console.log('🧪 All tests have been queued and will run sequentially');
  }
};

// Instructions for using this in the console
console.log(`
Browser Tools Network Test Script loaded!

Available test functions:
- BrowserToolsTest.testXhrGet()
- BrowserToolsTest.testXhrPost()
- BrowserToolsTest.testFetchGet()
- BrowserToolsTest.testFetchPost()
- BrowserToolsTest.testErrorResponse()
- BrowserToolsTest.testBinaryData()
- BrowserToolsTest.testConcurrentRequests()
- BrowserToolsTest.testRedirect()
- BrowserToolsTest.runAllTests()

Example: BrowserToolsTest.runAllTests()
`); 