/**
 * Authentication coverage for src/worker.ts (issue #133).
 *
 * These run inside workerd via @cloudflare/vitest-pool-workers rather than
 * Node, because the code under test depends on runtime behaviour Node does
 * not provide: crypto.subtle.timingSafeEqual is a Workers extension, and the
 * path rewrites go through Workers Request/URL semantics.
 *
 * MotionMCPAgent.serve()/mount() are stubbed so an authorized request can be
 * observed (which mode was chosen, and the exact URL handed to the agent)
 * without standing up a real MCP session against a Durable Object.
 */
import { env } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import worker, { MotionMCPAgent, secretsMatch } from "../../src/worker";

const SECRET = "test-worker-secret";

/** Sentinel status returned by the stubbed agent: the request was authorized. */
const AGENT_STATUS = 299;

type WorkerEnv = Parameters<typeof worker.fetch>[1];
type AgentCall = { mode: "serve" | "mount"; mountPath: string; url: string; method: string };

const testEnv = env as unknown as WorkerEnv;

let agentCalls: AgentCall[];

beforeEach(() => {
  agentCalls = [];
  for (const mode of ["serve", "mount"] as const) {
    vi.spyOn(MotionMCPAgent as unknown as Record<string, () => unknown>, mode).mockImplementation(
      ((mountPath: string) => ({
        fetch: async (request: Request) => {
          agentCalls.push({ mode, mountPath, url: request.url, method: request.method });
          return new Response("agent reached", { status: AGENT_STATUS });
        },
      })) as unknown as () => unknown
    );
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function fetchWorker(
  request: Request,
  overrideEnv: Partial<WorkerEnv> = {}
): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, { ...testEnv, ...overrideEnv } as WorkerEnv, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

/** The single call made to the stubbed agent; fails if the request never got there. */
function onlyAgentCall(): AgentCall {
  expect(agentCalls).toHaveLength(1);
  return agentCalls[0]!;
}

function agentUrl(): URL {
  return new URL(onlyAgentCall().url);
}

describe("worker auth", () => {
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
  });

  describe("health endpoint", () => {
    it.each(["/", "/health"])("serves %s without authentication", async (path) => {
      const response = await fetchWorker(new Request(`https://example.com${path}`));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok", server: "motion-mcp-server" });
      expect(agentCalls).toHaveLength(0);
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
      expect(agentCalls).toHaveLength(0);
    });

    it("returns 500 rather than authorizing a request whose empty secret would otherwise match", async () => {
      const response = await fetchWorker(
        new Request("https://example.com/mcp/", { headers: { Authorization: "Bearer " } }),
        { MOTION_MCP_SECRET: "" } as Partial<WorkerEnv>
      );

      expect(response.status).toBe(500);
      expect(agentCalls).toHaveLength(0);
    });

    it("returns 500 on the SSE message endpoint", async () => {
      const response = await fetchWorker(
        new Request("https://example.com/mcp/message?sessionId=abc", {
          method: "POST",
          body: JSON.stringify({ jsonrpc: "2.0", method: "ping", id: 1 }),
        }),
        { MOTION_MCP_SECRET: "" } as Partial<WorkerEnv>
      );

      expect(response.status).toBe(500);
      expect(agentCalls).toHaveLength(0);
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

      expect(response.status).toBe(AGENT_STATUS);
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

      expect(response.status).toBe(AGENT_STATUS);
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
      expect(agentCalls).toHaveLength(0);
    });
  });

  describe("path secret mode", () => {
    it("authorizes /mcp/<secret>", async () => {
      const response = await fetchWorker(new Request(`https://example.com/mcp/${SECRET}`));

      expect(response.status).toBe(AGENT_STATUS);
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
      expect(agentCalls).toHaveLength(0);
    });
  });

  describe("path rewriting", () => {
    // These assert what the Worker hands to the agent, not end-to-end
    // reachability. MotionMCPAgent.mount("/mcp") matches the stream on /mcp
    // only (agents/dist/mcp/index.js, basePattern), so a /mcp/sse sub-path is
    // rewritten correctly here and then 404s inside the SDK. That is
    // pre-existing product behavior; the rewrite is what these pin.

    it("preserves the path in Bearer mode and adds no secret query param", async () => {
      await fetchWorker(
        new Request("https://example.com/mcp/sse", { headers: { Authorization: `Bearer ${SECRET}` } })
      );

      const url = agentUrl();
      expect(url.pathname).toBe("/mcp/sse");
      expect(url.search).toBe("");
      expect(onlyAgentCall().url).not.toContain(SECRET);
    });

    it("strips the secret segment in path secret mode", async () => {
      await fetchWorker(new Request(`https://example.com/mcp/${SECRET}`, { method: "POST", body: "{}" }));

      expect(agentUrl().pathname).toBe("/mcp");
    });

    it("strips the secret segment and keeps the sub-path in path secret mode", async () => {
      await fetchWorker(new Request(`https://example.com/mcp/${SECRET}/sse`));

      expect(agentUrl().pathname).toBe("/mcp/sse");
    });

    it("carries the secret into the SSE stream URL so the agent advertises it", async () => {
      await fetchWorker(new Request(`https://example.com/mcp/${SECRET}/sse`));

      expect(agentUrl().searchParams.get("mcpSecret")).toBe(SECRET);
    });

    it("preserves the caller's query string in Bearer mode", async () => {
      await fetchWorker(
        new Request("https://example.com/mcp/sse?foo=bar&baz=1", {
          headers: { Authorization: `Bearer ${SECRET}` },
        })
      );

      const url = agentUrl();
      expect(url.searchParams.get("foo")).toBe("bar");
      expect(url.searchParams.get("baz")).toBe("1");
    });

    it("preserves the caller's query string in path secret mode", async () => {
      await fetchWorker(new Request(`https://example.com/mcp/${SECRET}/sse?foo=bar`));

      const url = agentUrl();
      expect(url.searchParams.get("foo")).toBe("bar");
      expect(url.searchParams.get("mcpSecret")).toBe(SECRET);
    });

    it("keeps sessionId on a message POST addressed with the secret in the path", async () => {
      // /mcp/<secret>/message does not match the dedicated message branch, so it
      // falls through to the generic rewrite. It must still reach the agent with
      // the session it names.
      await fetchWorker(
        new Request(`https://example.com/mcp/${SECRET}/message?sessionId=session-1`, {
          method: "POST",
          body: "{}",
        })
      );

      const url = agentUrl();
      expect(url.pathname).toBe("/mcp/message");
      expect(url.searchParams.get("sessionId")).toBe("session-1");
    });

    it.each([
      ["path secret mode", `/mcp/${SECRET}`, {}],
      ["Bearer mode", "/mcp", { Authorization: `Bearer ${SECRET}` }],
    ])("drops a caller-supplied sessionId when opening a stream in %s", async (_label, path, headers) => {
      // The SDK names the stream's Durable Object sse:<sessionId>, so honouring a
      // caller-supplied id would let two clients share one stream object and
      // receive each other's messages. Ids stay server-issued.
      await fetchWorker(
        new Request(`https://example.com${path}?sessionId=chosen-by-caller&keep=this`, { headers })
      );

      const url = agentUrl();
      expect(url.searchParams.has("sessionId")).toBe(false);
      expect(url.searchParams.get("keep")).toBe("this");
    });

    it("keeps sessionId on a message POST, which is not a stream open", async () => {
      await fetchWorker(
        new Request(`https://example.com/mcp/message?sessionId=session-1&mcpSecret=${encodeURIComponent(SECRET)}`, {
          method: "POST",
          body: "{}",
        })
      );

      expect(agentUrl().searchParams.get("sessionId")).toBe("session-1");
    });

    it("puts no secret on the URL for a GET to a message-shaped path", async () => {
      // A GET is not by itself a stream open: /mcp/<secret>/message authenticates
      // on the path secret and reaches mount(), but advertises nothing.
      await fetchWorker(new Request(`https://example.com/mcp/${SECRET}/message`));

      expect(agentUrl().pathname).toBe("/mcp/message");
      expect(agentUrl().searchParams.has("mcpSecret")).toBe(false);
      expect(onlyAgentCall().url).not.toContain(SECRET);
    });

    it("puts the secret on the URL only for SSE stream opens, never a message POST", async () => {
      // Nothing is advertised on a POST, so the secret on its URL would be a
      // pointless exposure via Workers trace events. The dedicated /mcp/message
      // branch strips the param; this fall-through path must agree with it.
      await fetchWorker(
        new Request(`https://example.com/mcp/${SECRET}/message?sessionId=session-1`, {
          method: "POST",
          body: "{}",
        })
      );

      expect(agentUrl().searchParams.has("mcpSecret")).toBe(false);
      expect(onlyAgentCall().url).not.toContain(SECRET);
    });

    it("drops a client-supplied mcpSecret param, which only this Worker may set", async () => {
      await fetchWorker(
        new Request("https://example.com/mcp/sse?mcpSecret=client-injected", {
          headers: { Authorization: `Bearer ${SECRET}` },
        })
      );

      expect(agentUrl().searchParams.has("mcpSecret")).toBe(false);
    });

    it("adds no secret query param when a Bearer client opens an SSE stream", async () => {
      await fetchWorker(
        new Request("https://example.com/mcp?foo=bar", {
          headers: { Authorization: `Bearer ${SECRET}` },
        })
      );

      const url = agentUrl();
      expect(url.searchParams.has("mcpSecret")).toBe(false);
      expect(url.searchParams.get("foo")).toBe("bar");
      expect(onlyAgentCall().url).not.toContain(SECRET);
    });
  });

  describe("transport selection", () => {
    it.each([
      ["POST /mcp", "POST", {}],
      ["DELETE /mcp", "DELETE", {}],
      ["GET /mcp with an mcp-session-id header", "GET", { "mcp-session-id": "session-1" }],
    ])("routes %s to serve() (streamable HTTP)", async (_label, method, extraHeaders) => {
      await fetchWorker(
        new Request("https://example.com/mcp", {
          method,
          headers: { Authorization: `Bearer ${SECRET}`, ...extraHeaders },
          ...(method === "GET" || method === "DELETE" ? {} : { body: "{}" }),
        })
      );

      expect(onlyAgentCall().mode).toBe("serve");
    });

    it("routes a bare GET /mcp to mount() (legacy SSE)", async () => {
      await fetchWorker(
        new Request("https://example.com/mcp", { headers: { Authorization: `Bearer ${SECRET}` } })
      );

      expect(onlyAgentCall().mode).toBe("mount");
    });

    it("routes a sub-path to mount()", async () => {
      await fetchWorker(
        new Request("https://example.com/mcp/sse", { headers: { Authorization: `Bearer ${SECRET}` } })
      );

      expect(onlyAgentCall().mode).toBe("mount");
    });
  });

  describe("SSE message endpoint", () => {
    function messageRequest(query: string, init: RequestInit = {}): Request {
      return new Request(`https://example.com/mcp/message?${query}`, {
        method: "POST",
        body: JSON.stringify({ jsonrpc: "2.0", method: "ping", id: 1 }),
        ...init,
      });
    }

    it("authorizes the secret carried on the advertised query param", async () => {
      const response = await fetchWorker(
        messageRequest(`sessionId=session-1&mcpSecret=${encodeURIComponent(SECRET)}`)
      );

      expect(response.status).toBe(AGENT_STATUS);
    });

    it("strips the secret param before the agent sees the request, keeping sessionId", async () => {
      await fetchWorker(messageRequest(`sessionId=session-1&mcpSecret=${encodeURIComponent(SECRET)}`));

      const url = agentUrl();
      expect(url.searchParams.has("mcpSecret")).toBe(false);
      expect(url.searchParams.get("sessionId")).toBe("session-1");
      expect(url.pathname).toBe("/mcp/message");
      expect(onlyAgentCall().url).not.toContain(SECRET);
    });

    it("authorizes a Bearer client without any query param", async () => {
      const response = await fetchWorker(
        messageRequest("sessionId=session-1", { headers: { Authorization: `Bearer ${SECRET}` } })
      );

      expect(response.status).toBe(AGENT_STATUS);
      expect(agentUrl().searchParams.has("mcpSecret")).toBe(false);
    });

    it.each([
      ["no credentials at all", "sessionId=session-1", {}],
      ["a wrong query secret", "sessionId=session-1&mcpSecret=wrong", {}],
      ["an empty query secret", "sessionId=session-1&mcpSecret=", {}],
    ])("rejects a message POST with %s", async (_label, query, init) => {
      const response = await fetchWorker(messageRequest(query, init));

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not found");
      expect(agentCalls).toHaveLength(0);
    });

    it("rejects a wrong Bearer token even when a valid query secret is present", async () => {
      const response = await fetchWorker(
        messageRequest(`sessionId=session-1&mcpSecret=${encodeURIComponent(SECRET)}`, {
          headers: { Authorization: "Bearer wrong-secret" },
        })
      );

      expect(response.status).toBe(404);
      expect(agentCalls).toHaveLength(0);
    });

    it("rejects a GET on the message endpoint", async () => {
      const response = await fetchWorker(
        new Request(`https://example.com/mcp/message?sessionId=session-1&mcpSecret=${encodeURIComponent(SECRET)}`)
      );

      expect(response.status).toBe(404);
      expect(agentCalls).toHaveLength(0);
    });

    it("does not apply the query-param secret fallback when sessionId is absent", async () => {
      const response = await fetchWorker(
        messageRequest(`mcpSecret=${encodeURIComponent(SECRET)}`)
      );

      expect(response.status).toBe(404);
      expect(agentCalls).toHaveLength(0);
    });
  });
});
