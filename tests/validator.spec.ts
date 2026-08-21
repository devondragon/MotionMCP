import { describe, it, expect } from 'vitest';
import { InputValidator } from '../src/utils/validator';
import { allToolDefinitions } from '../src/tools/ToolDefinitions';

describe('InputValidator', () => {
  it('validates tool input against schemas', () => {
    const validator = new InputValidator();
    validator.initializeValidators(allToolDefinitions);

    // Valid: motion_tasks with allowed operation
    const ok = validator.validateInput('motion_tasks', { operation: 'list' });
    expect(ok.valid).toBe(true);
    // On success, the coerced clone is returned as `data`.
    expect(ok.data).toEqual({ operation: 'list' });

    // Coercion happens on a clone; the caller's object is not mutated.
    const original = { operation: 'list', limit: '5' };
    const coerced = validator.validateInput('motion_tasks', original);
    expect(coerced.valid).toBe(true);
    expect((coerced.data as { limit: unknown }).limit).toBe(5);
    // Original untouched (string, not coerced number).
    expect(original.limit).toBe('5');

    // Invalid operation
    const bad = validator.validateInput('motion_tasks', { operation: 'unknown_op' });
    expect(bad.valid).toBe(false);
    expect(String(bad.errors)).toContain('be equal to one of the allowed values');

    // Unknown tool
    const nope = validator.validateInput('no_such_tool', {});
    expect(nope.valid).toBe(false);
    expect(String(nope.errors)).toContain('No validator found for tool');
  });
});
