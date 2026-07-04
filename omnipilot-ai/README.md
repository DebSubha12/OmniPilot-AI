# 🛰️ OmniPilot AI

**A modular, secure, multi-agent AI system** — Planner, Task Optimization, Exam/Study, and Life Scheduler agents, served through an MCP-style server, with a mission-control style dashboard. Runs fully locally at `localhost:3000`, no external API keys required.

```
                         ┌───────────────────────┐
                         │      Planner Agent     │
                         │      (Orchestrator)    │
                         └───────────┬───────────┘
              ┌────────────────────┬─┴─┬────────────────────┐
              ▼                    ▼   ▼                    ▼
   ┌─────────────────────┐ ┌──────────────────┐ ┌──────────────────────┐
   │ Task Optimization    │ │ Exam / Study      │ │ Life Scheduler        │
   │ Agent                │ │ Agent             │ │ Agent                 │
   └─────────────────────┘ └──────────────────┘ └──────────────────────┘
              ▲                    ▲                       ▲
              └────────────────────┴───────────┬───────────┘
                                                │
                                     ┌──────────┴───────────┐
                                     │      MCP Server       │
                                     │ (tool registry +      │
                                     │  validation + safe    │
                                     │  execution)            │
                                     └──────────┬───────────┘
                                                │
                          ┌─────────────────────┼─────────────────────┐
                          ▼                                           ▼
                 Express REST API                              CLI (Agent Skills)
                 (dashboard @ localhost:3000)             `node cli/omnipilot-cli.js`
```

---

## 1. Core concepts implemented

| # | Concept | Where it lives |
|---|---|---|
| 1 | **ADK-style Multi-Agent System** | `server/mcp/agents/*.js` — four independent agents (Planner, Task Optimization, Exam/Study, Life Scheduler). The Planner is the orchestrator/root agent; specialists never call each other directly, only through the MCP server. |
| 2 | **MCP Server architecture** | `server/mcp/mcpServer.js` — a registry that exposes `listTools()` and `callTool(name, input)`, mirroring the Model Context Protocol pattern of tool discovery + tool invocation. |
| 3 | **Security: validation & safe execution** | `server/mcp/security/validator.js` (schema validation + sanitization) and `server/mcp/security/safeExecutor.js` (timeouts, sandboxed error handling, audit logging, rate limiting). Every single tool call — from the UI, the API, or the CLI — passes through both. |
| 4 | **Agent Skills / CLI tools** | `server/mcp/skills/cliTools.js` + `cli/omnipilot-cli.js` — reusable "skill" functions that let you run any agent from the terminal, independent of the web server. |

---

## 2. Project structure

```
omnipilot-ai/
├── server/
│   ├── index.js                  # Express app: security middleware + routes
│   └── mcp/
│       ├── mcpServer.js          # MCP-style tool registry & dispatcher
│       ├── agents/
│       │   ├── plannerAgent.js           # orchestrator agent
│       │   ├── taskOptimizationAgent.js  # Eisenhower-matrix prioritizer
│       │   ├── examStudyAgent.js         # spaced study-plan generator
│       │   └── lifeSchedulerAgent.js     # daily timetable builder
│       ├── security/
│       │   ├── validator.js      # input schema validation & sanitization
│       │   └── safeExecutor.js   # timeouts, safe error handling, rate limiting, audit log
│       └── skills/
│           └── cliTools.js       # Agent Skills used by the CLI
├── cli/
│   └── omnipilot-cli.js          # `omnipilot list | plan | call`
├── public/                       # OmniPilot AI dashboard (static, no build step)
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── package.json
├── .env.example
└── README.md
```

---

## 3. Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment config (optional — sensible defaults are used if skipped)
cp .env.example .env

# 3. Start the server
npm start

# 4. Open the dashboard
# http://localhost:3000
```

No API key is required. Every agent runs on deterministic, fully-offline logic, so the whole system works immediately after `npm install`.

### Using the CLI (Agent Skills)

```bash
# List every registered agent/tool
node cli/omnipilot-cli.js list

