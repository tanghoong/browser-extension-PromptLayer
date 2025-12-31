/**
 * Storage Service - Chrome Storage API wrapper
 * Handles all data persistence for prompts, settings, roles, and API keys
 */

import type { Prompt, ExtensionSettings, RoleBlueprint, UsageStats } from '../types';
import { StorageKey, ErrorType, PromptLayerError } from '../types';

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
  /**
   * Encrypt a string (API keys) using XOR with a derived key
   * Note: This provides obfuscation, not true encryption. For better security,
   * consider using chrome.storage.session which is more secure.
   */
  private encrypt(value: string): string {
    // Use a combination of extension ID and a fixed salt for key derivation
    const salt = 'promptlayer-2024';
    const extensionId = chrome.runtime.id || 'default';
    const key = `${extensionId}-${salt}`;

    // XOR encryption with rotating key
    let encrypted = '';
    for (let i = 0; i < value.length; i++) {
      const keyChar = key.charCodeAt(i % key.length);
      const valueChar = value.charCodeAt(i);
      encrypted += String.fromCharCode(valueChar ^ keyChar);
    }

    // Base64 encode to make it storable
    return btoa(encrypted);
  }

  /**
   * Decrypt a string
   */
  private decrypt(value: string): string {
    try {
      // Base64 decode first
      const decoded = atob(value);

      // Use same key derivation
      const salt = 'promptlayer-2024';
      const extensionId = chrome.runtime.id || 'default';
      const key = `${extensionId}-${salt}`;

      // XOR decryption (same operation as encryption for XOR)
      let decrypted = '';
      for (let i = 0; i < decoded.length; i++) {
        const keyChar = key.charCodeAt(i % key.length);
        const valueChar = decoded.charCodeAt(i);
        decrypted += String.fromCharCode(valueChar ^ keyChar);
      }

      return decrypted;
    } catch {
      return value; // Return as-is if decryption fails (backward compatibility)
    }
  }

  /**
   * Get API key from storage
   */
  async getApiKey(): Promise<string | null> {
    try {
      const result = await chrome.storage.local.get(StorageKey.API_KEY);
      const encryptedKey = result[StorageKey.API_KEY];
      return encryptedKey ? this.decrypt(encryptedKey) : null;
    } catch (error) {
      console.error('Error getting API key:', error);
      return null;
    }
  }

  /**
   * Set API key in storage
   */
  async setApiKey(apiKey: string): Promise<void> {
    try {
      const encrypted = this.encrypt(apiKey);
      await chrome.storage.local.set({ [StorageKey.API_KEY]: encrypted });
    } catch (error) {
      console.error('Error setting API key:', error);
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
      console.error('Error clearing API key:', error);
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
      console.error('Error getting settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Update settings
   */
  async updateSettings(updates: Partial<ExtensionSettings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const newSettings = { ...currentSettings, ...updates };
      await chrome.storage.local.set({ [StorageKey.SETTINGS]: newSettings });
    } catch (error) {
      console.error('Error updating settings:', error);
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
      console.error('Error getting prompts:', error);
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
   * Save a new prompt
   */
  async savePrompt(prompt: Prompt): Promise<void> {
    try {
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
      console.error('Error saving prompt:', error);
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
      console.error('Error updating prompt:', error);
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
      const prompts = await this.getPrompts();
      const filtered = prompts.filter((p) => p.id !== id);
      await chrome.storage.local.set({ [StorageKey.PROMPTS]: filtered });
    } catch (error) {
      console.error('Error deleting prompt:', error);
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
      console.error('Error getting roles:', error);
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
      console.error('Error saving roles:', error);
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
      console.error('Error getting stats:', error);
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
      console.error('Error updating stats:', error);
    }
  }

  /**
   * Reset usage statistics
   */
  async resetStats(): Promise<void> {
    try {
      await chrome.storage.local.set({ [StorageKey.STATS]: DEFAULT_STATS });
    } catch (error) {
      console.error('Error resetting stats:', error);
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
      console.error('Error getting storage quota:', error);
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
      console.error('Error exporting data:', error);
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
      console.error('Error importing data:', error);
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
