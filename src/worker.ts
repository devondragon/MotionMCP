import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler, type StatelessMcpHandler } from "agents/mcp/server";
import type { z } from "zod";
import { MotionApiService } from "./services/motionApi";
import { WorkspaceResolver } from "./utils/workspaceResolver";
import { InputValidator } from "./utils/validator";
import { HandlerFactory } from "./handlers/HandlerFactory";
import { ToolRegistry, ToolConfigurator } from "./tools";
import { jsonSchemaToZodObject } from "./utils/jsonSchemaToZod";
import { SERVER_INSTRUCTIONS } from "./utils/serverInstructions";
import { mcpLog } from "./utils/logger";
import { LOG_LEVELS } from "./utils/constants";

interface Env {
  MOTION_API_KEY: string;
  MOTION_MCP_SECRET: string;
  MOTION_MCP_TOOLS?: string;
}

const SERVER_INFO = { name: "motion-mcp-server", version: "2.9.0" };

/** The single route the MCP handler serves. Everything under /mcp is rewritten to it. */
const MCP_ROUTE = "/mcp";

/** One enabled tool, with its JSON Schema already converted to Zod. */
interface PreparedTool {
  name: string;
  description: string;
  inputSchema: z.ZodType;
}

/**
 * Everything that can be built once per isolate and shared by every request:
 * the Motion API client (whose workspace/project caches are the reason to
 * share it), the handler factory bound to it, the enabled tool set with each
 * schema converted to Zod, and the stateless MCP handler.
 *
 * The previous McpAgent kept one MotionApiService per Durable Object session,
 * so name-to-id lookups stayed warm across a client's tool calls. The
 * stateless handler constructs a fresh McpServer per request, so if the
 * service were built inside the factory every tools/call would start with a
 * cold cache and pay extra Motion API round-trips against its rate limit.
 * Holding these at module scope keeps the caches warm for the isolate's
 * lifetime instead. The handlers themselves keep no per-session state (each
 * tools/call goes straight to Motion's REST API), which is what makes the
 * stateless path correct.
 */
interface WorkerRuntime {
  key: string;
  tools: PreparedTool[];
  handlerFactory: HandlerFactory;
  handler: StatelessMcpHandler;
}

let runtime: WorkerRuntime | undefined;

/**
 * Bindings are fixed for a deployment, so a change to the values that shape
 * the runtime (API key, tool tier) only arrives with a fresh isolate. The key
 * check guards the one case where they could differ within an isolate, such
 * as tests overriding bindings per request, so a stale runtime is never served.
 */
function runtimeKey(env: Env): string {
  return `${env.MOTION_API_KEY}\u0000${env.MOTION_MCP_TOOLS ?? ""}`;
}

function getRuntime(env: Env): WorkerRuntime {
  const key = runtimeKey(env);
  if (runtime && runtime.key === key) {
    return runtime;
  }

  const motionService = new MotionApiService(env.MOTION_API_KEY);
  const workspaceResolver = new WorkspaceResolver(motionService);
  const validator = new InputValidator();
  const handlerFactory = new HandlerFactory({ motionService, workspaceResolver, validator });

  const registry = new ToolRegistry();
  const configurator = new ToolConfigurator(env.MOTION_MCP_TOOLS || "complete", registry);
  // No AJV validator init here: ajv.compile() uses runtime code generation,
  // which Cloudflare Workers disallows (EvalError). Input validation in the
  // Worker is handled by the Zod schemas passed to registerTool() below;
  // validateInput() is only called from the stdio entry point.
  const tools: PreparedTool[] = configurator.getEnabledTools().map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: jsonSchemaToZodObject(
      tool.inputSchema as Parameters<typeof jsonSchemaToZodObject>[0]
    ),
  }));

  const built: WorkerRuntime = {
    key,
    tools,
    handlerFactory,
    handler: createMcpHandler(() => createServer(built), {
      route: MCP_ROUTE,
      // Origin validation exists to stop DNS-rebinding and cross-site calls
      // against servers that trust the network. This Worker trusts nothing on
      // the network: every non-preflight request must carry the secret (see
      // the auth gate in fetch below), so a browser page on any origin can
      // only reach the handler if it already holds the credential. Leaving
      // the SDK default would reject browser-origin MCP clients on custom
      // domains, the case issue #138 fixed for the previous transport.
      allowedOriginHostnames: "*",
      onerror: (error) => {
        mcpLog(LOG_LEVELS.ERROR, "MCP handler error", { error: error.message });
      },
    }),
  };
  runtime = built;
  return built;
}

/**
 * Builds the McpServer the handler serves one request with. A fresh instance
 * per request is the SDK v2 stateless contract; the tool table and handler
 * factory it registers against are the shared per-isolate ones.
 */
