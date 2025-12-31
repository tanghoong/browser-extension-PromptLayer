/**
 * Background Service Worker
 * Handles extension lifecycle and background tasks
 */

console.log('[PromptLayer] Background service worker initialized');

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[PromptLayer] Extension installed');
    
    // Open welcome page or setup guide
    // chrome.tabs.create({ url: 'welcome.html' });
  } else if (details.reason === 'update') {
    console.log('[PromptLayer] Extension updated to version', chrome.runtime.getManifest().version);
  }
});

/**
 * Handle messages from content scripts
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[PromptLayer] Message received:', message);

  if (message.type === 'GET_API_KEY') {
    // This would be handled by storage service in content script
    sendResponse({ success: true });
  }

  return true; // Keep message channel open for async response
});

/**
 * Handle extension icon click
 */
chrome.action.onClicked.addListener((tab) => {
  console.log('[PromptLayer] Extension icon clicked', tab);
  
  // Check if on ChatGPT page
  if (tab.url?.includes('chat.openai.com') || tab.url?.includes('chatgpt.com')) {
    // Send message to content script to toggle toolbar
    chrome.tabs.sendMessage(tab.id!, { type: 'TOGGLE_TOOLBAR' });
  }
});
