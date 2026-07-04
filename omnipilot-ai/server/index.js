/**
 * OmniPilot AI — Server Entrypoint
 * ------------------------------------------------------------------
 * Express app that:
 *   - Serves the static dashboard (public/)
 *   - Exposes MCP-style endpoints backed by mcpServer.js
 *   - Applies security middleware: CORS allowlist, JSON body limits,
 *     security headers, rate limiting, and a global error handler
 * ------------------------------------------------------------------
 */

require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const mcpServer = require("./mcp/mcpServer");
const { createRateLimiter, getAuditLog } = require("./mcp/security/safeExecutor");

const app = express();
const PORT = process.env.PORT || 5000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || `http://localhost:${PORT}`)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE || 60);

/* ---------------------------- Security middleware ---------------------------- */

// Minimal security headers (no external dependency required).
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:;"
  );
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin/non-browser requests (no origin header) and allowlisted origins.
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS policy"));
    },
  })
);

// Limit JSON body size to prevent oversized-payload abuse.
app.use(express.json({ limit: "100kb" }));

app.use(createRateLimiter({ perMinute: RATE_LIMIT_PER_MINUTE }));

/* --------------------------------- Static UI ---------------------------------- */

app.use(express.static(path.join(__dirname, "..", "public")));

/* ---------------------------------- API routes --------------------------------- */

app.get("/api/health", (req, res) => {
  res.json({ success: true, status: "ok", uptimeSeconds: process.uptime() });
});

app.get("/api/mcp/tools", (req, res) => {
  res.json({ success: true, tools: mcpServer.listTools() });
});

app.post("/api/mcp/call", async (req, res, next) => {
  try {
    const { tool, input } = req.body || {};
    if (typeof tool !== "string" || !tool.trim()) {
      return res.status(400).json({ success: false, error: "Field 'tool' (string) is required." });
    }
    const result = await mcpServer.callTool(tool.trim(), input || {});
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (err) {
    next(err);
  }
});

// Convenience endpoint the dashboard's orchestrator panel calls directly.
app.post("/api/orchestrate", async (req, res, next) => {
  try {
    const { goal, tasks, exam, schedule } = req.body || {};
    if (typeof goal !== "string" || !goal.trim()) {
      return res.status(400).json({ success: false, error: "Field 'goal' (string) is required." });
    }
    const result = await mcpServer.callTool("planner_agent", { goal, tasks, exam, schedule });
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (err) {
    next(err);
  }
});

app.get("/api/audit-log", (req, res) => {
  res.json({ success: true, log: getAuditLog() });
});

/* ------------------------------ 404 + error handling ---------------------------- */

app.use("/api", (req, res) => {
  res.status(404).json({ success: false, error: "API route not found." });
});

// Global error handler — never leaks internal stack traces to the client.
app.use((err, req, res, next) => {
  console.error("[OmniPilot AI] Unhandled error:", err.message);
  res.status(500).json({ success: false, error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`\n🚀 OmniPilot AI server running at http://localhost:${PORT}`);
  console.log(`   MCP tools available: ${mcpServer.listTools().map((t) => t.name).join(", ")}\n`);
});

module.exports = app;
