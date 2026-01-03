/**
 * Prompt Enhancer Service
 * Core logic for transforming rough prompts into structured, high-quality prompts
 */

import type {
  EnhanceInput,
  EnhancedPrompt,
  ChatMessage,
  SuggestedRole,
  RoleCategory,
} from '../types';
import { ErrorType, PromptLayerError } from '../types';
import { openAIClient } from './openaiClient';
import { getRoleBlueprint, getAllRoleBlueprints } from './roleBlueprints';
import { storageService } from './storage';
import { logger } from '../utils/logger';

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
    let suggestedRole: SuggestedRole | undefined;

    // Parse sections
    for (const line of lines) {
      const trimmed = line.trim();

      // Check for section headers
      if (
        trimmed.match(
          /^(ROLE|OBJECTIVE|CONSTRAINTS?|OUTPUT FORMAT|TONE & STYLE|KEYWORD STRATEGY|EEAT REQUIREMENTS|CONTENT STRUCTURE|CONTEXT|STAKEHOLDERS|SUCCESS CRITERIA|SUGGESTED_ROLE):?$/i
        )
      ) {
        currentSection = trimmed.replace(':', '').toUpperCase();
        sections[currentSection] = [];
      } else if (trimmed && currentSection) {
        sections[currentSection].push(trimmed);
      }
    }

    // Parse suggested role if present
    if (sections['SUGGESTED_ROLE'] && sections['SUGGESTED_ROLE'].length > 0) {
      try {
        const suggestedRoleText = sections['SUGGESTED_ROLE'].join(' ');
        const roleMatch = suggestedRoleText.match(
          /name:\s*"?([^"]+)"?\s*\|\s*category:\s*(\w+)\s*\|\s*confidence:\s*([\d.]+)\s*\|\s*reason:\s*(.+)/i
        );
        if (roleMatch) {
          suggestedRole = {
            name: roleMatch[1].trim(),
            description: roleMatch[4].trim(),
            category: (roleMatch[2].toLowerCase() as RoleCategory) || 'other',
            confidence: parseFloat(roleMatch[3]),
            reason: roleMatch[4].trim(),
          };
        }
      } catch {
        // Ignore parsing errors for suggested role
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
      fullText: rawResponse.replace(/SUGGESTED_ROLE:[\s\S]*?(?=\n\n|$)/i, '').trim(),
      suggestedRole,
    };
  }

  /**
   * Build enhancement system message
   */
  private async buildSystemMessage(roleId: string, availableRoles: string[]): Promise<string> {
    const blueprint = await getRoleBlueprint(roleId);

    const roleSuggestionInstructions = `

ROLE SUGGESTION (only if confidence > 50%):
If the user's prompt would be better served by a specialized role NOT in the available roles list below, add a SUGGESTED_ROLE section at the very end of your response in this exact format:
SUGGESTED_ROLE:
name: "Role Name" | category: technical|creative|business|marketing|research|education|other | confidence: 0.XX | reason: Brief explanation why this role would be better suited

Available roles: ${availableRoles.join(', ')}

Only suggest a new role if you're at least 50% confident it would significantly improve the prompt enhancement. Do not suggest if an existing role is adequate.`;

    if (!blueprint) {
      // Fallback to generic enhancement if role not found
      return `You are an expert prompt engineer. Transform the user's rough prompt into a clear, structured, and effective prompt.

Structure your response with these sections:
- ROLE: Define the AI's role and expertise
- OBJECTIVE: State the specific goal
- CONSTRAINTS: List requirements and limitations
- OUTPUT FORMAT: Specify the desired output structure

Be precise, remove ambiguity, and optimize for quality results.${roleSuggestionInstructions}`;
    }

    return blueprint.systemPrompt + roleSuggestionInstructions;
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
      // Get available role names for suggestion context
      const allRoles = await getAllRoleBlueprints();
      const availableRoleNames = allRoles.map((r) => r.name);

      // Build messages
      const systemMessage = await this.buildSystemMessage(input.roleId, availableRoleNames);
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

      logger.error('Enhancement failed:', error);
      throw new PromptLayerError(
        ErrorType.UNKNOWN_ERROR,
        'Enhancement failed',
        'Could not enhance your prompt. Please try again.'
      );
    }
  }

  /**
   * Get estimated tokens for a prompt
   * Simple calculation: ~4 characters per token
   */
  estimateTokens(text: string): number {
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
