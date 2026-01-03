/**
 * Logger utility for production-safe logging
 * Logs are only shown in development mode
 */

// In Chrome extension, check if we're in development mode
// This will be replaced by webpack DefinePlugin at build time
const isDevelopment =
  typeof chrome !== 'undefined' && chrome.runtime?.getManifest().version_name?.includes('dev');

export const logger = {
  /**
   * Log general information (development only)
   */
  log(...args: unknown[]): void {
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.log('[PromptLayer]', ...args);
    }
  },

  /**
   * Log errors (always shown)
   */
  error(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.error('[PromptLayer Error]', ...args);
  },

  /**
   * Log warnings (always shown)
   */
  warn(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.warn('[PromptLayer Warning]', ...args);
  },

  /**
   * Log debug information (development only)
   */
  debug(...args: unknown[]): void {
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.debug('[PromptLayer Debug]', ...args);
    }
  },

  /**
   * Log information (development only)
   */
  info(...args: unknown[]): void {
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.info('[PromptLayer Info]', ...args);
    }
  },
};
