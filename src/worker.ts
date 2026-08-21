import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MotionApiService } from "./services/motionApi";
import { WorkspaceResolver } from "./utils/workspaceResolver";
import { InputValidator } from "./utils/validator";
import { HandlerFactory } from "./handlers/HandlerFactory";
import { ToolRegistry, ToolConfigurator } from "./tools";
import { jsonSchemaToZodShape } from "./utils/jsonSchemaToZod";
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
      const zodShape = jsonSchemaToZodShape(tool.inputSchema as Parameters<typeof jsonSchemaToZodShape>[0]);

      this.server.tool(
        tool.name,
        tool.description,
        zodShape,
        async (params) => {
          const handler = handlerFactory.createHandler(tool.name);
          return await handler.handle(params);
        }
      );
    }
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", server: "motion-mcp-server" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate secret path: /mcp/{secret}/...
    // Clients configure URL as: https://your-worker.workers.dev/mcp/YOUR_SECRET
    const pathParts = url.pathname.split("/").filter(Boolean);

    // SSE message endpoint: the SSE stream's `endpoint` event advertises the
    // rewritten path (/mcp/message?sessionId=...), which has no secret segment.
    // The sessionId is unguessable and only issued on a stream opened with the
    // secret, so it authenticates these POSTs.
    if (
      pathParts[0] === "mcp" &&
      pathParts[1] === "message" &&
      request.method === "POST" &&
      url.searchParams.has("sessionId")
    ) {
      return (
        MotionMCPAgent.mount("/mcp") as { fetch: (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response> }
      ).fetch(request, env, ctx);
    }

    if (pathParts[0] !== "mcp" || pathParts[1] !== env.MOTION_MCP_SECRET) {
      return new Response("Not found", { status: 404 });
    }

    // Rewrite path to strip the secret before passing to McpAgent
    // e.g., /mcp/SECRET -> /mcp, /mcp/SECRET/sse -> /mcp/sse
    const cleanPath = "/mcp" + (pathParts.length > 2 ? "/" + pathParts.slice(2).join("/") : "");
    const cleanUrl = new URL(cleanPath, url.origin);
    const cleanRequest = new Request(cleanUrl, request);

    // Streamable HTTP (POST/DELETE /mcp, or GET with an mcp-session-id header)
    // is served by serve(); a bare GET on /mcp is a legacy SSE stream via mount().
    const isStreamableHttp =
      cleanPath === "/mcp" &&
      (request.method !== "GET" || request.headers.has("mcp-session-id"));

    return (
      (isStreamableHttp
        ? MotionMCPAgent.serve("/mcp")
        : MotionMCPAgent.mount("/mcp")) as { fetch: (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response> }
    ).fetch(cleanRequest, env, ctx);
  },
};
