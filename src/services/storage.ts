/**
 * Storage Service - Chrome Storage API wrapper
 * Handles all data persistence for prompts, settings, roles, and API keys
 */

import type { Prompt, ExtensionSettings, RoleBlueprint, UsageStats } from '../types';
import { StorageKey, ErrorType, PromptLayerError } from '../types';
import { logger } from '../utils/logger';

/**
 * Default settings for the extension
 */
const DEFAULT_SETTINGS: ExtensionSettings = {
  model: 'gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 800,
  theme: 'auto',
  toolbarCollapsed: false,
  keyboardShortcutsEnabled: true,
};

/**
 * Default usage statistics
 */
const DEFAULT_STATS: UsageStats = {
  enhancementsPerformed: 0,
  promptsSaved: 0,
  mostUsedRole: '',
  totalApiCalls: 0,
  averageEnhancementTime: 0,
  lastResetDate: new Date(),
  totalTokensUsed: 0,
  totalCostUSD: 0,
  monthlyCostUSD: 0,
  currentMonth: new Date().toISOString().slice(0, 7),
};

/**
 * Storage service class
 */
class StorageService {
  private saveOperationTimestamps: number[] = [];
  private readonly MAX_SAVES_PER_MINUTE = 30;
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute

  /**
   * Check rate limiting for storage write operations
   */
  private checkWriteRateLimit(): void {
    const now = Date.now();
    const windowStart = now - this.RATE_LIMIT_WINDOW;

    // Remove timestamps outside the current window
    this.saveOperationTimestamps = this.saveOperationTimestamps.filter(
      (timestamp) => timestamp > windowStart
    );

    // Check if we've exceeded the rate limit
    if (this.saveOperationTimestamps.length >= this.MAX_SAVES_PER_MINUTE) {
      throw new PromptLayerError(
        ErrorType.STORAGE_RATE_LIMIT,
        'Storage rate limit exceeded',
        'Too many storage operations. Please wait a moment before trying again.'
      );
    }

    // Add current operation timestamp
    this.saveOperationTimestamps.push(now);
  }

