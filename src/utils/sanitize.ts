/**
 * Input Sanitization Utilities
 * 
 * Provides secure sanitization functions for user-provided content
 * to prevent injection attacks and ensure data integrity.
 */

import { LIMITS } from './constants';

/**
 * Sanitize user-provided text content for safe storage and transmission
 * Removes dangerous HTML tags, script content, and other potentially harmful input
 * 
 * @param input - The user input to sanitize
 * @returns Sanitized string safe for storage/transmission
 */
export function sanitizeTextContent(input: string | undefined | null): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Trim whitespace
  const trimmed = input.trim();
  
  if (trimmed.length === 0) {
    return '';
  }

  // Remove or escape potentially dangerous characters and patterns
  let sanitized = trimmed
    // Remove script tags and their content entirely
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove any remaining HTML tags but keep inner text
    .replace(/<[^>]*>/g, '')
    // Normalize unicode non-breaking spaces
    .replace(/\u00a0/g, ' ');

  // Normalize whitespace introduced by stripping tags while preserving newlines
  sanitized = sanitized
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Limit length to prevent abuse - use consistent limit from constants
  if (sanitized.length > LIMITS.COMMENT_MAX_LENGTH) {
    sanitized = sanitized.substring(0, LIMITS.COMMENT_MAX_LENGTH);
  }

  return sanitized;
}

/**
 * Validate that sanitized content is not empty after sanitization
 * 
 * @param original - Original user input
 * @param sanitized - Sanitized version
 * @returns True if content is valid after sanitization
 */
export function isValidSanitizedContent(original: string | undefined | null, sanitized: string): boolean {
  // If original had content but sanitized is empty, it was likely malicious
  if (original && original.trim().length > 0 && sanitized.length === 0) {
    return false;
  }
  
  // Must have some actual content
  return sanitized.length > 0;
}

/**
 * Sanitize and validate comment content
 * 
 * @param content - Comment content to sanitize
 * @returns Object with sanitized content and validation result
 */
export function sanitizeCommentContent(content: string | undefined | null): {
  sanitized: string;
  isValid: boolean;
  error?: string;
} {
  const sanitized = sanitizeTextContent(content);
  const isValid = isValidSanitizedContent(content, sanitized);
  
  if (!isValid && content && content.trim().length > 0) {
    return {
      sanitized: '',
      isValid: false,
      error: 'Comment content contains invalid or potentially harmful content'
    };
  }
  
  if (!isValid) {
    return {
      sanitized: '',
      isValid: false,
      error: 'Comment content cannot be empty'
    };
  }
  
  return {
    sanitized,
    isValid: true
  };
}

/**
 * Sanitize task/project description content
 * Similar to comment content but allows empty descriptions
 * 
 * @param description - Task or project description to sanitize
 * @returns Sanitized description or undefined if empty/invalid
 */
export function sanitizeDescription(description: string | undefined | null): string | undefined {
  if (!description || typeof description !== 'string') {
    return undefined;
  }
  
  const sanitized = sanitizeTextContent(description);
  if (sanitized === '') {
    return undefined;
  }
  
  // Check if sanitization removed significant content (potential attack)
  if (description.trim().length > 0 && !isValidSanitizedContent(description, sanitized)) {
    throw new Error('Description contains invalid or potentially harmful content');
  }
  
  return sanitized;
}

/**
 * Sanitize task/project name content
 * Names are required and must be non-empty after sanitization
 * 
 * @param name - Task or project name to sanitize
 * @returns Sanitized name
 * @throws Error if name is empty or contains invalid content
 */
export function sanitizeName(name: string | undefined | null): string {
  if (!name || typeof name !== 'string') {
    throw new Error('Name is required');
  }
  
  const sanitized = sanitizeTextContent(name);
  if (sanitized === '') {
    throw new Error('Name cannot be empty');
  }
  
  // Check if sanitization removed significant content (potential attack)
  if (!isValidSanitizedContent(name, sanitized)) {
    throw new Error('Name contains invalid or potentially harmful content');
  }
  
  return sanitized;
}
