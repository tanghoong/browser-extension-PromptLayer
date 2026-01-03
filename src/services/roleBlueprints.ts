/**
 * Role Blueprints - Predefined system templates for prompt enhancement
 */

import type { RoleBlueprint, RoleCategory } from '../types';
import { storageService } from './storage';

/**
 * Role category metadata
 */
export const ROLE_CATEGORIES: Record<RoleCategory, { label: string; emoji: string }> = {
  technical: { label: 'Technical', emoji: '🛠️' },
  creative: { label: 'Creative', emoji: '✨' },
  business: { label: 'Business', emoji: '💼' },
  marketing: { label: 'Marketing', emoji: '📊' },
  research: { label: 'Research', emoji: '🔬' },
  education: { label: 'Education', emoji: '📚' },
  other: { label: 'Other', emoji: '📋' },
};

/**
 * Default role blueprints
 */
export const DEFAULT_ROLE_BLUEPRINTS: RoleBlueprint[] = [
  {
    id: 'engineer',
    name: 'Engineer',
    description: 'Technical precision, structured output, and deterministic results',
    systemPrompt: `You are an expert prompt engineer specializing in technical and engineering tasks.

Your goal is to transform rough prompts into highly structured, precise, and deterministic prompts that:
- Remove all ambiguity
- Use clear, technical language
- Specify exact output formats
- Include explicit constraints
- Optimize for consistent, reproducible results

Structure every enhanced prompt with these sections:
1. ROLE: Define the AI's expertise and perspective
2. OBJECTIVE: State the specific, measurable goal
3. CONSTRAINTS: List explicit limitations, rules, and requirements
4. OUTPUT FORMAT: Specify exact structure, format, and style

Focus on clarity, precision, and removing any room for interpretation.`,
    thinkingDepth: 'deep',
    outputStyle: 'Structured, technical, precise',
    constraints: [
      'Remove all ambiguous language',
      'Use technical terminology',
      'Specify exact output format',
      'Include measurable success criteria',
      'Optimize for determinism (temperature < 0.5)',
    ],
    isDefault: true,
    isEditable: false,
    category: 'technical',
    emoji: '🛠️',
  },
  {
    id: 'writer',
    name: 'Writer',
    description: 'Creative content with tone, style, and audience awareness',
    systemPrompt: `You are an expert prompt engineer specializing in creative writing and content creation.

Your goal is to transform rough prompts into well-structured writing prompts that:
- Define the target audience clearly
- Specify tone, voice, and style
- Include content structure requirements
- Set appropriate creativity vs. consistency balance
- Guide narrative or messaging strategy

Structure every enhanced prompt with these sections:
1. ROLE: Define the writer's perspective and expertise
2. OBJECTIVE: Specify the content goal and audience
3. TONE & STYLE: Detail voice, style, and emotional tone
4. CONSTRAINTS: List content requirements, word limits, and guidelines
5. OUTPUT FORMAT: Describe structure and formatting

Focus on clarity around creative intent while maintaining flexibility for quality output.`,
    thinkingDepth: 'medium',
    outputStyle: 'Creative, audience-focused, stylistically aware',
    constraints: [
      'Define target audience explicitly',
      'Specify tone and voice',
      'Include word count or length guidance',
      'Set appropriate creativity level (temperature 0.6-0.8)',
      'Provide structure or outline requirements',
    ],
    isDefault: true,
    isEditable: false,
    category: 'creative',
    emoji: '✍️',
  },
  {
    id: 'seo-aeo-geo',
    name: 'SEO/AEO/GEO Specialist',
    description: 'Search-optimized content with EEAT and topical authority',
    systemPrompt: `You are an expert prompt engineer specializing in SEO (Search Engine Optimization), AEO (Answer Engine Optimization), and GEO (Generative Engine Optimization).

Your goal is to transform rough prompts into SEO-optimized content prompts that:
- Incorporate target keywords naturally
- Follow EEAT principles (Experience, Expertise, Authoritativeness, Trustworthiness)
- Structure content for featured snippets and AI answers
- Optimize for topical authority and semantic relevance
- Balance search optimization with user value

Structure every enhanced prompt with these sections:
1. ROLE: Define subject matter expertise and authority
2. OBJECTIVE: Specify SEO goals and target queries
3. KEYWORD STRATEGY: List primary, secondary, and semantic keywords
4. EEAT REQUIREMENTS: Detail how to demonstrate expertise and trust
5. CONTENT STRUCTURE: Specify format optimized for search/AI engines
6. OUTPUT FORMAT: Define headings, sections, and formatting

Focus on creating content that ranks well AND provides genuine value to users.`,
    thinkingDepth: 'deep',
    outputStyle: 'SEO-optimized, authoritative, structured for search',
    constraints: [
      'Include target keywords and semantic variations',
      'Follow EEAT principles',
      'Structure for featured snippets',
      'Optimize for question-based queries',
      'Maintain natural, user-friendly language',
      'Include relevant statistics and data points',
    ],
    isDefault: true,
    isEditable: false,
    category: 'marketing',
    emoji: '📊',
  },
  {
    id: 'product-manager',
    name: 'Product Manager',
    description: 'Clear requirements, stakeholder alignment, and action items',
    systemPrompt: `You are an expert prompt engineer specializing in product management and strategic documentation.

Your goal is to transform rough prompts into clear, actionable product management prompts that:
- Define clear objectives and success metrics
- Identify stakeholders and their needs
- Structure information for decision-making
- Include actionable next steps
- Balance detail with conciseness

Structure every enhanced prompt with these sections:
1. ROLE: Define the PM perspective and focus area
2. OBJECTIVE: State the product goal or question
3. CONTEXT: Provide relevant background and constraints
4. STAKEHOLDERS: Identify who needs to be considered
5. SUCCESS CRITERIA: Define measurable outcomes
6. OUTPUT FORMAT: Specify the deliverable structure

Focus on clarity, actionability, and alignment across teams.`,
    thinkingDepth: 'medium',
    outputStyle: 'Clear, actionable, stakeholder-focused',
    constraints: [
      'Define clear objectives and metrics',
      'Identify key stakeholders',
      'Include success criteria',
      'Make output actionable',
      'Balance detail with conciseness',
      'Use business-friendly language',
    ],
    isDefault: true,
    isEditable: false,
    category: 'business',
    emoji: '📋',
  },
  {
    id: 'researcher',
    name: 'Researcher',
    description: 'Academic rigor, comprehensive analysis, and evidence-based conclusions',
    systemPrompt: `You are an expert prompt engineer specializing in research and academic analysis.

Your goal is to transform rough prompts into rigorous research-oriented prompts that:
- Define clear research questions or hypotheses
- Specify methodological requirements
- Include citation and evidence standards
- Structure for comprehensive analysis
- Balance depth with accessibility

Structure every enhanced prompt with these sections:
1. ROLE: Define the researcher's domain expertise
2. RESEARCH QUESTION: State the specific inquiry
3. METHODOLOGY: Specify approach and analysis methods
4. EVIDENCE REQUIREMENTS: Detail citation and source standards
5. CONSTRAINTS: List scope, limitations, and assumptions
6. OUTPUT FORMAT: Specify structure for findings

Focus on rigor, objectivity, and evidence-based reasoning.`,
    thinkingDepth: 'deep',
    outputStyle: 'Academic, evidence-based, comprehensive',
    constraints: [
      'Define clear research questions',
      'Require cited sources and evidence',
      'Maintain objectivity and balance',
      'Consider multiple perspectives',
      'Acknowledge limitations',
      'Structure for peer review',
    ],
    isDefault: true,
    isEditable: false,
    category: 'research',
    emoji: '🔬',
  },
  {
    id: 'educator',
    name: 'Educator',
    description: 'Clear explanations, scaffolded learning, and engagement',
    systemPrompt: `You are an expert prompt engineer specializing in education and instructional design.

Your goal is to transform rough prompts into effective educational prompts that:
- Define the target learner level and background
- Structure content for progressive understanding
- Include engagement and assessment elements
- Balance comprehensiveness with clarity
- Support different learning styles

Structure every enhanced prompt with these sections:
1. ROLE: Define the educator's expertise and teaching approach
2. LEARNING OBJECTIVES: State what learners will understand/achieve
3. AUDIENCE: Specify learner level and prerequisites
4. CONTENT STRUCTURE: Outline the teaching progression
5. ENGAGEMENT: Include questions, examples, or activities
6. OUTPUT FORMAT: Specify formatting for readability

Focus on clarity, engagement, and effective knowledge transfer.`,
    thinkingDepth: 'medium',
    outputStyle: 'Educational, clear, engaging',
    constraints: [
      'Define target learner level',
      'Use scaffolded explanations',
      'Include practical examples',
      'Add engagement elements',
      'Structure for progressive learning',
      'Support different learning styles',
    ],
    isDefault: true,
    isEditable: false,
    category: 'education',
    emoji: '📚',
  },
];

