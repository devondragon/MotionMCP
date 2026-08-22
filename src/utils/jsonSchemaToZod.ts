/**
 * Converts JSON Schema tool definitions to Zod schemas compatible with
 * McpServer.registerTool(). Uses Zod v4's built-in fromJSONSchema converter.
 */

import { z, fromJSONSchema } from 'zod';

/**
 * Convert a McpToolDefinition inputSchema to a Zod object schema suitable
 * for McpServer.registerTool().
 *
 * Returns the full ZodObject rather than its raw `.shape`. The object carries
 * the schema's top-level constraints, notably `additionalProperties: false`,
 * which fromJSONSchema translates into an object that rejects unknown keys.
 * McpServer.registerTool() uses an already-constructed schema as-is, so the
 * Worker enforces the same "reject unknown properties" contract that the stdio
 * AJV path does. (Passing only `.shape` to server.tool() would make the SDK
 * rebuild a non-strict object that silently strips unknown keys instead.)
 */
export function jsonSchemaToZodObject(
  inputSchema: Record<string, unknown>
): z.ZodType {
  return fromJSONSchema(inputSchema) as z.ZodType;
}
