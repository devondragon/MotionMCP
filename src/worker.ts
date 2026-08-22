import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MotionApiService } from "./services/motionApi";
import { WorkspaceResolver } from "./utils/workspaceResolver";
import { InputValidator } from "./utils/validator";
import { HandlerFactory } from "./handlers/HandlerFactory";
import { ToolRegistry, ToolConfigurator } from "./tools";
import { jsonSchemaToZodObject } from "./utils/jsonSchemaToZod";
import { SERVER_INSTRUCTIONS } from "./utils/serverInstructions";

interface Env {
  MOTION_API_KEY: string;
  MOTION_MCP_SECRET: string;
  MOTION_MCP_TOOLS?: string;
  MCP_OBJECT: DurableObjectNamespace;
}

export class MotionMCPAgent extends McpAgent<Env> {
  server = new McpServer(
    { name: "motion-mcp-server", version: "2.8.0" },
    { instructions: SERVER_INSTRUCTIONS },
  );

  async init() {
    const motionService = new MotionApiService(this.env.MOTION_API_KEY);
    const workspaceResolver = new WorkspaceResolver(motionService);
    const validator = new InputValidator();
    const context = { motionService, workspaceResolver, validator };
    const handlerFactory = new HandlerFactory(context);

    const registry = new ToolRegistry();
    const configurator = new ToolConfigurator(
      this.env.MOTION_MCP_TOOLS || "complete",
      registry
    );
    const enabledTools = configurator.getEnabledTools();
    // No AJV validator init here: ajv.compile() uses runtime code generation,
    // which Cloudflare Workers disallows (EvalError). Input validation in the
    // Worker is handled by the Zod schemas passed to server.tool() below;
    // validateInput() is only called from the stdio entry point.

    for (const tool of enabledTools) {
      const inputSchema = jsonSchemaToZodObject(tool.inputSchema as Parameters<typeof jsonSchemaToZodObject>[0]);

      this.server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema,
        },
        async (params) => {
          const handler = handlerFactory.createHandler(tool.name);
          return await handler.handle(params);
        }
      );
    }
  }
}

/**
 * Constant-time secret comparison.
 *
 * Hashes both values with SHA-256 and compares the digests with
 * crypto.subtle.timingSafeEqual. timingSafeEqual requires equal-length
 * buffers; the fixed-length (32-byte) SHA-256 digests always satisfy that,
 * so inputs of differing length are handled without leaking length via an
 * early return. Hashing also avoids a direct timing signal on the raw
 * secret bytes.
 *
 * Exported so the Worker auth tests can exercise it directly under workerd.
 */
