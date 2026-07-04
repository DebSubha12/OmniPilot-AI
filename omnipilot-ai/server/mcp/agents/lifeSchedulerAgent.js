/**
 * Life Scheduler Agent
 * ------------------------------------------------------------------
 * Input:  {
 *   wakeTime: "07:00", sleepTime: "23:00",
 *   fixedEvents: [{ title, start:"HH:MM", end:"HH:MM" }],
 *   items: [{ title, hours }]   // tasks/study blocks to slot in
 * }
 * Output: a single day's timetable that fits `items` into the free
 *         gaps between wake/sleep and any fixed events, without
 *         overlapping anything fixed.
 */

const { validateSchema } = require("../security/validator");

const inputSchema = {
  wakeTime: { type: "string", required: false, default: "07:00", maxLen: 5 },
  sleepTime: { type: "string", required: false, default: "23:00", maxLen: 5 },
  fixedEvents: {
    type: "array",
    required: false,
    default: [],
    maxLen: 30,
    items: "object",
    itemSchema: {
      title: { type: "string", required: true, maxLen: 120 },
      start: { type: "string", required: true, maxLen: 5 },
      end: { type: "string", required: true, maxLen: 5 },
    },
  },
  items: {
    type: "array",
    required: false,
    default: [],
    maxLen: 60,
    items: "object",
    itemSchema: {
      title: { type: "string", required: true, maxLen: 200 },
      hours: { type: "number", required: false, default: 1, min: 0.25, max: 12 },
    },
  },
};

function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function toHHMM(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function run(input) {
  const { valid, errors, data } = validateSchema(input, inputSchema);
  if (!valid) throw new Error(`Validation failed: ${errors.join("; ")}`);

  const wake = toMinutes(data.wakeTime);
  const sleep = toMinutes(data.sleepTime);
  if (wake === null || sleep === null || sleep <= wake) {
    throw new Error("Invalid wakeTime/sleepTime — sleepTime must be later than wakeTime, format HH:MM.");
  }

  // Build a sorted, validated list of fixed events (busy blocks).
  const fixed = data.fixedEvents
    .map((e) => ({ title: e.title, start: toMinutes(e.start), end: toMinutes(e.end) }))
    .filter((e) => e.start !== null && e.end !== null && e.end > e.start)
    .sort((a, b) => a.start - b.start);

  // Compute free gaps between wake and sleep, minus fixed events.
  const gaps = [];
  let cursor = wake;
  for (const e of fixed) {
    if (e.start > cursor) gaps.push({ start: cursor, end: Math.min(e.start, sleep) });
    cursor = Math.max(cursor, e.end);
    if (cursor >= sleep) break;
  }
  if (cursor < sleep) gaps.push({ start: cursor, end: sleep });

  // Greedily place items (tasks/study blocks) into gaps in order given.
  const timetable = [];
  const unscheduled = [];
  const gapQueue = gaps.map((g) => ({ ...g }));

  for (const item of data.items) {
    const needed = Math.round(item.hours * 60);
    let placed = false;
    for (const gap of gapQueue) {
      const available = gap.end - gap.start;
      if (available >= needed) {
        timetable.push({ title: item.title, start: toHHMM(gap.start), end: toHHMM(gap.start + needed) });
        gap.start += needed;
        placed = true;
        break;
      }
    }
    if (!placed) unscheduled.push(item.title);
  }

  // Merge fixed events into the final timetable and sort chronologically.
  for (const e of fixed) {
    timetable.push({ title: `📌 ${e.title}`, start: toHHMM(e.start), end: toHHMM(e.end) });
  }
  timetable.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

  return {
    wakeTime: data.wakeTime,
    sleepTime: data.sleepTime,
    timetable,
    unscheduled,
    note:
      unscheduled.length > 0
        ? `${unscheduled.length} item(s) could not fit in today's free time and should roll over to tomorrow.`
        : "All items successfully scheduled.",
  };
}

module.exports = {
  name: "life_scheduler_agent",
  description:
    "Merges tasks, study blocks, and fixed calendar events into a single conflict-free daily timetable.",
  inputSchema,
  run,
};
