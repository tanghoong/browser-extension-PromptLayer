/**
 * Input validation and sanitization utilities
 */

/**
 * Sanitize HTML to prevent XSS attacks.
 * This escapes HTML entities to prevent script injection.
 * For more complex HTML sanitization needs (allowlisting tags/attributes),
 * consider using a dedicated library such as DOMPurify.
 */
export function sanitizeHTML(html: string): string {
  // Delegate to escapeHTML so behavior is consistent across the codebase.
  // Normalize falsy input to an empty string to avoid returning "undefined"/"null".
  return escapeHTML(html || '');
}

/**
 * Escape HTML entities to prevent XSS
 * This is the primary function for preventing XSS in user-generated content
 */
export function escapeHTML(text: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => escapeMap[char]);
}

/**
 * Validate and sanitize API key
 */
export function validateApiKey(apiKey: string): {
  valid: boolean;
  sanitized?: string;
  error?: string;
} {
  // Trim whitespace
  const trimmed = apiKey.trim();

  // Check if empty
  if (!trimmed) {
    return { valid: false, error: 'API key cannot be empty' };
  }

  // OpenAI API keys can have different formats:
  // - Standard keys: sk-...
  // - Project keys: sk-proj-...
  // - Service account keys may have other formats
  if (!trimmed.startsWith('sk-')) {
    return { valid: false, error: 'API key must start with "sk-"' };
  }

  // Check minimum length (OpenAI keys are typically 48+ characters)
  if (trimmed.length < 40) {
    return { valid: false, error: 'API key appears to be too short' };
  }

  // Check for invalid characters (API keys should only contain alphanumeric and hyphens/underscores)
  // Updated pattern to support newer formats like sk-proj-...
  const validPattern = /^sk-(?:proj-)?[A-Za-z0-9_-]+$/;
  if (!validPattern.test(trimmed)) {
    return { valid: false, error: 'API key contains invalid characters' };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validate prompt title
 */
export function validatePromptTitle(title: string, maxLength = 200): {
  valid: boolean;
  sanitized?: string;
  error?: string;
} {
  const trimmed = title.trim();

  if (!trimmed) {
    return { valid: false, error: 'Title cannot be empty' };
  }

  if (trimmed.length > maxLength) {
    return { valid: false, error: `Title must be ${maxLength} characters or less` };
  }

  // Remove any potentially dangerous characters while preserving readability
  const sanitized = trimmed.replace(/[<>\"']/g, '');

  return { valid: true, sanitized };
}

/**
 * Validate prompt content
 */
export function validatePromptContent(content: string, maxLength = 10000): {
  valid: boolean;
  sanitized?: string;
  error?: string;
} {
  const trimmed = content.trim();

  if (!trimmed) {
    return { valid: false, error: 'Prompt content cannot be empty' };
  }

  if (trimmed.length > maxLength) {
    return { valid: false, error: `Prompt must be ${maxLength} characters or less` };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validate role name
 */
export function validateRoleName(name: string, maxLength = 100): {
  valid: boolean;
  sanitized?: string;
  error?: string;
} {
  const trimmed = name.trim();

  if (!trimmed) {
    return { valid: false, error: 'Role name cannot be empty' };
  }

  if (trimmed.length > maxLength) {
    return { valid: false, error: `Role name must be ${maxLength} characters or less` };
  }

  // Sanitize to prevent script injection
  const sanitized = trimmed.replace(/[<>\"']/g, '');

  return { valid: true, sanitized };
}

/**
 * Validate URL
 */
export function validateURL(url: string): {
  valid: boolean;
  sanitized?: string;
  error?: string;
} {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
    }
    return { valid: true, sanitized: parsed.toString() };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts and dangerous characters
  return filename
    .replace(/[\/\\]/g, '-')
    .replace(/\.\./g, '')
    .replace(/[<>:"|?*\x00-\x1F]/g, '')
    .substring(0, 255);
}

/**
 * Validate email address
 */
export function validateEmail(email: string): {
  valid: boolean;
  sanitized?: string;
  error?: string;
} {
  const trimmed = email.trim().toLowerCase();

  if (!trimmed) {
    return { valid: false, error: 'Email cannot be empty' };
  }

  // Basic email validation pattern
  const emailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  if (!emailPattern.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validate numeric input
 */
export function validateNumber(
  value: string | number,
  min?: number,
  max?: number
): {
  valid: boolean;
  number?: number;
  error?: string;
} {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return { valid: false, error: 'Invalid number' };
  }

  if (min !== undefined && num < min) {
    return { valid: false, error: `Number must be at least ${min}` };
  }

  if (max !== undefined && num > max) {
    return { valid: false, error: `Number must be at most ${max}` };
  }

  return { valid: true, number: num };
}

/**
 * Escape special characters in regex
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Deep sanitize object to prevent prototype pollution
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip prototype-related keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    // Handle arrays - recursively sanitize objects within
    if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? sanitizeObject(item as Record<string, unknown>)
          : item
      );
    } else if (value && typeof value === 'object') {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}
