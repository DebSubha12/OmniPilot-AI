/**
 * mcpServer.js
 * ------------------------------------------------------------------
 * A lightweight MCP-style server (Model Context Protocol pattern):
 * agents register themselves as "tools" with a name, description, and
 * input schema. Callers (the Express API, the CLI, or the Planner
 * agent itself) never call agent code directly — they go through
 * `callTool()`, which enforces validation + safe execution for every
 * single call. This mirrors how a real MCP server exposes tools to a
 * host application over a standard protocol.
 * ------------------------------------------------------------------
 */

const { safeExecute } = require("./security/safeExecutor");

const taskOptimizationAgent = require("./agents/taskOptimizationAgent");
const examStudyAgent = require("./agents/examStudyAgent");
const lifeSchedulerAgent = require("./agents/lifeSchedulerAgent");
const plannerAgentModule = require("./agents/plannerAgent");

class McpServer {
  constructor() {
    this.tools = new Map();

    // Register specialist agents/tools first.
    this.registerTool(taskOptimizationAgent);
    this.registerTool(examStudyAgent);
    this.registerTool(lifeSchedulerAgent);

    // Planner agent is special: it delegates to the other tools, so we
    // inject a bound `delegate` function that itself goes through
    // callTool() — meaning even inter-agent calls are validated and
    // safely executed. No agent ever bypasses the security layer.
    const plannerRun = plannerAgentModule.makeRun(async (toolName, toolInput) => {
      return this.callTool(toolName, toolInput);
    });
    this.registerTool({
      name: plannerAgentModule.name,
      description: plannerAgentModule.description,
      inputSchema: plannerAgentModule.inputSchema,
      run: plannerRun,
    });
  }

  registerTool(agent) {
    if (!agent || !agent.name || typeof agent.run !== "function") {
      throw new Error("Invalid agent/tool registration — must have {name, run()}.");
    }
    this.tools.set(agent.name, agent);
  }

  /** MCP-style "list tools" — what a host app / CLI would call to discover capabilities. */
  listTools() {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: summarizeSchema(t.inputSchema),
    }));
  }

  /** MCP-style "call tool" — the single, security-enforced entry point for all agents. */
  async callTool(name, input) {
    const agent = this.tools.get(name);
    if (!agent) {
      return { success: false, error: `Unknown tool/agent: "${name}"` };
    }
    return safeExecute(agent.run, { name, input, timeoutMs: 8000 });
  }
}

function summarizeSchema(schema) {
  if (!schema) return {};
  const out = {};
  for (const [k, rule] of Object.entries(schema)) {
    out[k] = { type: rule.type, required: !!rule.required };
  }
  return out;
}

// Singleton instance shared by the Express server and the CLI.
const mcpServer = new McpServer();

module.exports = mcpServer;
