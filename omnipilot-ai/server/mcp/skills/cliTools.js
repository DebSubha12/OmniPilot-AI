/**
 * skills/cliTools.js
 * ------------------------------------------------------------------
 * "Agent Skills" — thin, reusable command wrappers around the MCP
 * server's tool-calling interface. These are what the CLI (and any
 * future automation, e.g. a cron job or CI pipeline) uses to invoke
 * agents without going through the HTTP layer at all.
 * ------------------------------------------------------------------
 */

const mcpServer = require("../mcpServer");

async function listSkills() {
  return mcpServer.listTools();
}

async function runSkill(name, input) {
  return mcpServer.callTool(name, input);
}

/** High-level convenience skill: full end-to-end plan for a goal. */
async function planGoal(goal, extra = {}) {
  return mcpServer.callTool("planner_agent", { goal, ...extra });
}

module.exports = { listSkills, runSkill, planGoal };
