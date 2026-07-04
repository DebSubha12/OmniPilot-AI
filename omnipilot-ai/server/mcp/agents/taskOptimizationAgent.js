/**
 * Task Optimization Agent
 * ------------------------------------------------------------------
 * Input:  { tasks: [{ title, urgency(1-5), importance(1-5), effortHours }] }
 * Output: prioritized task list using an Eisenhower-matrix style score,
 *         grouped into quadrants, plus a suggested execution order.
 */

const { validateSchema } = require("../security/validator");

const inputSchema = {
  tasks: {
    type: "array",
    required: true,
    maxLen: 100,
    items: "object",
    itemSchema: {
      title: { type: "string", required: true, maxLen: 200 },
      urgency: { type: "number", required: false, default: 3, min: 1, max: 5 },
      importance: { type: "number", required: false, default: 3, min: 1, max: 5 },
      effortHours: { type: "number", required: false, default: 1, min: 0.25, max: 24 },
    },
  },
};

function quadrantOf(t) {
  const urgent = t.urgency >= 3.5;
  const important = t.importance >= 3.5;
  if (urgent && important) return "Do First";
  if (!urgent && important) return "Schedule";
  if (urgent && !important) return "Delegate";
  return "Eliminate / Later";
}

function score(t) {
  // Weighted score: importance matters slightly more than urgency,
  // smaller effort tasks get a slight boost (quick wins).
  return t.importance * 1.2 + t.urgency * 1.0 - t.effortHours * 0.15;
}

function run(input) {
  const { valid, errors, data } = validateSchema(input, inputSchema);
  if (!valid) {
    const err = new Error(`Validation failed: ${errors.join("; ")}`);
    throw err;
  }

  const tasks = data.tasks.length > 0 ? data.tasks : [];
  if (tasks.length === 0) {
    return { prioritized: [], quadrants: {}, note: "No tasks provided." };
  }

  const enriched = tasks.map((t, i) => ({
    id: i + 1,
    title: t.title,
    urgency: t.urgency,
    importance: t.importance,
    effortHours: t.effortHours,
    quadrant: quadrantOf(t),
    score: Number(score(t).toFixed(2)),
  }));

  enriched.sort((a, b) => b.score - a.score);

  const quadrants = enriched.reduce((acc, t) => {
    acc[t.quadrant] = acc[t.quadrant] || [];
    acc[t.quadrant].push(t.title);
    return acc;
  }, {});

  const totalEffort = enriched.reduce((sum, t) => sum + t.effortHours, 0);

  return {
    prioritized: enriched,
    quadrants,
    totalEffortHours: Number(totalEffort.toFixed(2)),
    recommendation:
      enriched.length > 0
        ? `Start with "${enriched[0].title}" — highest combined urgency/importance score.`
        : "No recommendation available.",
  };
}

module.exports = {
  name: "task_optimization_agent",
  description:
    "Prioritizes a list of tasks using an Eisenhower-matrix style urgency/importance scoring model and suggests an execution order.",
  inputSchema,
  run,
};