export async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(providedDigest, expectedDigest);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", server: "motion-mcp-server" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Fail closed if no secret is configured, rather than relying on
    // secretsMatch below to reject an unset/empty expected secret. This also
    // guarantees the secret passed to secretsMatch is non-empty, so an empty
    // provided secret (e.g. `Authorization: Bearer ` or a missing path
    // segment) can never match.
    if (!env.MOTION_MCP_SECRET) {
      return new Response("Server misconfigured", { status: 500 });
    }

    const pathParts = url.pathname.split("/").filter(Boolean);

    // Two authentication modes, both compared in constant time:
    //   1. Authorization: Bearer <secret> header (preferred; keeps the secret
    //      out of the URL for header-capable clients). The path is already
    //      clean in this mode (e.g. /mcp or /mcp/sse), so no rewrite is needed.
    //   2. URL path secret: /mcp/<secret>/... (backward compatible). Clients
    //      configure URL as https://your-worker.workers.dev/mcp/YOUR_SECRET.
    // If a Bearer header is present it is used; otherwise the path segment is.
    const authHeader = request.headers.get("Authorization");
    // The "Bearer" auth scheme name is case-insensitive per RFC 7235 — match it
    // that way so clients sending e.g. "bearer <secret>" aren't forced to fall
    // back to the legacy path-secret mode.
    const bearerMatch = authHeader ? /^Bearer[ \t]+(.+)$/i.exec(authHeader) : null;
    const bearerSecret = bearerMatch ? (bearerMatch[1] ?? "").trim() : null;
    const usedBearer = bearerSecret !== null;

    // Query param that carries the secret on the legacy-SSE message endpoint.
    // The agent's `endpoint` event advertises /mcp/message?sessionId=... with no
    // secret path segment, so for path-secret clients we thread the secret
    // through this param (see the message branch and the SSE-GET rewrite below).
    const SSE_SECRET_PARAM = "mcpSecret";

    // Legacy SSE message endpoint (POST /mcp/message?sessionId=...). It must be
    // authenticated like every other path: the agents SDK spins up a Durable
    // Object for ANY sessionId with no check that the id was issued on a
    // secret-authenticated stream, so an unauthenticated POST here would
    // otherwise be able to invoke tools. Accept the Bearer header, or the secret
    // carried on the advertised endpoint's query param; strip the param before
    // handing the request to the agent.
    if (
      pathParts[0] === "mcp" &&
      pathParts[1] === "message" &&
      request.method === "POST" &&
      url.searchParams.has("sessionId")
    ) {
      const messageSecret = usedBearer
        ? bearerSecret
        : (url.searchParams.get(SSE_SECRET_PARAM) ?? "");
      if (!(await secretsMatch(messageSecret, env.MOTION_MCP_SECRET))) {
        return new Response("Not found", { status: 404 });
      }
      const messageUrl = new URL(request.url);
      messageUrl.searchParams.delete(SSE_SECRET_PARAM);
      const messageRequest = new Request(messageUrl, request);
      return (
        MotionMCPAgent.mount("/mcp") as { fetch: (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response> }
      ).fetch(messageRequest, env, ctx);
    }

    const providedSecret = usedBearer ? bearerSecret : (pathParts[1] ?? "");

    if (pathParts[0] !== "mcp" || !(await secretsMatch(providedSecret, env.MOTION_MCP_SECRET))) {
      return new Response("Not found", { status: 404 });
    }

    // Determine the path passed to McpAgent. With Bearer auth the path carries
    // no secret segment to strip; with path-secret auth, strip the secret.
    // e.g., /mcp/SECRET -> /mcp, /mcp/SECRET/sse -> /mcp/sse
    const cleanPath = usedBearer
      ? "/" + pathParts.join("/")
      : "/mcp" + (pathParts.length > 2 ? "/" + pathParts.slice(2).join("/") : "");
    // Carry the caller's query string across the rewrite. Only the path holds
    // the secret in path-secret mode, so building the rewritten URL from the
    // path alone silently dropped every query param the agent needs (notably
    // sessionId on a message POST that did not match the branch above).
    // SSE_SECRET_PARAM is this Worker's own signalling param: drop whatever a
    // client sent under that name so only the value set below reaches the agent.
    const cleanUrl = new URL(cleanPath, url.origin);
    cleanUrl.search = url.search;
    cleanUrl.searchParams.delete(SSE_SECRET_PARAM);

    // Streamable HTTP (POST/DELETE /mcp, or GET with an mcp-session-id header)
    // is served by serve(); a bare GET on /mcp is a legacy SSE stream via mount().
    const isStreamableHttp =
      cleanPath === "/mcp" &&
      (request.method !== "GET" || request.headers.has("mcp-session-id"));

    // Opening a legacy SSE stream (path-secret mode): carry the secret into the
    // stream URL so the agent advertises it on the message endpoint it emits.
    // The client echoes that endpoint on its subsequent POST /mcp/message, which
    // the branch above then authenticates. Bearer clients send the header on the
    // POST instead, so no param is added for them (keeping the secret out of the
    // URL, which is the point of Bearer mode).
    //
    // Restricted to GET, the only method that opens a stream. Other requests
    // reaching mount() (e.g. a message POST addressed as /mcp/<secret>/message,
    // which does not match the branch above) have nothing to advertise, and the
    // secret on their URL would be a pointless exposure: an exception inside the
    // Durable Object surfaces the request URL in Workers trace events, so it
    // would reach `wrangler tail` and any Logpush sink. The dedicated message
    // branch strips the param for the same reason.
    if (!isStreamableHttp && !usedBearer && request.method === "GET") {
      cleanUrl.searchParams.set(SSE_SECRET_PARAM, env.MOTION_MCP_SECRET);
    }

    const cleanRequest = new Request(cleanUrl, request);

    return (
      (isStreamableHttp
        ? MotionMCPAgent.serve("/mcp")
        : MotionMCPAgent.mount("/mcp")) as { fetch: (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response> }
    ).fetch(cleanRequest, env, ctx);
  },
};
