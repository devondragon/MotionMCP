/**
 * Authentication and transport coverage for src/worker.ts (issues #133, #158).
 *
 * These run inside workerd via @cloudflare/vitest-pool-workers rather than
 * Node, because the code under test depends on runtime behaviour Node does
 * not provide: crypto.subtle.timingSafeEqual is a Workers extension, and the
 * path rewrites go through Workers Request/URL semantics.
 *
 * Two layers are covered:
 *
 * - The auth gate and path rewriting. `mcpTransport.handle` is stubbed so an
 *   authorized request can be observed (the exact URL and method handed to
 *   the MCP handler) without serving a real MCP exchange.
 * - The stateless MCP handler itself (createMcpHandler, issue #158). These
 *   run unstubbed, end to end through the Worker's default export, and speak
 *   JSON-RPC over streamable HTTP to the real handler. The one successful
 *   tools/call stubs the tool handler, since a real one would reach
 *   Motion's REST API; everything up to and after that handler is real.
 */
import { env } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import worker, { mcpTransport, secretsMatch } from "../../src/worker";
import { HandlerFactory } from "../../src/handlers/HandlerFactory";
import type { BaseHandler } from "../../src/handlers/base/BaseHandler";

const SECRET = "test-worker-secret";

/** Sentinel status returned by the stubbed transport: the request was authorized. */
const TRANSPORT_STATUS = 299;

type WorkerEnv = Parameters<typeof worker.fetch>[1];
type TransportCall = { url: string; method: string };

const testEnv = env as unknown as WorkerEnv;

async function fetchWorker(
  request: Request,
  overrideEnv: Partial<WorkerEnv> = {}
): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, { ...testEnv, ...overrideEnv } as WorkerEnv, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

