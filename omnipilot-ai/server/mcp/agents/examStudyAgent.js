/**
 * Exam / Study Agent
 * ------------------------------------------------------------------
 * Input:  { subject, topics: [string], examDate, hoursPerDay }
 * Output: a day-by-day study plan that distributes topics evenly across
 *         the available days, reserving the final ~20% of days for
 *         review/practice (simple spaced-repetition heuristic).
 */

const { validateSchema } = require("../security/validator");

const inputSchema = {
  subject: { type: "string", required: true, maxLen: 120 },
  topics: { type: "array", required: true, items: "string", maxLen: 60 },
  examDate: { type: "date", required: true },
  hoursPerDay: { type: "number", required: false, default: 2, min: 0.5, max: 12 },
};

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function run(input) {
  const { valid, errors, data } = validateSchema(input, inputSchema);
  if (!valid) throw new Error(`Validation failed: ${errors.join("; ")}`);

  const totalDays = daysUntil(data.examDate);
  if (totalDays <= 0) {
    return {
      subject: data.subject,
      warning: "Exam date is today or in the past — no future study days available.",
      plan: [],
    };
  }
  if (data.topics.length === 0) {
    return { subject: data.subject, warning: "No topics provided.", plan: [] };
  }

  const reviewDays = Math.max(1, Math.round(totalDays * 0.2));
  const studyDays = Math.max(1, totalDays - reviewDays);

  // Distribute topics across study days round-robin so nothing is skipped.
  const plan = [];
  const topicsPerDay = Math.max(1, Math.ceil(data.topics.length / studyDays));
  let topicCursor = 0;

  for (let day = 1; day <= studyDays; day++) {
    const dayTopics = data.topics.slice(topicCursor, topicCursor + topicsPerDay);
    topicCursor += topicsPerDay;
    if (dayTopics.length === 0 && topicCursor >= data.topics.length) {
      // wrap around lightly for extra reinforcement if days > topics
      dayTopics.push(data.topics[day % data.topics.length]);
    }
    plan.push({
      day,
      date: offsetDateLabel(day),
      focus: dayTopics.length > 0 ? dayTopics : ["Light review"],
      hours: data.hoursPerDay,
    });
  }

  for (let r = 1; r <= reviewDays; r++) {
    plan.push({
      day: studyDays + r,
      date: offsetDateLabel(studyDays + r),
      focus: ["Full review", "Practice questions / past papers", "Weak-topic drilling"],
      hours: data.hoursPerDay,
    });
  }

  return {
    subject: data.subject,
    examDate: data.examDate,
    totalDaysUntilExam: totalDays,
    studyDays,
    reviewDays,
    plan,
  };
}

function offsetDateLabel(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  name: "exam_study_agent",
  description:
    "Generates a day-by-day study plan for an upcoming exam, distributing topics across available days and reserving time for review.",
  inputSchema,
  run,
};
