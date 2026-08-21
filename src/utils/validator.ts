/**
 * Input Validation Service - Runtime validation for MCP requests
 * 
 * This module provides runtime validation of incoming MCP requests
 * against their defined schemas using AJV, ensuring type safety
 * at runtime and preventing malformed inputs from causing errors.
 */

import Ajv, { ValidateFunction } from 'ajv';
import { McpToolDefinition } from '../types/mcp';

export class InputValidator {
  private ajv: Ajv;
  private validators: Map<string, ValidateFunction>;

  constructor() {
    this.ajv = new Ajv({ 
      allErrors: true,
      coerceTypes: true,  // Automatically coerce types when safe
      allowUnionTypes: true  // Allow union types in schemas
    });
    this.validators = new Map();
  }

  /**
   * Compile and cache validators for all tool definitions
   */
  initializeValidators(toolDefinitions: McpToolDefinition[]): void {
    for (const tool of toolDefinitions) {
      const validator = this.ajv.compile(tool.inputSchema);
      this.validators.set(tool.name, validator);
    }
  }

  /**
   * Validate input arguments against tool schema.
   *
   * AJV is configured with `coerceTypes: true`, which mutates the object it
   * validates (e.g. "30" -> 30). To avoid mutating the caller's args object,
   * validation runs against a structuredClone. On success, the coerced clone
   * is returned as `data` so callers can pass the coerced values downstream
   * without the original object being touched.
   */
  validateInput(
    toolName: string,
    args: unknown
  ): { valid: boolean; errors?: string; data?: unknown } {
    const validator = this.validators.get(toolName);

    if (!validator) {
      return {
        valid: false,
        errors: `No validator found for tool: ${toolName}`
      };
    }

    const coerced = structuredClone(args);
    const valid = validator(coerced);

    if (!valid) {
      return {
        valid: false,
        errors: this.ajv.errorsText(validator.errors)
      };
    }

    return { valid: true, data: coerced };
  }

  /**
   * Get detailed validation errors for debugging
   */
  getDetailedErrors(toolName: string): any[] | undefined {
    const validator = this.validators.get(toolName);
    return validator?.errors || undefined;
  }

  /**
   * Clear all cached validators
   */
  clearValidators(): void {
    this.validators.clear();
  }

  /**
   * Check if a validator exists for a tool
   */
  hasValidator(toolName: string): boolean {
    return this.validators.has(toolName);
  }
}