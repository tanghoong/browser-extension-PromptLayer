/**
 * OpenAI Client Service
 * Handles all communication with OpenAI API
 */

import type {
  OpenAIConfig,
  ChatCompletionParams,
} from '../types';
import { ErrorType, PromptLayerError } from '../types';
import { storageService } from './storage';

/**
 * OpenAI API endpoint
 */
const OPENAI_API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/**
 * Request timeout (30 seconds)
 */
const REQUEST_TIMEOUT = 30000;

/**
 * Max retries for failed requests
 */
const MAX_RETRIES = 3;

/**
 * OpenAI API pricing per 1M tokens (as of 2024)
 */
const PRICING = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
};

/**
 * OpenAI client class
 */
class OpenAIClient {
  private config: OpenAIConfig | null = null;
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly MAX_REQUESTS_PER_MINUTE = 50;

  /**
   * Initialize the client with configuration
   */
  async initialize(): Promise<void> {
    const settings = await storageService.getSettings();
    const apiKey = await storageService.getApiKey();

    if (!apiKey) {
      throw new PromptLayerError(
        ErrorType.API_KEY_MISSING,
        'API key not found',
        'Please configure your OpenAI API key in settings.'
      );
    }

    this.config = {
      apiKey,
      model: settings.model,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
    };
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(): void {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Reset counter if more than a minute has passed
    if (timeSinceLastRequest > 60000) {
      this.requestCount = 0;
    }

    if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
      const waitTime = Math.ceil((60000 - timeSinceLastRequest) / 1000);
      throw new PromptLayerError(
        ErrorType.API_RATE_LIMIT,
        'Rate limit exceeded',
        `You are making too many requests. Please wait ${waitTime} seconds.`
      );
    }

    this.requestCount++;
    this.lastRequestTime = now;
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new PromptLayerError(
          ErrorType.API_NETWORK_ERROR,
          'Request timeout',
          'The request took too long. Please try again.'
        );
      }
      throw error;
    }
  }

  /**
   * Make API request with retries
   */
  private async makeRequest(
    params: ChatCompletionParams,
    retryCount = 0
  ): Promise<string> {
    if (!this.config) {
      await this.initialize();
    }

    if (!this.config) {
      throw new PromptLayerError(
        ErrorType.API_KEY_MISSING,
        'Configuration not initialized',
        'Please configure your API key.'
      );
    }

    this.checkRateLimit();

    try {
      const response = await this.fetchWithTimeout(
        OPENAI_API_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: params.model || this.config.model,
            messages: params.messages,
            temperature: params.temperature ?? this.config.temperature,
            max_tokens: params.maxTokens ?? this.config.maxTokens,
          }),
        },
        REQUEST_TIMEOUT
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 401) {
          throw new PromptLayerError(
            ErrorType.API_KEY_INVALID,
            'Invalid API key',
            'Your API key is invalid or has expired. Please check your settings.'
          );
        }

        if (response.status === 429) {
          // Rate limited by OpenAI
          if (retryCount < MAX_RETRIES) {
            const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            return this.makeRequest(params, retryCount + 1);
          }

          throw new PromptLayerError(
            ErrorType.API_RATE_LIMIT,
            'Rate limited by OpenAI',
            'OpenAI rate limit exceeded. Please wait a moment and try again.'
          );
        }

        throw new PromptLayerError(
          ErrorType.API_NETWORK_ERROR,
          `API error: ${response.status}`,
          errorData.error?.message || 'An error occurred while contacting OpenAI. Please try again.'
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new PromptLayerError(
          ErrorType.UNKNOWN_ERROR,
          'No response from API',
          'OpenAI did not return a valid response. Please try again.'
        );
      }

      // Track token usage and cost
      const usage = data.usage;
      if (usage) {
        await this.trackUsage(
          usage.prompt_tokens || 0,
          usage.completion_tokens || 0,
          params.model || this.config.model
        );
      }

      return content;
    } catch (error) {
      if (error instanceof PromptLayerError) {
        throw error;
      }

      // Network error - retry
      if (retryCount < MAX_RETRIES) {
        const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return this.makeRequest(params, retryCount + 1);
      }

      console.error('API request failed:', error);
      throw new PromptLayerError(
        ErrorType.API_NETWORK_ERROR,
        'Network error',
        'Could not connect to OpenAI. Please check your internet connection.'
      );
    }
  }

  /**
   * Track token usage and calculate cost
   */
  private async trackUsage(
    promptTokens: number,
    completionTokens: number,
    model: string
  ): Promise<void> {
    try {
      const stats = await storageService.getStats();
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Reset monthly cost if new month
      if (stats.currentMonth !== currentMonth) {
        stats.monthlyCostUSD = 0;
        stats.currentMonth = currentMonth;
      }

      // Calculate cost based on model pricing
      const pricing = PRICING[model as keyof typeof PRICING] || PRICING['gpt-4o-mini'];
      const inputCost = (promptTokens / 1000000) * pricing.input;
      const outputCost = (completionTokens / 1000000) * pricing.output;
      const totalCost = inputCost + outputCost;

      // Update stats
      await storageService.updateStats({
        totalTokensUsed: stats.totalTokensUsed + promptTokens + completionTokens,
        totalCostUSD: stats.totalCostUSD + totalCost,
        monthlyCostUSD: stats.monthlyCostUSD + totalCost,
        currentMonth,
      });

      console.log(`[PromptLayer] Tokens: ${promptTokens + completionTokens}, Cost: $${totalCost.toFixed(6)}`);
    } catch (error) {
      console.error('Error tracking usage:', error);
    }
  }

  /**
   * Chat completion request
   */
  async chatCompletion(params: ChatCompletionParams): Promise<string> {
    return this.makeRequest(params);
  }

  /**
   * Validate API key
   */
  async validate(): Promise<boolean> {
    try {
      await this.makeRequest({
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 5,
      });
      return true;
    } catch (error) {
      if (error instanceof PromptLayerError && error.type === ErrorType.API_KEY_INVALID) {
        return false;
      }
      // Other errors might be temporary, so return true to avoid blocking
      return true;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): OpenAIConfig | null {
    return this.config;
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<OpenAIConfig>): Promise<void> {
    if (!this.config) {
      await this.initialize();
    }
    if (this.config) {
      this.config = { ...this.config, ...updates };
    }
  }
}

// Export singleton instance
export const openAIClient = new OpenAIClient();
