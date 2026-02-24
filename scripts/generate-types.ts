/**
 * Generates src/types/mcp-tool-args.ts from the JSON Schemas in ToolDefinitions.ts.
 *
 * Run: npx tsx scripts/generate-types.ts
 *
 * Limitation: handles type, enum, oneOf, array, and nested object schemas.
 * Does NOT handle $ref, allOf, anyOf, not, or additionalProperties — these
 * will silently emit `unknown`. Extend schemaToTs() if schemas evolve to use them.
 *
 * Note: __dirname is a CommonJS global provided by tsx. This script would need
 * import.meta.dirname (Node 21+) or a fileURLToPath shim under a pure ESM runner.
 */

import * as fs from 'fs';
import * as path from 'path';
import { allToolDefinitions } from '../src/tools/ToolDefinitions';

// ---------------------------------------------------------------------------
// Name helpers
// ---------------------------------------------------------------------------

/** motion_tasks -> MotionTasks */
function toolNameToPrefix(name: string): string {
  return name
    .split('_')
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join('');
}

/** motion_tasks -> MotionTasksArgs */
function toInterfaceName(name: string): string {
  return `${toolNameToPrefix(name)}Args`;
}

/** motion_tasks -> Task, motion_custom_fields -> CustomField */
function toOperationPrefix(name: string): string {
  // Strip "motion_" prefix, then PascalCase the rest
  const rest = name.replace(/^motion_/, '');
  return rest
    .split('_')
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join('');
}

// ---------------------------------------------------------------------------
// JSON Schema -> TypeScript type string
// ---------------------------------------------------------------------------

interface SchemaNode {
  type?: string;
  enum?: (string | number)[];
  oneOf?: SchemaNode[];
  items?: SchemaNode;
  properties?: Record<string, SchemaNode>;
  required?: string[];
  minimum?: number;
  description?: string;
}

function schemaToTs(schema: SchemaNode, indent: number = 0): string {
  // oneOf → union of branches
  if (schema.oneOf) {
    const branches = schema.oneOf.map((b) => schemaToTs(b, indent));
    return branches.join(' | ');
  }

  // enum → literal union
  if (schema.enum) {
    return schema.enum.map((v) => (typeof v === 'string' ? `'${v}'` : String(v))).join(' | ');
  }

  // array
  if (schema.type === 'array' && schema.items) {
    const inner = schemaToTs(schema.items, indent);
    // Wrap union types in parens for array
    const needsParens = inner.includes('|');
    return needsParens ? `(${inner})[]` : `${inner}[]`;
  }

  // nested object with properties
  if (schema.type === 'object' && schema.properties) {
    return inlineObject(schema, indent);
  }

  // primitives
  switch (schema.type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    default:
      return 'unknown';
  }
}

function inlineObject(schema: SchemaNode, indent: number): string {
  const props = schema.properties ?? {};
  const req = new Set(schema.required ?? []);
  const pad = '  '.repeat(indent + 1);
  const closePad = '  '.repeat(indent);

  const lines: string[] = [];
  for (const [key, propSchema] of Object.entries(props)) {
    const opt = req.has(key) ? '' : '?';
    const tsType = schemaToTs(propSchema as SchemaNode, indent + 1);
    lines.push(`${pad}${key}${opt}: ${tsType};`);
  }

  return `{\n${lines.join('\n')}\n${closePad}}`;
}

// ---------------------------------------------------------------------------
// Check if a tool uses FrequencyObject (recurring tasks frequency property)
// ---------------------------------------------------------------------------

function needsFrequencyImport(definitions: typeof allToolDefinitions): boolean {
  for (const def of definitions) {
    const freqProp = (def.inputSchema.properties as Record<string, SchemaNode>)['frequency'];
    if (freqProp && freqProp.type === 'object' && freqProp.properties) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main generation
// ---------------------------------------------------------------------------

function generate(): string {
  const lines: string[] = [];

  lines.push('// AUTO-GENERATED — DO NOT EDIT MANUALLY');
  lines.push('// Source: scripts/generate-types.ts  |  Run: npm run generate:types');
  lines.push('');

  // Conditional FrequencyObject import
  if (needsFrequencyImport(allToolDefinitions)) {
    lines.push("import { FrequencyObject } from './motion';");
    lines.push('');
  }

  for (const def of allToolDefinitions) {
    const props = def.inputSchema.properties as Record<string, SchemaNode>;
    const required = new Set(def.inputSchema.required ?? []);
    const interfaceName = toInterfaceName(def.name);

    // Emit operation type alias if there's an operation enum
    const opProp = props['operation'];
    let operationTypeName: string | undefined;
    if (opProp?.enum && opProp.enum.length > 1) {
      operationTypeName = `${toOperationPrefix(def.name)}Operation`;
      const literals = opProp.enum.map((v) => `'${v}'`).join(' | ');
      lines.push(`export type ${operationTypeName} = ${literals};`);
      lines.push('');
    }

    // Emit interface
    lines.push(`export interface ${interfaceName} {`);

    for (const [key, propSchema] of Object.entries(props)) {
      const opt = required.has(key) ? '' : '?';

      // Special cases
      if (key === 'operation' && operationTypeName) {
        lines.push(`  ${key}${opt}: ${operationTypeName};`);
        continue;
      }

      // Use FrequencyObject for the frequency property on recurring tasks
      if (key === 'frequency' && propSchema.type === 'object' && propSchema.properties) {
        lines.push(`  ${key}${opt}: FrequencyObject;`);
        continue;
      }

      const tsType = schemaToTs(propSchema, 1);
      lines.push(`  ${key}${opt}: ${tsType};`);
    }

    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

const output = generate();
const outPath = path.resolve(__dirname, '..', 'src', 'types', 'mcp-tool-args.ts');
fs.writeFileSync(outPath, output, 'utf-8');
console.log(`Generated ${outPath}`);
