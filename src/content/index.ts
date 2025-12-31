/**
 * Content Script - Main entry point for ChatGPT page injection
 */

import { injectToolbar } from './injectToolbar';

/**
 * Supported ChatGPT domains
 */
const SUPPORTED_DOMAINS = ['chat.openai.com', 'chatgpt.com'];

/**
 * Check if current page is a supported ChatGPT page
 */
function isChatGPTPage(): boolean {
  return SUPPORTED_DOMAINS.some((domain) => window.location.hostname.includes(domain));
}

/**
 * Initialize PromptLayer
 */
async function initialize() {
  if (!isChatGPTPage()) {
    return;
  }

  console.log('[PromptLayer] Initializing on ChatGPT page...');

  try {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      await new Promise((resolve) => {
        document.addEventListener('DOMContentLoaded', resolve);
      });
    }

    // Inject toolbar
    await injectToolbar();

    console.log('[PromptLayer] Successfully initialized');
  } catch (error) {
    console.error('[PromptLayer] Initialization failed:', error);
  }
}

// Start initialization
initialize();