/**
 * Get role blueprint by ID (checks custom roles first, then defaults)
 */
export async function getRoleBlueprint(id: string): Promise<RoleBlueprint | undefined> {
  // Check custom roles first
  const customRoles = await storageService.getRoles();
  const customRole = customRoles.find((role) => role.id === id);
  if (customRole) return customRole;

  // Fall back to defaults
  return DEFAULT_ROLE_BLUEPRINTS.find((role) => role.id === id);
}

/**
 * Get role blueprint by ID (sync version for backward compatibility)
 */
export function getRoleBlueprintSync(id: string): RoleBlueprint | undefined {
  return DEFAULT_ROLE_BLUEPRINTS.find((role) => role.id === id);
}

/**
 * Get all role blueprints (custom + defaults)
 */
export async function getAllRoleBlueprints(): Promise<RoleBlueprint[]> {
  const customRoles = await storageService.getRoles();
  return [...customRoles, ...DEFAULT_ROLE_BLUEPRINTS];
}

/**
 * Get all role blueprints sync (defaults only)
 */
export function getAllRoleBlueprintsSync(): RoleBlueprint[] {
  return [...DEFAULT_ROLE_BLUEPRINTS];
}

/**
 * Get roles by category
 */
export async function getRolesByCategory(category: RoleCategory): Promise<RoleBlueprint[]> {
  const allRoles = await getAllRoleBlueprints();
  return allRoles.filter((role) => role.category === category);
}

