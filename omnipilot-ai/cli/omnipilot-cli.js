#!/usr/bin/env node
/**
 * OmniPilot AI CLI
 * ------------------------------------------------------------------
 * Agent Skills / CLI tool — lets you invoke any registered MCP agent
 * directly from the terminal, without starting the web server.
 *
 * Usage:
 *   node cli/omnipilot-cli.js list
 *   node cli/omnipilot-cli.js plan "Prepare for my chemistry exam and finish the report"
 *   node cli/omnipilot-cli.js call task_optimization_agent '{"tasks":[{"title":"Write report","urgency":4,"importance":5,"effortHours":3}]}'
 * ------------------------------------------------------------------
 */

const { listSkills, runSkill, planGoal } = require("../server/mcp/skills/cliTools");

function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

async function main() {
  const [, , command, ...rest] = process.argv;

  try {
    switch (command) {
      case "list": {
        const tools = await listSkills();
        console.log("Available OmniPilot AI agent skills:\n");
        printJson(tools);
        break;
      }

      case "plan": {
        const goal = rest.join(" ");
        if (!goal.trim()) {
          console.error('Usage: omnipilot plan "<your goal>"');
          process.exit(1);
        }
        const result = await planGoal(goal);
        printJson(result);
        break;
      }

      case "call": {
        const [toolName, jsonInput] = rest;
        if (!toolName) {
          console.error("Usage: omnipilot call <tool_name> '<json_input>'");
          process.exit(1);
        }
        let input = {};
        if (jsonInput) {
          try {
            input = JSON.parse(jsonInput);
          } catch {
            console.error("Error: <json_input> must be valid JSON.");
            process.exit(1);
          }
        }
        const result = await runSkill(toolName, input);
        printJson(result);
        break;
      }

      default: {
        console.log(`OmniPilot AI CLI

Commands:
  list                          List all available agent skills/tools
  plan "<goal>"                 Run the Planner Agent end-to-end on a goal
  call <tool> '<json input>'    Call a specific agent/tool directly

Examples:
  node cli/omnipilot-cli.js list
  node cli/omnipilot-cli.js plan "Study for my exam and organize my week"
  node cli/omnipilot-cli.js call exam_study_agent '{"subject":"Biology","topics":["Cells","Genetics"],"examDate":"2026-07-20","hoursPerDay":2}'
`);
      }
    }
  } catch (err) {
    console.error("CLI error:", err.message);
    process.exit(1);
  }
}

main();
