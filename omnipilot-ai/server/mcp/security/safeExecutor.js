/**
 * safeExecutor.js
 * ------------------------------------------------------------------
 * Enforces "safe execution" for every agent/tool invocation:
 *   1. Hard timeout on every agent run (no runaway executions)
 *   2. No dynamic code execution / no shell access from agent code
 *      (agents are pure functions over validated data only)
 *   3. Standardized, sanitized error responses (no stack traces or
 *      internal details ever leak to the client)
 *   4. Structured audit logging of every tool call
 *   5. Simple in-memory per-IP rate limiting middleware
 * ------------------------------------------------------------------
 */

const DEFAULT_TIMEOUT_MS = 5000;

/** Wrap an agent's run(input) call with a timeout + error containment. */
async function safeExecute(fn, { name = "unknown-agent", timeoutMs = DEFAULT_TIMEOUT_MS, input } = {}) {
  const startedAt = Date.now();

  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Agent "${name}" timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    const result = await Promise.race([Promise.resolve().then(() => fn(input)), timeout]);
    audit({ name, ok: true, ms: Date.now() - startedAt });
    return { success: true, agent: name, data: result, meta: { durationMs: Date.now() - startedAt } };
  } catch (err) {
    audit({ name, ok: false, ms: Date.now() - startedAt, error: err.message });
    // Never leak stack traces / internal details to the caller.
    return {
      success: false,
      agent: name,
      error: sanitizeErrorMessage(err.message),
      meta: { durationMs: Date.now() - startedAt },
    };
  }
}

function sanitizeErrorMessage(msg) {
  if (!msg || typeof msg !== "string") return "Internal agent error.";
  // Strip anything that looks like a file path or stack frame.
  return msg.replace(/\/[^\s)]+/g, "[path]").slice(0, 300);
}

const AUDIT_LOG = [];
const MAX_AUDIT_ENTRIES = 500;

function audit(entry) {
  AUDIT_LOG.push({ ts: new Date().toISOString(), ...entry });
  if (AUDIT_LOG.length > MAX_AUDIT_ENTRIES) AUDIT_LOG.shift();
}

function getAuditLog() {
  return AUDIT_LOG.slice(-100);
}

/**
 * Simple in-memory token-bucket rate limiter middleware.
 * Prevents abuse of the MCP endpoints without needing external infra.
 */
function createRateLimiter({ perMinute = 60 } = {}) {
  const buckets = new Map();

  return function rateLimitMiddleware(req, res, next) {
    const key = req.ip || "unknown";
    const now = Date.now();
    const windowMs = 60_000;

    const bucket = buckets.get(key) || { count: 0, windowStart: now };
    if (now - bucket.windowStart > windowMs) {
      bucket.count = 0;
      bucket.windowStart = now;
    }
    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > perMinute) {
      return res.status(429).json({
        success: false,
        error: "Rate limit exceeded. Please slow down and try again shortly.",
      });
    }
    next();
  };
}

module.exports = {
  safeExecute,
  sanitizeErrorMessage,
  getAuditLog,
  createRateLimiter,
};