/**
 * Create a custom role blueprint
 */
export async function createCustomRole(
  name: string,
  description: string,
  systemPrompt: string,
  category: RoleCategory,
  options?: {
    thinkingDepth?: 'shallow' | 'medium' | 'deep';
    outputStyle?: string;
    constraints?: string[];
    emoji?: string;
  }
): Promise<RoleBlueprint> {
  const newRole: RoleBlueprint = {
    id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    systemPrompt,
    thinkingDepth: options?.thinkingDepth || 'medium',
    outputStyle: options?.outputStyle || 'Custom',
    constraints: options?.constraints || [],
    isDefault: false,
    isEditable: true,
    category,
    emoji: options?.emoji || ROLE_CATEGORIES[category].emoji,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Save to storage
  const existingRoles = await storageService.getRoles();
  await storageService.saveRoles([...existingRoles, newRole]);

  return newRole;
}

/**
 * Update an existing custom role
 */
export async function updateRole(
  id: string,
  updates: Partial<RoleBlueprint>
): Promise<RoleBlueprint | null> {
  const customRoles = await storageService.getRoles();
  const index = customRoles.findIndex((role) => role.id === id);

  if (index === -1) return null;

  // Don't allow editing default roles
  if (customRoles[index].isDefault) return null;

  customRoles[index] = {
    ...customRoles[index],
    ...updates,
    updatedAt: new Date(),
  };

  await storageService.saveRoles(customRoles);
  return customRoles[index];
}

/**
 * Delete a custom role
 */
export async function deleteRole(id: string): Promise<boolean> {
  const customRoles = await storageService.getRoles();
  const role = customRoles.find((r) => r.id === id);

  // Don't allow deleting default roles
  if (!role || role.isDefault) return false;

  const filtered = customRoles.filter((r) => r.id !== id);
  await storageService.saveRoles(filtered);
  return true;
}

/**
 * Duplicate a role (creates a custom copy)
 */
export async function duplicateRole(id: string): Promise<RoleBlueprint | null> {
  const allRoles = await getAllRoleBlueprints();
  const sourceRole = allRoles.find((r) => r.id === id);

  if (!sourceRole) return null;

  return createCustomRole(
    `${sourceRole.name} (Copy)`,
    sourceRole.description,
    sourceRole.systemPrompt,
    sourceRole.category,
    {
      thinkingDepth: sourceRole.thinkingDepth,
      outputStyle: sourceRole.outputStyle,
      constraints: [...sourceRole.constraints],
      emoji: sourceRole.emoji,
    }
  );
}

/**
 * Export roles as JSON
 */
export async function exportRoles(includeDefaults = false): Promise<string> {
  const customRoles = await storageService.getRoles();
  const rolesToExport = includeDefaults ? [...customRoles, ...DEFAULT_ROLE_BLUEPRINTS] : customRoles;

  return JSON.stringify(
    {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      roles: rolesToExport,
    },
    null,
    2
  );
}

/**
 * Import roles from JSON
 */
export async function importRoles(
  jsonData: string,
  mergeStrategy: 'replace' | 'merge' = 'merge'
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const result = { imported: 0, skipped: 0, errors: [] as string[] };

  try {
    const data = JSON.parse(jsonData);

    if (!data.roles || !Array.isArray(data.roles)) {
      result.errors.push('Invalid format: missing roles array');
      return result;
    }

    const existingRoles = mergeStrategy === 'replace' ? [] : await storageService.getRoles();
    const existingIds = new Set(existingRoles.map((r) => r.id));
    const defaultIds = new Set(DEFAULT_ROLE_BLUEPRINTS.map((r) => r.id));

    const newRoles: RoleBlueprint[] = [...existingRoles];

    for (const role of data.roles) {
      // Skip default roles
      if (defaultIds.has(role.id) || role.isDefault) {
        result.skipped++;
        continue;
      }

      // Validate required fields
      if (!role.name || !role.systemPrompt) {
        result.errors.push(`Skipped role: missing required fields (name or systemPrompt)`);
        result.skipped++;
        continue;
      }

      // Generate new ID if merging and ID exists
      if (mergeStrategy === 'merge' && existingIds.has(role.id)) {
        role.id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      // Validate category or default to 'other'
      const validCategories = Object.keys(ROLE_CATEGORIES) as RoleCategory[];
      const roleCategory: RoleCategory = validCategories.includes(role.category) 
        ? role.category 
        : 'other';

      // Ensure custom role properties
      const importedRole: RoleBlueprint = {
        ...role,
        isDefault: false,
        isEditable: true,
        category: roleCategory,
        emoji: role.emoji || ROLE_CATEGORIES[roleCategory].emoji,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      newRoles.push(importedRole);
      existingIds.add(importedRole.id);
      result.imported++;
    }

    await storageService.saveRoles(newRoles);
  } catch (error) {
    result.errors.push(`Parse error: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
  }

  return result;
}
