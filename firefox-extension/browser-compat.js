/**
 * Browser API Compatibility Layer
 * 
 * This module provides a unified API that works across Chrome and Firefox,
 * abstracting away the differences between their extension APIs.
 */

// Determine if we're in Firefox (has browser namespace) or Chrome
const isFirefox = typeof browser !== 'undefined';

// Create a unified API object
const browserAPI = {
  /**
   * Storage API compatibility
   */
  storage: {
    // Local storage operations
    local: {
      /**
       * Get items from storage
       * @param {string|string[]|object} keys - The keys to get
       * @returns {Promise<object>} - Promise resolving to an object with the requested items
       */
      get: function(keys) {
        if (isFirefox) {
          return browser.storage.local.get(keys);
        } else {
          return new Promise((resolve, reject) => {
            try {
              chrome.storage.local.get(keys, (items) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  resolve(items);
                }
              });
            } catch (e) {
              reject(e);
            }
          });
        }
      },

      /**
       * Set items in storage
       * @param {object} items - Object with items to store
       * @returns {Promise<void>} - Promise that resolves when the operation is complete
       */
      set: function(items) {
        if (isFirefox) {
          return browser.storage.local.set(items);
        } else {
          return new Promise((resolve, reject) => {
            try {
              chrome.storage.local.set(items, () => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  resolve();
                }
              });
            } catch (e) {
              reject(e);
            }
          });
        }
      }
    }
  },

  /**
   * Runtime API compatibility
   */
  runtime: {
    /**
     * Send a message
     * @param {any} message - The message to send
     * @returns {Promise<any>} - Promise that resolves with the response
     */
    sendMessage: function(message) {
      if (isFirefox) {
        return browser.runtime.sendMessage(message);
      } else {
        return new Promise((resolve, reject) => {
          try {
            chrome.runtime.sendMessage(message, (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(response);
              }
            });
          } catch (e) {
            reject(e);
          }
        });
      }
    },

    /**
     * Add a listener for messages
     * @param {Function} callback - Function to call when a message is received
     */
    onMessage: {
      addListener: function(callback) {
        const wrappedCallback = (message, sender, sendResponse) => {
          // Firefox expects promises, Chrome expects sendResponse to be called
          const response = callback(message, sender);
          
          if (response instanceof Promise) {
            if (isFirefox) {
              return response;
            } else {
              response.then(sendResponse);
              return true; // Indicates we'll call sendResponse asynchronously
            }
          }
          
          return response;
        };
        
        if (isFirefox) {
          browser.runtime.onMessage.addListener(wrappedCallback);
        } else {
          chrome.runtime.onMessage.addListener(wrappedCallback);
        }
      }
    }
  },

  /**
   * Tabs API compatibility
   */
  tabs: {
    /**
     * Get a tab by its ID
     * @param {number} tabId - The ID of the tab to get
     * @returns {Promise<object>} - Promise resolving to the tab object
     */
    get: function(tabId) {
      if (isFirefox) {
        return browser.tabs.get(tabId);
      } else {
        return new Promise((resolve, reject) => {
          try {
            chrome.tabs.get(tabId, (tab) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(tab);
              }
            });
          } catch (e) {
            reject(e);
          }
        });
      }
    },

    /**
     * Query for tabs
     * @param {object} queryInfo - The query parameters
     * @returns {Promise<object[]>} - Promise resolving to an array of tab objects
     */
    query: function(queryInfo) {
      if (isFirefox) {
        return browser.tabs.query(queryInfo);
      } else {
        return new Promise((resolve, reject) => {
          try {
            chrome.tabs.query(queryInfo, (tabs) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(tabs);
              }
            });
          } catch (e) {
            reject(e);
          }
        });
      }
    },

    /**
     * Capture a screenshot of a tab
     * @param {number} tabId - The ID of the tab to capture
     * @param {object} options - Screenshot options
     * @returns {Promise<string>} - Promise resolving to a data URL of the screenshot
     */
    captureTab: function(tabId, options = {}) {
      if (isFirefox) {
        return browser.tabs.captureTab(tabId, options);
      } else {
        return new Promise((resolve, reject) => {
          try {
            chrome.tabs.captureVisibleTab(
              null, // windowId - default to current window
              options,
              (dataUrl) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  resolve(dataUrl);
                }
              }
            );
          } catch (e) {
            reject(e);
          }
        });
      }
    }
  },

  /**
   * DevTools API compatibility
   * Note: This is limited as DevTools APIs work differently
   */
  devtools: {
    inspectedWindow: {
      tabId: isFirefox 
        ? browser.devtools?.inspectedWindow?.tabId 
        : chrome.devtools?.inspectedWindow?.tabId
    }
  },

  /**
   * Helper for handling errors
   * @param {Error} error - The error object
   * @returns {string} - Formatted error message
   */
  getErrorMessage: function(error) {
    if (isFirefox) {
      return error.message || String(error);
    } else {
      return chrome.runtime.lastError?.message || error.message || String(error);
    }
  }
};

// Export the API
if (typeof module !== 'undefined' && module.exports) {
  module.exports = browserAPI;
} else {
  window.browserAPI = browserAPI;
} 