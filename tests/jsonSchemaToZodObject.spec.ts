/**
 * Node-side coverage for jsonSchemaToZodObject (issue #136).
 *
 * jsonSchemaToZodObject is pure zod and runs in Node, so this spec runs in the
 * node project. It complements tests/worker/json-schema-to-zod.spec.ts, which
 * already pins the additionalProperties: false / required / enum behaviour.
 * Here the focus is the value-shape constraints the tool schemas rely on and
 * that the worker spec does not assert: minLength on the task assignee fields,
 * minimum: 0 on recurring-task duration, and minItems: 1 on custom-field
 * options. These are the constraints the stdio AJV path enforces; this proves
 * the converted Worker schema enforces them too.
 */
import { describe, it, expect } from 'vitest';
import { jsonSchemaToZodObject } from '../src/utils/jsonSchemaToZod';
import {
  tasksToolDefinition,
  recurringTasksToolDefinition,
  customFieldsToolDefinition
} from '../src/tools/ToolDefinitions';

type SchemaInput = Parameters<typeof jsonSchemaToZodObject>[0];

const tasksSchema = () => jsonSchemaToZodObject(tasksToolDefinition.inputSchema as SchemaInput);
const recurringSchema = () =>
  jsonSchemaToZodObject(recurringTasksToolDefinition.inputSchema as SchemaInput);
const customFieldsSchema = () =>
  jsonSchemaToZodObject(customFieldsToolDefinition.inputSchema as SchemaInput);

describe('jsonSchemaToZodObject value constraints', () => {
  describe('minLength on task assignee fields', () => {
    it('rejects an empty assigneeId but accepts a non-empty one', () => {
      const schema = tasksSchema();

      expect(schema.safeParse({ operation: 'list', assigneeId: '' }).success).toBe(false);
      expect(schema.safeParse({ operation: 'list', assigneeId: 'user-1' }).success).toBe(true);
    });

    it('rejects an empty assignee but accepts a non-empty one', () => {
      const schema = tasksSchema();

      expect(schema.safeParse({ operation: 'list', assignee: '' }).success).toBe(false);
      expect(schema.safeParse({ operation: 'list', assignee: 'me' }).success).toBe(true);
    });
  });

  describe('minimum: 0 on recurring-task duration', () => {
    it('rejects a negative numeric duration', () => {
      const schema = recurringSchema();

      expect(schema.safeParse({ operation: 'create', duration: -5 }).success).toBe(false);
    });

    it('accepts zero and positive numeric durations', () => {
      const schema = recurringSchema();

      expect(schema.safeParse({ operation: 'create', duration: 0 }).success).toBe(true);
      expect(schema.safeParse({ operation: 'create', duration: 30 }).success).toBe(true);
    });

    it('accepts the REMINDER string branch of the duration union', () => {
      const schema = recurringSchema();

      expect(schema.safeParse({ operation: 'create', duration: 'REMINDER' }).success).toBe(true);
    });
  });

  describe('minItems: 1 on custom-field options', () => {
    it('rejects an empty options array but accepts a populated one', () => {
      const schema = customFieldsSchema();

      expect(schema.safeParse({ operation: 'create', options: [] }).success).toBe(false);
      expect(schema.safeParse({ operation: 'create', options: ['A'] }).success).toBe(true);
    });
  });
});
