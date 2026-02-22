/**
 * Converts JSON Schema tool definitions to Zod schemas compatible with
 * McpServer.tool(). Uses Zod v4's built-in fromJSONSchema converter.
 */

import { z, fromJSONSchema } from 'zod';

/**
 * Convert a McpToolDefinition inputSchema to a Zod raw shape
 * suitable for McpServer.tool() or McpServer.registerTool().
 *
 * Uses Zod v4's fromJSONSchema to produce a ZodObject, then
 * extracts the shape (Record<string, ZodType>) for McpServer.
 */
export function jsonSchemaToZodShape(
  inputSchema: Record<string, unknown>
): Record<string, z.ZodType> {
  const zodObject = fromJSONSchema(inputSchema) as z.ZodObject;
  return zodObject.shape as Record<string, z.ZodType>;
}
