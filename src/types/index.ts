/**
 * Core type definitions for PromptLayer extension
 */

/**
 * Prompt metadata and content
 */
export interface Prompt {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  lastUsed?: Date;
  category?: string;
  isFavorite?: boolean;
}

/**
 * Prompt version history entry
 */
export interface PromptVersion {
  version: number;
  content: string;
  timestamp: Date;
  changeDescription?: string;
}

/**
 * Role blueprint for prompt enhancement
 */
export interface RoleBlueprint {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  thinkingDepth: 'shallow' | 'medium' | 'deep';
  outputStyle: string;
  constraints: string[];
  isDefault: boolean;
  isEditable: boolean;
}

/**
 * Enhanced prompt structure
 */
export interface EnhancedPrompt {
  role: string;
  objective: string;
  constraints: string[];
  outputFormat: string;
  fullText: string;
  metadata?: {
    model: string;
    temperature: number;
    tokensUsed?: number;
  };
}

/**
 * Input for prompt enhancement
 */
export interface EnhanceInput {
  rawPrompt: string;
  roleId: string;
  context?: string;
}

/**
 * OpenAI API configuration
 */
export interface OpenAIConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

/**
 * Chat completion parameters
 */
export interface ChatCompletionParams {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Chat message structure
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Storage keys for chrome.storage
 */
export enum StorageKey {
  API_KEY = 'promptlayer_api_key',
  PROMPTS = 'promptlayer_prompts',
  ROLES = 'promptlayer_roles',
  SETTINGS = 'promptlayer_settings',
  STATS = 'promptlayer_stats',
}

/**
 * Extension settings
 */
export interface ExtensionSettings {
  apiKey?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  theme: 'light' | 'dark' | 'auto';
  toolbarCollapsed: boolean;
  keyboardShortcutsEnabled: boolean;
}

/**
 * Usage statistics (local only)
 */
export interface UsageStats {
  enhancementsPerformed: number;
  promptsSaved: number;
  mostUsedRole: string;
  totalApiCalls: number;
  averageEnhancementTime: number;
  lastResetDate: Date;
  totalTokensUsed: number;
  totalCostUSD: number;
  monthlyCostUSD: number;
  currentMonth: string;
}

/**
 * Error types
 */
export enum ErrorType {
  API_KEY_MISSING = 'API_KEY_MISSING',
  API_KEY_INVALID = 'API_KEY_INVALID',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  API_NETWORK_ERROR = 'API_NETWORK_ERROR',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_RATE_LIMIT = 'STORAGE_RATE_LIMIT',
  INVALID_INPUT = 'INVALID_INPUT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Custom error class for PromptLayer
 */
export class PromptLayerError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
    public userMessage?: string
  ) {
    super(message);
    this.name = 'PromptLayerError';
  }
}

/**
 * Notification types
 */
export enum NotificationType {
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  INFO = 'info',
}

/**
 * Notification message
 */
export interface Notification {
  type: NotificationType;
  message: string;
  duration?: number; // milliseconds
  action?: {
    label: string;
    callback: () => void;
  };
}