# Run the Planner Agent end-to-end on a free-form goal
node cli/omnipilot-cli.js plan "Study for my chemistry exam and organize my week"

# Call one specialist agent directly with structured JSON input
node cli/omnipilot-cli.js call exam_study_agent '{"subject":"Biology","topics":["Cells","Genetics"],"examDate":"2026-07-20","hoursPerDay":2}'
```

---

## 4. API reference

All endpoints are served by the same Express app on `localhost:3000`.

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check. |
| `GET` | `/api/mcp/tools` | Lists every registered agent/tool with its input schema (MCP "list tools"). |
| `POST` | `/api/mcp/call` | Body: `{ "tool": "<agent_name>", "input": {...} }`. Generic, validated call into any agent (MCP "call tool"). |
| `POST` | `/api/orchestrate` | Body: `{ "goal": "<free text>" }`. Convenience route that always goes through the Planner Agent. |
| `GET` | `/api/audit-log` | Recent tool-call audit trail (name, success, duration). |

**Example:**

```bash
curl -X POST http://localhost:3000/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"goal":"Study for my chemistry exam and organize my week"}'
```

---

## 5. The agents

### Planner Agent (orchestrator)
Takes a free-form `goal`, classifies intent using keyword heuristics (exam/study, tasks, scheduling), and **delegates** to the relevant specialist agent(s) via the MCP server — aggregating their results into one plan + human-readable summary.

### Task Optimization Agent
Input: a list of tasks with `urgency` (1–5), `importance` (1–5), `effortHours`. Scores each task with a weighted urgency/importance formula, buckets them into Eisenhower-matrix quadrants (*Do First / Schedule / Delegate / Eliminate*), and returns a priority-sorted list with a concrete recommendation.

### Exam / Study Agent
Input: `subject`, `topics[]`, `examDate`, `hoursPerDay`. Computes days remaining, spreads topics evenly across ~80% of the remaining days, and reserves the final ~20% for review and practice questions.

### Life Scheduler Agent
Input: `wakeTime`, `sleepTime`, `fixedEvents[]` (classes, gym, etc.), `items[]` (tasks/study blocks to fit in). Computes free gaps around fixed commitments and greedily slots items into them, flagging anything that didn't fit so it can roll over to the next day.

---

## 6. Security model

OmniPilot AI treats security as a first-class concern, not an afterthought:

- **Input validation & sanitization** (`validator.js`) — every field passed to every agent goes through a schema validator: type checks, length limits, numeric ranges, HTML/script tag stripping, and control-character removal. No agent ever sees raw, unchecked input.
- **Safe execution** (`safeExecutor.js`) — every agent call is wrapped in a hard timeout (default 8s) and a try/catch that **never leaks stack traces or file paths** to the client. Agents are pure functions over already-validated data — there is no `eval`, no shell access, and no dynamic code execution anywhere in the agent layer.
- **Rate limiting** — a simple in-memory token-bucket limiter throttles abusive request bursts per IP.
- **CORS allowlist** — only origins listed in `ALLOWED_ORIGINS` may call the API from a browser.
- **Security headers** — `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and a restrictive `Content-Security-Policy` are set on every response.
- **Body size limits** — JSON payloads are capped at 100kb to prevent oversized-payload abuse.
- **Audit logging** — every tool call (success/failure, duration, agent name) is recorded in-memory and viewable at `/api/audit-log`, and in the dashboard's "MCP Server Status" panel.

---

## 7. The dashboard

Open `http://localhost:3000` for the **OmniPilot AI** mission-control dashboard:

- **Flight Console** — type a free-form goal, hit *Engage Planner*, and watch the orbit diagram light up the specific agents the Planner routed your request to.
- **Agent panels** — run each of the three specialist agents individually with plain-text/CSV-style inputs (no JSON required).
- **MCP Server Status** — live list of registered tools and a rolling audit log of recent calls.

