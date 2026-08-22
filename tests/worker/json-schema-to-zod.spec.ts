/**
 * Coverage for jsonSchemaToZodObject (issue #133, follow-up comment).
 *
 * This is the Worker path's only input validation: the stdio entry point runs
 * AJV, which the Worker cannot use because ajv.compile() generates code at
 * runtime and workerd forbids that. The contract worth pinning is that
 * `additionalProperties: false` survives the conversion, so the Worker rejects
 * unknown keys instead of silently stripping them.
 *
 * Runs in the worker project because src/utils/jsonSchemaToZod.ts is excluded
 * from the stdio build and only ships in the Worker bundle.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { jsonSchemaToZodObject } from "../../src/utils/jsonSchemaToZod";
import { allToolDefinitions, workspacesToolDefinition } from "../../src/tools/ToolDefinitions";

const workspacesSchema = () =>
  jsonSchemaToZodObject(
    workspacesToolDefinition.inputSchema as Parameters<typeof jsonSchemaToZodObject>[0]
  );

describe("jsonSchemaToZodObject", () => {
  it("returns a parseable schema rather than a raw shape", () => {
    const schema = workspacesSchema();

    expect(schema).toBeInstanceOf(z.ZodType);
    expect(typeof schema.safeParse).toBe("function");
  });

  it("accepts valid arguments", () => {
    const result = workspacesSchema().safeParse({ operation: "get", workspaceId: "ws-1" });

    expect(result.success).toBe(true);
  });

  it("rejects unknown properties instead of stripping them", () => {
    const result = workspacesSchema().safeParse({ operation: "list", notARealParam: "x" });

    expect(result.success).toBe(false);
  });

  it("does not silently strip an unknown key from the parsed output", () => {
    // The failure mode this guards: passing only `.shape` to registerTool() makes
    // the SDK rebuild a non-strict object, which parses successfully and drops
    // the unknown key. Assert the key never survives as accepted input.
    const result = workspacesSchema().safeParse({ operation: "list", notARealParam: "x" });

    expect(result.success ? Object.keys(result.data as object) : []).not.toContain("notARealParam");
  });

  it("stays permissive when the schema omits additionalProperties (control)", () => {
    // Control for the assertion above: proves the rejection comes from the
    // schema's additionalProperties: false, not from blanket zod strictness.
    const permissive = jsonSchemaToZodObject({
      type: "object",
      properties: { operation: { type: "string" } },
      required: ["operation"],
    });

    expect(permissive.safeParse({ operation: "list", extra: "x" }).success).toBe(true);
  });

  it("enforces required properties", () => {
    const result = workspacesSchema().safeParse({ workspaceId: "ws-1" });

    expect(result.success).toBe(false);
  });

  it("enforces enum membership", () => {
    const result = workspacesSchema().safeParse({ operation: "not-an-operation" });

    expect(result.success).toBe(false);
  });

  it.each(
    allToolDefinitions
      .filter((tool) => (tool.inputSchema as { additionalProperties?: boolean }).additionalProperties === false)
      .map((tool) => [tool.name, tool] as const)
  )("rejects unknown properties for %s", (_name, tool) => {
    const schema = jsonSchemaToZodObject(
      tool.inputSchema as Parameters<typeof jsonSchemaToZodObject>[0]
    );

    const result = schema.safeParse({ operation: "list", definitelyNotAParam: true });

    expect(result.success).toBe(false);
  });

  it("covers every tool definition that declares additionalProperties: false", () => {
    const strictCount = allToolDefinitions.filter(
      (tool) => (tool.inputSchema as { additionalProperties?: boolean }).additionalProperties === false
    ).length;

    // Guards the it.each above from silently covering nothing if the
    // definitions change shape.
    expect(strictCount).toBeGreaterThan(0);
    expect(strictCount).toBe(10);
  });
});
