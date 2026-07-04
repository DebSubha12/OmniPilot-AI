/**
 * Planner Agent (Orchestrator)
 * ------------------------------------------------------------------
 * This is the ADK-style "root agent" in OmniPilot AI's multi-agent
 * system. It receives a free-form goal + structured context, decomposes
 * it into an execution plan, and delegates sub-tasks to the specialist
 * agents (Task Optimization, Exam/Study, Life Scheduler) via the MCP
 * server's tool-calling interface. Results are aggregated into one
 * coherent response.
 *
 * Input:
 * {
 *   goal: string,
 *   tasks?: [...],           // optional, forwarded to task_optimization_agent
 *   exam?: {...},            // optional, forwarded to exam_study_agent
 *   schedule?: {...}         // optional, forwarded to life_scheduler_agent
 * }
 */

const { validateSchema, sanitizeString } = require("../security/validator");

const inputSchema = {
  goal: { type: "string", required: true, maxLen: 500 },
};

function classifyIntent(goal) {
  const g = goal.toLowerCase();
  const intents = [];
  if (/(exam|study|test|revise|revision|topic)/.test(g)) intents.push("exam_study_agent");
  if (/(task|todo|to-do|priorit|deadline)/.test(g)) intents.push("task_optimization_agent");
  if (/(schedule|calendar|day plan|timetable|routine)/.test(g)) intents.push("life_scheduler_agent");
  if (intents.length === 0) intents.push("task_optimization_agent"); // sensible default
  return intents;
}

/**
 * The planner is invoked by mcpServer.js with a `delegate` function so it
 * never needs to know HTTP/transport details — it just calls other
 * registered agents by name. This keeps agents fully decoupled (a core
 * ADK multi-agent principle: agents communicate through the orchestrator,
 * not directly with each other).
 */
function makeRun(delegate) {
  return async function run(input) {
    const { valid, errors, data } = validateSchema(input, inputSchema);
    if (!valid) throw new Error(`Validation failed: ${errors.join("; ")}`);

    const goal = sanitizeString(data.goal, 500);
    const relevantAgents = classifyIntent(goal);

    const steps = [];
    const delegatedResults = {};

    for (const agentName of relevantAgents) {
      let agentInput = {};
      if (agentName === "task_optimization_agent") {
        agentInput = { tasks: input.tasks || inferTasksFromGoal(goal) };
      } else if (agentName === "exam_study_agent") {
        agentInput = input.exam || inferExamFromGoal(goal);
      } else if (agentName === "life_scheduler_agent") {
        agentInput = input.schedule || { items: [{ title: goal, hours: 1 }] };
      }

      steps.push(`Delegating to ${agentName}...`);
      const result = await delegate(agentName, agentInput);
      delegatedResults[agentName] = result;
    }

    return {
      goal,
      plan: steps,
      agentsInvoked: relevantAgents,
      results: delegatedResults,
      summary: buildSummary(goal, relevantAgents, delegatedResults),
    };
  };
}

function inferTasksFromGoal(goal) {
  // Very light heuristic split so the demo works even with zero structured input.
  const parts = goal
    .split(/,| and /i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return [{ title: goal, urgency: 3, importance: 3, effortHours: 1 }];
  return parts.slice(0, 10).map((title) => ({ title, urgency: 3, importance: 3, effortHours: 1 }));
}

function inferExamFromGoal(goal) {
  const inTwoWeeks = new Date();
  inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);
  return {
    subject: goal,
    topics: ["Topic 1", "Topic 2", "Topic 3"],
    examDate: inTwoWeeks.toISOString().slice(0, 10),
    hoursPerDay: 2,
  };
}

function buildSummary(goal, agents, results) {
  const bits = [`Goal: "${goal}".`];
  if (results.task_optimization_agent?.success) {
    const rec = results.task_optimization_agent.data.recommendation;
    if (rec) bits.push(rec);
  }
  if (results.exam_study_agent?.success) {
    const d = results.exam_study_agent.data;
    if (d.studyDays) bits.push(`Study plan spans ${d.studyDays} study day(s) + ${d.reviewDays} review day(s).`);
  }
  if (results.life_scheduler_agent?.success) {
    const d = results.life_scheduler_agent.data;
    if (d.note) bits.push(d.note);
  }
  return bits.join(" ");
}

module.exports = {
  name: "planner_agent",
  description:
    "Orchestrator agent: decomposes a free-form goal and delegates to the Task Optimization, Exam/Study, and Life Scheduler agents as needed.",
  inputSchema,
  makeRun, // factory — mcpServer injects the delegate function
};