function createServer(rt: WorkerRuntime): McpServer {
  const server = new McpServer(SERVER_INFO, { instructions: SERVER_INSTRUCTIONS });

  for (const tool of rt.tools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      async (params) => {
        const handler = rt.handlerFactory.createHandler(tool.name);
        // The handlers are typed against the SDK v1 CallToolResult (shared
        // with the stdio entry point). That type is structurally assignable
        // to the v2 result the callback must return, so no cast is needed;
        // the compiler checks the shape on both entry points.
        return await handler.handle(params);
      }
    );
  }

  return server;
}

/**
 * The seam between the Worker's own routing and the MCP handler. Requests
 * reach it only after the auth gate, with the path already rewritten to
 * MCP_ROUTE. It is an object so the Worker tests can stub the transport and
 * observe exactly what an authorized request looks like when it gets here.
 */
export const mcpTransport = {
  handle(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return getRuntime(env).handler(request, env, ctx);
  },
};

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

    // CORS preflight, answered BEFORE the auth gate below.
    //
    // A browser strips Authorization from a CORS preflight and announces the
    // header it intends to send via Access-Control-Request-Headers instead, so
    // an OPTIONS request under /mcp carries no credential the gate could accept.
    // Left to the gate it 404s with no CORS headers, and the browser then blocks
    // the real (credentialed) request that would follow. That made Bearer mode
    // unusable from any browser-origin MCP client (issue #138).
    //
    // These headers mirror the agents SDK's own DEFAULT_CORS_OPTIONS exactly
    // (agents/dist/handler-stateless-*.js): a null body, the default 200
    // status, and the SDK's default header values. Allow-Headers therefore
    // includes authorization and mcp-session-id, which is what a Bearer-mode
    // client's preflight asks about. Kept in sync with the SDK so the answer a
    // preflight gets here matches what it would get from the handler on any
    // other method.
    //
    // Scoped to pathParts[0] === "mcp": only the MCP routes get an open
    // preflight responder, not the whole Worker. The trade-off is that this
    // reveals /mcp answers OPTIONS without a credential. That grants no access:
    // a preflight carries none and returns no data, and every non-OPTIONS
    // request still falls through to the auth gate unchanged. The point of the
    // gate (a real request needs the secret) is preserved.
    if (request.method === "OPTIONS" && pathParts[0] === "mcp") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Headers":
            "Content-Type, Accept, Authorization, mcp-session-id, MCP-Protocol-Version, Mcp-Method, Mcp-Name",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Expose-Headers": "mcp-session-id",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Two authentication modes, both compared in constant time:
    //   1. Authorization: Bearer <secret> header (preferred; keeps the secret
    //      out of the URL for header-capable clients). The path is already
    //      clean in this mode (e.g. /mcp), so no rewrite is needed.
    //   2. URL path secret: /mcp/<secret> (backward compatible). Clients
    //      configure URL as https://your-worker.workers.dev/mcp/YOUR_SECRET.
    // If a Bearer header is present it is used; otherwise the path segment is.
    const authHeader = request.headers.get("Authorization");
    // The "Bearer" auth scheme name is case-insensitive per RFC 7235 — match it
    // that way so clients sending e.g. "bearer <secret>" aren't forced to fall
    // back to the legacy path-secret mode.
    const bearerMatch = authHeader ? /^Bearer[ \t]+(.+)$/i.exec(authHeader) : null;
    const bearerSecret = bearerMatch ? (bearerMatch[1] ?? "").trim() : null;
    const usedBearer = bearerSecret !== null;

    const providedSecret = usedBearer ? bearerSecret : (pathParts[1] ?? "");

    if (pathParts[0] !== "mcp" || !(await secretsMatch(providedSecret, env.MOTION_MCP_SECRET))) {
      return new Response("Not found", { status: 404 });
    }

    // Determine the path handed to the MCP handler. With Bearer auth the path
    // carries no secret segment to strip; with path-secret auth, strip the
    // secret. e.g. /mcp/SECRET -> /mcp.
    const cleanPath = usedBearer
      ? "/" + pathParts.join("/")
      : "/mcp" + (pathParts.length > 2 ? "/" + pathParts.slice(2).join("/") : "");

    // The stateless handler serves exactly one route, MCP_ROUTE. It would 404
    // any other path itself, but rejecting here first keeps the gate's own
    // "Not found" convention (no detail, no hint that /mcp exists) and means
    // nothing but a well-formed request ever reaches the handler. Any
    // sub-path is a client still pointed at the retired HTTP+SSE transport
    // (e.g. /mcp/sse or /mcp/message); that transport is no longer served.
    if (cleanPath !== MCP_ROUTE) {
      return new Response("Not found", { status: 404 });
    }

    // Hand the handler a URL carrying only the route. The handler reads the
    // pathname and nothing from the query string, so the caller's params are
    // not forwarded: forwarding would require auditing each one in advance,
    // and dropping them means an unaudited value can never reach the handler
    // or its logs. In path-secret mode this is also what keeps the secret off
    // the URL the handler sees (an exception inside it surfaces the request
    // URL in Workers trace events).
    const cleanRequest = new Request(new URL(MCP_ROUTE, url.origin), request);

    return mcpTransport.handle(cleanRequest, env, ctx);
  },
};
