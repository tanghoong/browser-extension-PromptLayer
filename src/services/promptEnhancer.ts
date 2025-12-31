/**
 * Prompt Enhancer Service
 * Core logic for transforming rough prompts into structured, high-quality prompts
 */

import type { EnhanceInput, EnhancedPrompt, ChatMessage } from '../types';
import { ErrorType, PromptLayerError } from '../types';
import { openAIClient } from './openaiClient';
import { getRoleBlueprint } from './roleBlueprints';
import { storageService } from './storage';

/**
 * Prompt enhancer class
 */
class PromptEnhancer {
  /**
   * Parse enhanced prompt response into structured sections
   */
  private parseEnhancedPrompt(rawResponse: string, _roleId: string): EnhancedPrompt {
    const lines = rawResponse.trim().split('\n');
    const sections: Record<string, string[]> = {};
    let currentSection = '';

    // Parse sections
    for (const line of lines) {
      const trimmed = line.trim();

      // Check for section headers
      if (
        trimmed.match(
          /^(ROLE|OBJECTIVE|CONSTRAINTS?|OUTPUT FORMAT|TONE & STYLE|KEYWORD STRATEGY|EEAT REQUIREMENTS|CONTENT STRUCTURE|CONTEXT|STAKEHOLDERS|SUCCESS CRITERIA):?$/i
        )
      ) {
        currentSection = trimmed.replace(':', '').toUpperCase();
        sections[currentSection] = [];
      } else if (trimmed && currentSection) {
        sections[currentSection].push(trimmed);
      }
    }

    // Extract structured data
    const role = sections['ROLE']?.join(' ') || '';
    const objective = sections['OBJECTIVE']?.join(' ') || '';
    const constraints: string[] = [];
    const outputFormat = sections['OUTPUT FORMAT']?.join('\n') || '';

    // Collect all constraint-related sections
    [
      'CONSTRAINTS',
      'CONSTRAINT',
      'TONE & STYLE',
      'KEYWORD STRATEGY',
      'EEAT REQUIREMENTS',
      'CONTENT STRUCTURE',
      'CONTEXT',
      'STAKEHOLDERS',
      'SUCCESS CRITERIA',
    ].forEach((key) => {
      if (sections[key]) {
        constraints.push(...sections[key]);
      }
    });

    return {
      role,
      objective,
      constraints,
      outputFormat,
      fullText: rawResponse,
    };
  }

  /**
   * Build enhancement system message
   */
  private buildSystemMessage(roleId: string): string {
    const blueprint = getRoleBlueprint(roleId);

    if (!blueprint) {
      // Fallback to generic enhancement if role not found
      return `You are an expert prompt engineer. Transform the user's rough prompt into a clear, structured, and effective prompt.

Structure your response with these sections:
- ROLE: Define the AI's role and expertise
- OBJECTIVE: State the specific goal
- CONSTRAINTS: List requirements and limitations
- OUTPUT FORMAT: Specify the desired output structure

Be precise, remove ambiguity, and optimize for quality results.`;
    }

    return blueprint.systemPrompt;
  }

  /**
   * Build user message with context
   */
  private buildUserMessage(input: EnhanceInput): string {
    let message = `Transform this rough prompt into a structured, high-quality prompt:\n\n${input.rawPrompt}`;

    if (input.context) {
      message += `\n\n---\nCONTEXT:\n${input.context}\n---`;
    }

    message +=
      '\n\nProvide the enhanced prompt with clear sections (ROLE, OBJECTIVE, CONSTRAINTS, OUTPUT FORMAT).';

    return message;
  }

  /**
   * Enhance a prompt
   */
  async enhance(input: EnhanceInput): Promise<EnhancedPrompt> {
    const startTime = Date.now();

    // Validate input
    if (!input.rawPrompt || input.rawPrompt.trim().length === 0) {
      throw new PromptLayerError(
        ErrorType.INVALID_INPUT,
        'Empty prompt',
        'Please enter a prompt to enhance.'
      );
    }

    if (input.rawPrompt.length > 10000) {
      throw new PromptLayerError(
        ErrorType.INVALID_INPUT,
        'Prompt too long',
        'Your prompt is too long. Please keep it under 10,000 characters.'
      );
    }

    try {
      // Build messages
      const systemMessage = this.buildSystemMessage(input.roleId);
      const userMessage = this.buildUserMessage(input);

      const messages: ChatMessage[] = [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ];

      // Call OpenAI API
      const response = await openAIClient.chatCompletion({ messages });

      // Parse response
      const enhancedPrompt = this.parseEnhancedPrompt(response, input.roleId);

      // Add metadata
      const config = openAIClient.getConfig();
      enhancedPrompt.metadata = {
        model: config?.model || 'unknown',
        temperature: config?.temperature || 0.3,
      };

      // Update stats
      const endTime = Date.now();
      const enhancementTime = endTime - startTime;
      const stats = await storageService.getStats();

      await storageService.updateStats({
        enhancementsPerformed: stats.enhancementsPerformed + 1,
        totalApiCalls: stats.totalApiCalls + 1,
        averageEnhancementTime:
          (stats.averageEnhancementTime * stats.enhancementsPerformed + enhancementTime) /
          (stats.enhancementsPerformed + 1),
      });

      return enhancedPrompt;
    } catch (error) {
      if (error instanceof PromptLayerError) {
        throw error;
      }

      console.error('Enhancement failed:', error);
      throw new PromptLayerError(
        ErrorType.UNKNOWN_ERROR,
        'Enhancement failed',
        'Could not enhance your prompt. Please try again.'
      );
    }
  }

  /**
   * Get estimated tokens for a prompt
   */
  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Validate prompt before enhancement
   */
  validatePrompt(prompt: string): { valid: boolean; error?: string } {
    if (!prompt || prompt.trim().length === 0) {
      return { valid: false, error: 'Prompt cannot be empty' };
    }

    if (prompt.length > 10000) {
      return { valid: false, error: 'Prompt is too long (max 10,000 characters)' };
    }

    const estimatedTokens = this.estimateTokens(prompt);
    if (estimatedTokens > 2000) {
      return {
        valid: false,
        error: `Prompt is too long (~${estimatedTokens} tokens). Please keep it under 2000 tokens.`,
      };
    }

    return { valid: true };
  }
}

// Export singleton instance
export const promptEnhancer = new PromptEnhancer();