No frontend framework or build step — plain HTML/CSS/JS served statically by Express.

---

## 8. Antigravity demo — end-to-end walkthrough

*("Antigravity demo" = a scripted, reproducible walkthrough of the whole system, start to finish — read it top to bottom or follow along live.)*

1. **Launch** — `npm install && npm start`. The terminal prints the MCP tool registry:
   `task_optimization_agent, exam_study_agent, life_scheduler_agent, planner_agent`.
2. **Open the dashboard** at `http://localhost:3000`. The status dot turns green ("MCP server online") and the *MCP Server Status* panel lists all four tools — proof the MCP registry and the UI are talking to the same live server.
3. **Type a goal** into the Flight Console, e.g. *"Study for my chemistry exam and organize my week."* Click **Engage Planner**.
4. **Behind the scenes:**
   - The dashboard `POST`s to `/api/orchestrate`.
   - The request passes through security middleware (CORS check → body-size limit → rate limiter).
   - `mcpServer.callTool("planner_agent", ...)` runs the input through `validator.js`, then executes the Planner inside `safeExecutor.js`'s timeout wrapper.
   - The Planner classifies the goal, and — because it mentions "exam" and "week" — **delegates** to `exam_study_agent` (and `life_scheduler_agent`/`task_optimization_agent` for goals that mention tasks or schedules). Each delegated call *also* goes back through `mcpServer.callTool()`, so it's independently validated and sandboxed — agents never bypass security by talking to each other directly.
   - Results are aggregated into a single JSON response with a human-readable summary.
5. **Watch the orbit diagram** — the Planner node pulses, then the relevant specialist node(s) light up green with an animated connecting line, visually confirming which agents were invoked for this specific goal.
6. **Read the result panel** — a plain-English summary ("Study plan spans 11 study day(s) + 3 review day(s)...") plus the full structured JSON from each delegated agent.
7. **Try an individual agent** — e.g. fill in the *Exam / Study* card with a subject, topics, and exam date, and click **Run Agent**. This calls `/api/mcp/call` directly with `{ "tool": "exam_study_agent", ... }`, bypassing the Planner entirely — demonstrating that every agent is independently callable, not just reachable through orchestration.
8. **Check the audit log** — the *MCP Server Status* panel refreshes to show the new call, its success state, and duration in milliseconds — the security-layer's audit trail in action.
9. **Switch to the CLI** — in a terminal, run `node cli/omnipilot-cli.js plan "Organize my tasks and schedule my day"`. The exact same MCP server, agents, and security layer run — just invoked as an "Agent Skill" from the command line instead of the browser, proving the core logic is fully decoupled from the web UI.
10. **Break it on purpose** — call `node cli/omnipilot-cli.js call exam_study_agent '{}'` (missing required fields). The system returns a clean, sanitized validation error (`"Missing required field: subject; ..."`) instead of crashing or leaking a stack trace — the security model working as designed.

This walkthrough exercises all four required concepts (multi-agent orchestration, MCP server architecture, security/validation/safe execution, and CLI agent skills) in a single, reproducible pass.

---

## 9. Extending OmniPilot AI

- **Add a new agent**: create `server/mcp/agents/yourAgent.js` exporting `{ name, description, inputSchema, run(input) }`, then register it in `mcpServer.js` via `this.registerTool(yourAgent)`. It's immediately available to the API, the dashboard, and the CLI.
- **Add real LLM reasoning**: set `ANTHROPIC_API_KEY` in `.env` and extend an agent's `run()` to call the Anthropic API for more nuanced natural-language understanding — the validation/safe-execution layers apply unchanged.
- **Persist data**: swap the in-memory audit log / state for a database of your choice; the MCP server's interface (`listTools`/`callTool`) doesn't need to change.

---

## 10. License

MIT — use freely, adapt for your own multi-agent projects.
