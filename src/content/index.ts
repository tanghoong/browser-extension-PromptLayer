/**
 * Content Script - Main entry point for ChatGPT page injection
 */

import { injectToolbar } from './injectToolbar';
import { logger } from '../utils/logger';

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

  logger.log('Initializing on ChatGPT page...');

  try {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      await new Promise((resolve) => {
        document.addEventListener('DOMContentLoaded', resolve);
      });
    }

    // Inject toolbar
    await injectToolbar();

    logger.log('Successfully initialized');
  } catch (error) {
    logger.error('Initialization failed:', error);
  }
}

// Start initialization
initialize();