describe("worker auth", () => {
  let transportCalls: TransportCall[];

  beforeEach(() => {
    transportCalls = [];
    vi.spyOn(mcpTransport, "handle").mockImplementation(async (request: Request) => {
      transportCalls.push({ url: request.url, method: request.method });
      return new Response("transport reached", { status: TRANSPORT_STATUS });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** The single call made to the stubbed transport; fails if the request never got there. */
  function onlyTransportCall(): TransportCall {
    expect(transportCalls).toHaveLength(1);
    return transportCalls[0]!;
  }

  function transportUrl(): URL {
    return new URL(onlyTransportCall().url);
  }

  describe("test bindings", () => {
    it("uses fake credentials, never values from a local .env", () => {
      const bound = testEnv as unknown as Record<string, string>;
      expect(bound.MOTION_MCP_SECRET).toBe(SECRET);
      expect(bound.MOTION_API_KEY).toBe("test-motion-api-key");
    });

    it("runs on a runtime that provides crypto.subtle.timingSafeEqual", () => {
      expect(typeof (crypto.subtle as unknown as { timingSafeEqual?: unknown }).timingSafeEqual).toBe(
        "function"
      );
    });

    it("binds no Durable Object: the MCP transport is stateless (issue #158)", () => {
      expect((testEnv as unknown as Record<string, unknown>).MCP_OBJECT).toBeUndefined();
    });
  });

  describe("health endpoint", () => {
    it.each(["/", "/health"])("serves %s without authentication", async (path) => {
      const response = await fetchWorker(new Request(`https://example.com${path}`));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok", server: "motion-mcp-server" });
      expect(transportCalls).toHaveLength(0);
    });

    it("still serves health when no secret is configured", async () => {
      const response = await fetchWorker(new Request("https://example.com/health"), {
        MOTION_MCP_SECRET: "",
      } as Partial<WorkerEnv>);

      expect(response.status).toBe(200);
    });
  });

  describe("fails closed when MOTION_MCP_SECRET is unset", () => {
    const unsetVariants: Array<[string, Partial<WorkerEnv>]> = [
      ["empty string", { MOTION_MCP_SECRET: "" } as Partial<WorkerEnv>],
      ["undefined", { MOTION_MCP_SECRET: undefined } as unknown as Partial<WorkerEnv>],
    ];

    it.each(unsetVariants)("returns 500 for an unauthenticated request (%s)", async (_label, override) => {
      const response = await fetchWorker(new Request("https://example.com/mcp"), override);

      expect(response.status).toBe(500);
      expect(await response.text()).toBe("Server misconfigured");
      expect(transportCalls).toHaveLength(0);
    });

    it("returns 500 rather than authorizing a request whose empty secret would otherwise match", async () => {
      const response = await fetchWorker(
        new Request("https://example.com/mcp/", { headers: { Authorization: "Bearer " } }),
        { MOTION_MCP_SECRET: "" } as Partial<WorkerEnv>
      );

      expect(response.status).toBe(500);
      expect(transportCalls).toHaveLength(0);
    });
  });

  describe("CORS preflight (issue #138)", () => {
    // A browser strips Authorization from a preflight, so an OPTIONS under /mcp
    // carries no credential. The Worker answers it before the auth gate, with
    // the same CORS headers the agents SDK emits, so the real request that
    // follows is allowed. The preflight itself never reaches the transport.

    it("answers OPTIONS /mcp without auth, with CORS headers", async () => {
      const response = await fetchWorker(
        new Request("https://example.com/mcp", {
          method: "OPTIONS",
          headers: {
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization, content-type",
          },
        })
      );

      expect(response.status).toBe(200);
      expect(transportCalls).toHaveLength(0);

      const allowHeaders = response.headers.get("Access-Control-Allow-Headers")!;
      expect(allowHeaders.toLowerCase()).toContain("authorization");
      expect(allowHeaders.toLowerCase()).toContain("mcp-session-id");
      expect(allowHeaders.toLowerCase()).toContain("mcp-protocol-version");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, DELETE, OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
    });

    it("answers OPTIONS /mcp/<secret> with CORS headers", async () => {
      const response = await fetchWorker(
        new Request(`https://example.com/mcp/${SECRET}`, { method: "OPTIONS" })
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(transportCalls).toHaveLength(0);
    });

    it("does not answer OPTIONS outside /mcp", async () => {
      // The preflight responder is scoped to /mcp; other paths fall through to
      // the auth gate, which rejects a non-mcp prefix.
      const response = await fetchWorker(
        new Request("https://example.com/other", { method: "OPTIONS" })
      );

      expect(response.status).toBe(404);
      expect(transportCalls).toHaveLength(0);
    });

    it("leaves non-OPTIONS auth unchanged: POST /mcp with no credential still 404s", async () => {
      const response = await fetchWorker(
        new Request("https://example.com/mcp", { method: "POST", body: "{}" })
      );

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not found");
      expect(transportCalls).toHaveLength(0);
    });
  });

  describe("secretsMatch", () => {
    it("accepts the correct secret", async () => {
      await expect(secretsMatch(SECRET, SECRET)).resolves.toBe(true);
    });

    it("rejects a wrong secret of the same length", async () => {
      await expect(secretsMatch("test-worker-secreT", SECRET)).resolves.toBe(false);
    });

    it.each([
      ["shorter", "test"],
      ["longer", `${SECRET}-with-more-characters`],
      ["empty", ""],
    ])("rejects a %s input without a length-based early return", async (_label, provided) => {
      await expect(secretsMatch(provided, SECRET)).resolves.toBe(false);
    });

    it("compares multi-byte input by its bytes", async () => {
      await expect(secretsMatch("sécret-ünicode", "sécret-ünicode")).resolves.toBe(true);
      await expect(secretsMatch("sécret-unicode", "sécret-ünicode")).resolves.toBe(false);
    });

    it("returns true for two empty strings, which is why the unset-secret guard exists", async () => {
      await expect(secretsMatch("", "")).resolves.toBe(true);
    });
  });

  describe("Bearer token mode", () => {
    it("authorizes the correct token", async () => {
      const response = await fetchWorker(
        new Request("https://example.com/mcp", {
          method: "POST",
          headers: { Authorization: `Bearer ${SECRET}` },
          body: "{}",
        })
      );

      expect(response.status).toBe(TRANSPORT_STATUS);
    });

    it.each([
      ["lowercase scheme", `bearer ${SECRET}`],
      ["mixed-case scheme", `BeArEr ${SECRET}`],
      ["tab separator", `Bearer\t${SECRET}`],
      ["extra whitespace", `Bearer   ${SECRET}   `],
    ])("accepts %s", async (_label, header) => {
      const response = await fetchWorker(
        new Request("https://example.com/mcp", { method: "POST", headers: { Authorization: header }, body: "{}" })
      );

      expect(response.status).toBe(TRANSPORT_STATUS);
    });

    it.each([
      ["a wrong token", `Bearer wrong-${SECRET}`],
      ["a token differing only in case", `Bearer ${SECRET.toUpperCase()}`],
      ["a present-but-empty token", "Bearer "],
      ["the bare scheme name", "Bearer"],
      ["a non-Bearer scheme carrying the secret", `Basic ${SECRET}`],
    ])("rejects %s with 404", async (_label, header) => {
      const response = await fetchWorker(
        new Request("https://example.com/mcp", { method: "POST", headers: { Authorization: header }, body: "{}" })
      );

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not found");
      expect(transportCalls).toHaveLength(0);
    });
  });

  describe("path secret mode", () => {
    it("authorizes /mcp/<secret>", async () => {
      const response = await fetchWorker(
        new Request(`https://example.com/mcp/${SECRET}`, { method: "POST", body: "{}" })
      );

      expect(response.status).toBe(TRANSPORT_STATUS);
    });

    it.each([
      ["a wrong secret", `/mcp/wrong-${SECRET}`],
      ["a secret with an extra suffix", `/mcp/${SECRET}x`],
      ["no secret segment", "/mcp"],
      ["a collapsed empty segment, leaving \"sse\" in the secret slot", "/mcp//sse"],
      ["a non-mcp prefix", `/notmcp/${SECRET}`],
      ["the secret at the wrong position", `/${SECRET}/mcp`],
    ])("rejects %s with 404", async (_label, path) => {
      const response = await fetchWorker(new Request(`https://example.com${path}`));

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not found");
      expect(transportCalls).toHaveLength(0);
    });
  });

  describe("sub-path rejection (issues #141, #158)", () => {
    // The stateless handler serves exactly one route, /mcp. The retired
    // HTTP+SSE transport advertised sub-paths (/mcp/sse, /mcp/message); a
    // client still addressing one is rejected at the Worker, in both auth
    // modes, before anything reaches the handler. In path-secret mode that
    // also keeps the secret off any URL the handler could surface in a trace.

    it.each([
      ["GET /mcp/<secret>/sse", `/mcp/${SECRET}/sse`, "GET", {}],
      ["POST /mcp/<secret>/message?sessionId=abc", `/mcp/${SECRET}/message?sessionId=abc`, "POST", {}],
      ["GET /mcp/<secret>/anything-else", `/mcp/${SECRET}/anything-else`, "GET", {}],
      ["GET /mcp/sse (Bearer)", "/mcp/sse", "GET", { Authorization: `Bearer ${SECRET}` }],
      [
        "POST /mcp/message?sessionId=abc (Bearer)",
        "/mcp/message?sessionId=abc",
        "POST",
        { Authorization: `Bearer ${SECRET}` },
      ],
    ])("rejects %s with 404 and never reaches the transport", async (_label, path, method, headers) => {
      const response = await fetchWorker(
        new Request(`https://example.com${path}`, {
          method,
          headers,
          ...(method === "POST" ? { body: "{}" } : {}),
        })
      );

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not found");
      expect(transportCalls).toHaveLength(0);
    });

    it("rejects the legacy message endpoint without any credential", async () => {
      const response = await fetchWorker(
        new Request("https://example.com/mcp/message?sessionId=abc", {
          method: "POST",
          body: JSON.stringify({ jsonrpc: "2.0", method: "ping", id: 1 }),
        })
      );

      expect(response.status).toBe(404);
      expect(transportCalls).toHaveLength(0);
    });
  });

  describe("path rewriting", () => {
    // These assert what the Worker hands to the transport: always the bare
    // /mcp route, never the secret, never a caller query param.

    it("preserves /mcp in Bearer mode and adds nothing", async () => {
      await fetchWorker(
        new Request("https://example.com/mcp", {
          method: "POST",
          headers: { Authorization: `Bearer ${SECRET}` },
          body: "{}",
        })
      );

      const url = transportUrl();
      expect(url.pathname).toBe("/mcp");
      expect(url.search).toBe("");
      expect(onlyTransportCall().url).not.toContain(SECRET);
    });

    it("strips the secret segment in path secret mode", async () => {
      await fetchWorker(new Request(`https://example.com/mcp/${SECRET}`, { method: "POST", body: "{}" }));

      const url = transportUrl();
      expect(url.pathname).toBe("/mcp");
      expect(onlyTransportCall().url).not.toContain(SECRET);
    });

    it.each([
      ["Bearer mode", "/mcp", { Authorization: `Bearer ${SECRET}` }],
      ["path secret mode", `/mcp/${SECRET}`, {}],
    ])("forwards no caller query params in %s", async (_label, path, headers) => {
      // The handler reads only the pathname. Anything a client appends is
      // inert to it and is not carried across, so an unaudited value can
      // never reach the handler or its logs.
      await fetchWorker(
        new Request(`https://example.com${path}?sessionId=chosen-by-caller&foo=bar`, {
          method: "POST",
          headers,
          body: "{}",
        })
      );

      const url = transportUrl();
      expect(url.pathname).toBe("/mcp");
      expect(url.search).toBe("");
    });

    it("preserves the method and passes the origin through unchanged", async () => {
      await fetchWorker(
        new Request(`https://worker.example.com/mcp/${SECRET}`, { method: "DELETE" })
      );

      const call = onlyTransportCall();
      expect(call.method).toBe("DELETE");
      expect(new URL(call.url).origin).toBe("https://worker.example.com");
    });

    it.each([
      ["POST", { body: "{}" }],
      ["GET", {}],
      ["DELETE", {}],
    ])("hands %s /mcp to the transport rather than routing by method", async (method, init) => {
      // The previous transport split GET (legacy SSE via mount) from
      // POST/DELETE (streamable HTTP via serve). The stateless handler owns
      // that decision now; the Worker forwards every authenticated method.
      await fetchWorker(
        new Request("https://example.com/mcp", {
          method,
          headers: { Authorization: `Bearer ${SECRET}` },
          ...init,
        })
      );

      expect(onlyTransportCall().method).toBe(method);
    });
  });
});

describe("stateless MCP handler (issue #158)", () => {
  // End to end through the real createMcpHandler. Clients today speak the
  // 2025-11-25 streamable HTTP protocol (the era the tailed claude.ai
  // connector uses); the stateless handler serves each such POST with a
  // fresh McpServer and no session, and answers the session operations GET
  // and DELETE with 405.

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const JSON_RPC_HEADERS = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  type JsonRpcResponse = { jsonrpc: "2.0"; id: number; result?: Record<string, unknown>; error?: unknown };

  /** Extracts the JSON-RPC messages from a JSON or SSE-framed streamable HTTP response body. */
  async function readJsonRpc(response: Response): Promise<JsonRpcResponse[]> {
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    if (contentType.includes("application/json")) {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [parsed];
    }
    expect(contentType).toContain("text/event-stream");
    return text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => JSON.parse(line.slice("data:".length).trim()));
  }

  function initializeRequest(id = 1): string {
    return JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "worker-spec", version: "0.0.0" },
      },
    });
  }

  async function initialize(path: string, headers: Record<string, string> = {}): Promise<Response> {
    return fetchWorker(
      new Request(`https://example.com${path}`, {
        method: "POST",
        headers: { ...JSON_RPC_HEADERS, ...headers },
        body: initializeRequest(),
      })
    );
  }

  it.each([
    ["Bearer mode", "/mcp", { Authorization: `Bearer ${SECRET}` }],
    ["path secret mode", `/mcp/${SECRET}`, {}],
  ])("answers initialize on /mcp in %s", async (_label, path, headers) => {
    const response = await initialize(path, headers);

    expect(response.status).toBe(200);
    const [message] = await readJsonRpc(response);
    expect(message?.id).toBe(1);
    expect(message?.error).toBeUndefined();
    expect(message?.result).toMatchObject({
      serverInfo: { name: "motion-mcp-server" },
      capabilities: { tools: expect.any(Object) },
    });
    expect((message?.result as { instructions?: string }).instructions).toEqual(expect.any(String));
  });

  it("issues no session: the handler is stateless", async () => {
    const response = await initialize("/mcp", { Authorization: `Bearer ${SECRET}` });

    expect(response.status).toBe(200);
    expect(response.headers.get("mcp-session-id")).toBeNull();
  });

  it("lists the tools of the configured tier without an initialize on the same connection", async () => {
    // Each POST gets a fresh server, so tools/list must stand on its own. This
    // is exactly what a 2025-era client does on its second request once it
    // received no session id. The tier comes from wrangler.toml [vars]
    // (essential), so the count pins that binding reaches the Worker too.
    const response = await fetchWorker(
      new Request("https://example.com/mcp", {
        method: "POST",
        headers: { ...JSON_RPC_HEADERS, Authorization: `Bearer ${SECRET}` },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
      })
    );

    expect(response.status).toBe(200);
    const [message] = await readJsonRpc(response);
    const tools = (message?.result as { tools: Array<{ name: string; inputSchema: unknown }> }).tools;
    const names = tools.map((tool) => tool.name).sort();
    expect(names).toEqual([
      "motion_comments",
      "motion_projects",
      "motion_schedules",
      "motion_search",
      "motion_statuses",
      "motion_tasks",
      "motion_users",
      "motion_workspaces",
    ]);
    // The strict schemas survive the JSON Schema -> Zod -> JSON Schema round trip.
    for (const tool of tools) {
      expect(tool.inputSchema).toMatchObject({ type: "object", additionalProperties: false });
    }
  });

  async function listToolNames(overrideEnv: Partial<WorkerEnv> = {}): Promise<string[]> {
    const response = await fetchWorker(
      new Request("https://example.com/mcp", {
        method: "POST",
        headers: { ...JSON_RPC_HEADERS, Authorization: `Bearer ${SECRET}` },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
      }),
      overrideEnv
    );
    expect(response.status).toBe(200);
    const [message] = await readJsonRpc(response);
    return (message?.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name).sort();
  }

  const ESSENTIAL_TOOLS = [
    "motion_comments",
    "motion_projects",
    "motion_schedules",
    "motion_search",
    "motion_statuses",
    "motion_tasks",
    "motion_users",
    "motion_workspaces",
  ];
  const MINIMAL_TOOLS = ["motion_projects", "motion_tasks", "motion_workspaces"];

  it("rebuilds the per-isolate runtime when the bindings that shape it change, both ways", async () => {
    // The runtime (tool table, handler factory, handler) is cached at module
    // scope and keyed on the bindings it was built from. The module-scope
    // cache persists across tests in this file, so each step asserts its own
    // expected set rather than relying on order: hit or miss, the tools
    // served must always be the ones for the env of that request.
    expect(await listToolNames()).toEqual(ESSENTIAL_TOOLS);
    expect(await listToolNames({ MOTION_MCP_TOOLS: "minimal" } as Partial<WorkerEnv>)).toEqual(MINIMAL_TOOLS);
    expect(await listToolNames()).toEqual(ESSENTIAL_TOOLS);
    expect(await listToolNames({ MOTION_MCP_TOOLS: "minimal" } as Partial<WorkerEnv>)).toEqual(MINIMAL_TOOLS);
  });

  async function callTool(id: number, name: string, args: Record<string, unknown>): Promise<JsonRpcResponse> {
    const response = await fetchWorker(
      new Request("https://example.com/mcp", {
        method: "POST",
        headers: { ...JSON_RPC_HEADERS, Authorization: `Bearer ${SECRET}` },
        body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }),
      })
    );
    expect(response.status).toBe(200);
    const [message] = await readJsonRpc(response);
    expect(message?.id).toBe(id);
    return message!;
  }

  it("rejects a tools/call whose arguments fail the tool's schema before any handler runs", async () => {
    // "operation" is required by every tool and validated by the Zod schema
    // the Worker registers, so this never reaches the handler or Motion's API.
    const createHandler = vi.spyOn(HandlerFactory.prototype, "createHandler");

    const message = await callTool(3, "motion_workspaces", { unknownProperty: true });

    expect(createHandler).not.toHaveBeenCalled();
    const result = message.result as { isError?: boolean; content: Array<{ type: string; text: string }> };
    expect(message.error).toBeUndefined();
    expect(result.isError).toBe(true);
    // The message is produced by schema validation and names the input, not a
    // generic failure: it mentions the required "operation" key the caller omitted.
    const text = result.content.map((item) => item.text).join("\n");
    expect(text).toMatch(/operation/);
    expect(text).toMatch(/validation|invalid/i);
  });

  it("answers a call to a tool that is not registered with a different error than a schema failure", async () => {
    // Negative control for the schema test above: an unknown tool is a
    // JSON-RPC error, not an isError result, so the two cannot both pass on
    // one generic failure path.
    const message = await callTool(4, "motion_nonexistent", { operation: "list" });

    expect(message.result).toBeUndefined();
    expect((message.error as { code: number; message: string }).message).toMatch(/motion_nonexistent/);
  });

  it("serves a successful tools/call through the real handler and shares one handler factory across requests", async () => {
    // The tool handler is stubbed (a real one would call Motion's API); the
    // path from JSON-RPC through the v2 McpServer, the registered Zod schema,
    // the per-isolate HandlerFactory and back onto the wire is real. The
    // stub's `this` is the factory the Worker called, so two requests hitting
    // the same instance proves the runtime is reused rather than rebuilt.
    const stubResult = {
      content: [{ type: "text" as const, text: "stubbed workspaces" }],
      structuredContent: { workspaces: [{ id: "ws_1", name: "Personal" }] },
    };
    const createHandler = vi
      .spyOn(HandlerFactory.prototype, "createHandler")
      .mockImplementation(function (this: HandlerFactory) {
        return { handle: async () => stubResult } as unknown as BaseHandler;
      });

    const first = await callTool(5, "motion_workspaces", { operation: "list" });
    const second = await callTool(6, "motion_workspaces", { operation: "list" });

    for (const message of [first, second]) {
      expect(message.error).toBeUndefined();
      expect(message.result).toMatchObject(stubResult);
      expect((message.result as { isError?: boolean }).isError).toBeUndefined();
    }
    expect(createHandler).toHaveBeenCalledTimes(2);
    expect(createHandler.mock.calls.map(([name]) => name)).toEqual(["motion_workspaces", "motion_workspaces"]);
    expect(createHandler.mock.contexts[0]).toBeInstanceOf(HandlerFactory);
    expect(createHandler.mock.contexts[1]).toBe(createHandler.mock.contexts[0]);
  });

  it.each(["GET", "DELETE"])("answers %s /mcp with 405: no sessions exist to stream or close", async (method) => {
    const response = await fetchWorker(
      new Request("https://example.com/mcp", {
        method,
        headers: { Accept: "application/json, text/event-stream", Authorization: `Bearer ${SECRET}` },
      })
    );

    expect(response.status).toBe(405);
  });

  it("serves a second POST after the first with no shared session state", async () => {
    const first = await initialize("/mcp", { Authorization: `Bearer ${SECRET}` });
    const second = await initialize("/mcp", { Authorization: `Bearer ${SECRET}` });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.headers.get("mcp-session-id")).toBeNull();
    expect(second.headers.get("mcp-session-id")).toBeNull();
    const [message] = await readJsonRpc(second);
    expect(message?.error).toBeUndefined();
  });

  it("answers a preflight with the same CORS headers the Worker's own responder hardcodes", async () => {
    // The Worker answers OPTIONS before the auth gate with a header set that
    // is meant to mirror the handler's defaults exactly. Driving the handler
    // directly with the same preflight pins that: an agents SDK bump that
    // changes its defaults fails here instead of silently desyncing.
    const preflight = () =>
      new Request("https://example.com/mcp", {
        method: "OPTIONS",
        headers: { Origin: "https://app.example", "Access-Control-Request-Method": "POST" },
      });
    const ctx = createExecutionContext();
    const fromHandler = await mcpTransport.handle(preflight(), testEnv, ctx);
    await waitOnExecutionContext(ctx);
    const fromWorker = await fetchWorker(preflight());

    expect(fromHandler.status).toBe(200);
    expect(fromWorker.status).toBe(200);
    // Header names are case-insensitive; key on the lowercased name so the
    // comparison does not depend on how a runtime reports casing.
    const corsHeaders = (response: Response) =>
      Object.fromEntries(
        [...response.headers.entries()]
          .map(([name, value]) => [name.toLowerCase(), value] as const)
          .filter(([name]) => name.startsWith("access-control-"))
      );
    expect(corsHeaders(fromWorker)).toEqual(corsHeaders(fromHandler));
  });

  it("still gates the handler: an unauthenticated initialize never reaches it", async () => {
    const response = await initialize("/mcp");

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });
});