  /**
   * Encrypt a string (API keys) using AES-GCM via Web Crypto API
   * This provides strong encryption for sensitive data like API keys
   */
  private async encrypt(value: string): Promise<string> {
    try {
      // Generate a random encryption key from extension ID
      const extensionId = chrome.runtime.id || 'default-extension-id';
      const keyMaterial = await this.getKeyMaterial(extensionId);

      // Generate a random IV (initialization vector)
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Encrypt the data
      const encoder = new TextEncoder();
      const data = encoder.encode(value);
      const encryptedData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyMaterial, data);

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encryptedData.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedData), iv.length);

      // Convert to base64 for storage
      return this.arrayBufferToBase64(combined);
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new PromptLayerError(
        ErrorType.UNKNOWN_ERROR,
        'Failed to encrypt data',
        'Could not secure your API key. Please try again.'
      );
    }
  }

  /**
   * Decrypt a string encrypted with AES-GCM
   */
  private async decrypt(value: string): Promise<string> {
    try {
      // Convert base64 back to array buffer
      const combined = this.base64ToArrayBuffer(value);

      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encryptedData = combined.slice(12);

      // Get encryption key
      const extensionId = chrome.runtime.id || 'default-extension-id';
      const keyMaterial = await this.getKeyMaterial(extensionId);

      // Decrypt the data
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        keyMaterial,
        encryptedData
      );

      // Convert back to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      // Try legacy XOR decryption for backward compatibility
      try {
        return this.decryptLegacyXOR(value);
      } catch (legacyError) {
        // Both decryption methods failed - throw error instead of returning raw value
        logger.error('Decryption failed:', error);
        throw new PromptLayerError(
          ErrorType.UNKNOWN_ERROR,
          'Failed to decrypt data',
          'Could not decrypt your API key. Please re-enter it in settings.'
        );
      }
    }
  }

  /**
   * Legacy XOR decryption for backward compatibility
   */
  private decryptLegacyXOR(value: string): string {
    try {
      const decoded = atob(value);
      const salt = 'promptlayer-2024';
      const extensionId = chrome.runtime.id || 'default';
      const key = `${extensionId}-${salt}`;

      let decrypted = '';
      for (let i = 0; i < decoded.length; i++) {
        const keyChar = key.charCodeAt(i % key.length);
        const valueChar = decoded.charCodeAt(i);
        decrypted += String.fromCharCode((valueChar ^ keyChar) & 0xff);
      }
      return decrypted;
    } catch {
      throw new Error('Legacy decryption failed');
    }
  }

  /**
   * Derive a cryptographic key from extension ID
   */
  private async getKeyMaterial(password: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password.padEnd(32, '0').slice(0, 32)),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('promptlayer-salt-v1'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const len = buffer.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Get API key from storage
   */
  async getApiKey(): Promise<string | null> {
    try {
      const result = await chrome.storage.local.get(StorageKey.API_KEY);
      const encryptedKey = result[StorageKey.API_KEY];
      return encryptedKey ? await this.decrypt(encryptedKey) : null;
    } catch (error) {
      logger.error('Error getting API key:', error);
      return null;
    }
  }

  /**
   * Set API key in storage
   */
  async setApiKey(apiKey: string): Promise<void> {
    try {
      this.checkWriteRateLimit();
      const encrypted = await this.encrypt(apiKey);
      await chrome.storage.local.set({ [StorageKey.API_KEY]: encrypted });
    } catch (error) {
      if (error instanceof PromptLayerError) throw error;
      logger.error('Error setting API key:', error);
      throw new PromptLayerError(
        ErrorType.UNKNOWN_ERROR,
        'Failed to save API key',
        'Could not save your API key. Please try again.'
      );
    }
  }

  /**
   * Clear API key from storage
   */
  async clearApiKey(): Promise<void> {
    try {
      await chrome.storage.local.remove(StorageKey.API_KEY);
    } catch (error) {
      logger.error('Error clearing API key:', error);
    }
  }

  /**
   * Get all settings
   */
  async getSettings(): Promise<ExtensionSettings> {
    try {
      const result = await chrome.storage.local.get(StorageKey.SETTINGS);
      const settings = result[StorageKey.SETTINGS];
      return settings ? { ...DEFAULT_SETTINGS, ...settings } : DEFAULT_SETTINGS;
    } catch (error) {
      logger.error('Error getting settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Update settings
   */
  async updateSettings(updates: Partial<ExtensionSettings>): Promise<void> {
    try {
      this.checkWriteRateLimit();
      const currentSettings = await this.getSettings();
      const newSettings = { ...currentSettings, ...updates };
      await chrome.storage.local.set({ [StorageKey.SETTINGS]: newSettings });
    } catch (error) {
      if (error instanceof PromptLayerError) throw error;
      logger.error('Error updating settings:', error);
      throw new PromptLayerError(
        ErrorType.UNKNOWN_ERROR,
        'Failed to update settings',
        'Could not save your settings. Please try again.'
      );
    }
  }

  /**
   * Get all prompts
   */
  async getPrompts(): Promise<Prompt[]> {
    try {
      const result = await chrome.storage.local.get(StorageKey.PROMPTS);
      return result[StorageKey.PROMPTS] || [];
    } catch (error) {
      logger.error('Error getting prompts:', error);
      return [];
    }
  }

  /**
   * Get a single prompt by ID
   */
  async getPrompt(id: string): Promise<Prompt | null> {
    const prompts = await this.getPrompts();
    return prompts.find((p) => p.id === id) || null;
  }

  /**
   * Save a new prompt with rate limiting
   */
  async savePrompt(prompt: Prompt): Promise<void> {
    try {
      // Check rate limit
      this.checkWriteRateLimit();

      const prompts = await this.getPrompts();

      // Check storage quota (warn at 400, max at 500)
      if (prompts.length >= 500) {
        throw new PromptLayerError(
          ErrorType.STORAGE_QUOTA_EXCEEDED,
          'Maximum prompt limit reached',
          'You have reached the maximum of 500 prompts. Please delete some prompts or export them as backup.'
        );
      }

      prompts.push(prompt);
      await chrome.storage.local.set({ [StorageKey.PROMPTS]: prompts });
    } catch (error) {
      if (error instanceof PromptLayerError) throw error;
      logger.error('Error saving prompt:', error);
      throw new PromptLayerError(
        ErrorType.UNKNOWN_ERROR,
        'Failed to save prompt',
        'Could not save your prompt. Please try again.'
      );
    }
  }

  /**
   * Update an existing prompt
   */
  async updatePrompt(id: string, updates: Partial<Prompt>): Promise<void> {
    try {
      this.checkWriteRateLimit();
      const prompts = await this.getPrompts();
      const index = prompts.findIndex((p) => p.id === id);

      if (index === -1) {
        throw new PromptLayerError(
          ErrorType.INVALID_INPUT,
          'Prompt not found',
          'The prompt you are trying to update does not exist.'
        );
      }

      prompts[index] = { ...prompts[index], ...updates, updatedAt: new Date() };
      await chrome.storage.local.set({ [StorageKey.PROMPTS]: prompts });
    } catch (error) {
      if (error instanceof PromptLayerError) throw error;
      logger.error('Error updating prompt:', error);
      throw new PromptLayerError(
        ErrorType.UNKNOWN_ERROR,
        'Failed to update prompt',
        'Could not update your prompt. Please try again.'
      );
    }
  }

  /**
   * Delete a prompt
   */
  async deletePrompt(id: string): Promise<void> {
    try {
      this.checkWriteRateLimit();
      const prompts = await this.getPrompts();
      const filtered = prompts.filter((p) => p.id !== id);
      await chrome.storage.local.set({ [StorageKey.PROMPTS]: filtered });
    } catch (error) {
      if (error instanceof PromptLayerError) throw error;
      logger.error('Error deleting prompt:', error);
      throw new PromptLayerError(
        ErrorType.UNKNOWN_ERROR,
        'Failed to delete prompt',
        'Could not delete your prompt. Please try again.'
      );
    }
  }

  /**
   * Get all role blueprints
   */
  async getRoles(): Promise<RoleBlueprint[]> {
    try {
      const result = await chrome.storage.local.get(StorageKey.ROLES);
      return result[StorageKey.ROLES] || [];
    } catch (error) {
      logger.error('Error getting roles:', error);
      return [];
    }
  }

  /**
   * Save role blueprints
   */
  async saveRoles(roles: RoleBlueprint[]): Promise<void> {
    try {
      await chrome.storage.local.set({ [StorageKey.ROLES]: roles });
    } catch (error) {
      logger.error('Error saving roles:', error);
      throw new PromptLayerError(
        ErrorType.UNKNOWN_ERROR,
        'Failed to save roles',
        'Could not save role blueprints. Please try again.'
      );
    }
  }

  /**
   * Get usage statistics
   */
  async getStats(): Promise<UsageStats> {
    try {
      const result = await chrome.storage.local.get(StorageKey.STATS);
      return result[StorageKey.STATS] || DEFAULT_STATS;
    } catch (error) {
      logger.error('Error getting stats:', error);
      return DEFAULT_STATS;
    }
  }

  /**
   * Update usage statistics
   */
  async updateStats(updates: Partial<UsageStats>): Promise<void> {
    try {
      const currentStats = await this.getStats();
      const newStats = { ...currentStats, ...updates };
      await chrome.storage.local.set({ [StorageKey.STATS]: newStats });
    } catch (error) {
      logger.error('Error updating stats:', error);
    }
  }

  /**
   * Reset usage statistics
   */
  async resetStats(): Promise<void> {
    try {
      await chrome.storage.local.set({ [StorageKey.STATS]: DEFAULT_STATS });
    } catch (error) {
      logger.error('Error resetting stats:', error);
    }
  }

  /**
   * Get storage quota information
   */
  async getStorageQuota(): Promise<{ used: number; available: number; percentage: number }> {
    try {
      const bytesInUse = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES || 10485760; // 10MB default
      const percentage = (bytesInUse / quota) * 100;

      return {
        used: bytesInUse,
        available: quota - bytesInUse,
        percentage,
      };
    } catch (error) {
      logger.error('Error getting storage quota:', error);
      return { used: 0, available: 0, percentage: 0 };
    }
  }

  /**
   * Export all data as JSON
   */
  async exportData(): Promise<string> {
    try {
      const [prompts, roles, settings, stats] = await Promise.all([
        this.getPrompts(),
        this.getRoles(),
        this.getSettings(),
        this.getStats(),
      ]);

      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        prompts,
        roles,
        settings,
        stats,
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      logger.error('Error exporting data:', error);
      throw new PromptLayerError(
        ErrorType.UNKNOWN_ERROR,
        'Failed to export data',
        'Could not export your data. Please try again.'
      );
    }
  }

  /**
   * Import data from JSON
   */
  async importData(
    jsonData: string,
    mergeStrategy: 'replace' | 'merge' = 'merge'
  ): Promise<{
    promptsImported: number;
    rolesImported: number;
  }> {
    try {
      const importData = JSON.parse(jsonData);

      let promptsImported = 0;
      let rolesImported = 0;

      if (importData.prompts) {
        if (mergeStrategy === 'replace') {
          await chrome.storage.local.set({ [StorageKey.PROMPTS]: importData.prompts });
          promptsImported = importData.prompts.length;
        } else {
          const existingPrompts = await this.getPrompts();
          const existingIds = new Set(existingPrompts.map((p) => p.id));
          const newPrompts = importData.prompts.filter((p: Prompt) => !existingIds.has(p.id));

          await chrome.storage.local.set({
            [StorageKey.PROMPTS]: [...existingPrompts, ...newPrompts],
          });
          promptsImported = newPrompts.length;
        }
      }

      if (importData.roles) {
        await chrome.storage.local.set({ [StorageKey.ROLES]: importData.roles });
        rolesImported = importData.roles.length;
      }

      return { promptsImported, rolesImported };
    } catch (error) {
      logger.error('Error importing data:', error);
      throw new PromptLayerError(
        ErrorType.INVALID_INPUT,
        'Failed to import data',
        'The import file is invalid or corrupted. Please check the file and try again.'
      );
    }
  }
}

// Export singleton instance
export const storageService = new StorageService();
