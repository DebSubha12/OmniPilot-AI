/* OmniPilot AI — dashboard client logic (no framework, no build step) */

const AGENT_NODE_POS = {
  task_optimization_agent: { x: 90, y: 55 },
  exam_study_agent: { x: 470, y: 55 },
  life_scheduler_agent: { x: 280, y: 225 },
};
const PLANNER_POS = { x: 280, y: 130 };

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({ success: false, error: "Invalid server response." }));
  return data;
}

/* ---------------- Health / status ---------------- */

async function checkHealth() {
  const dot = document.getElementById("statusDot");
  const label = document.getElementById("statusLabel");
  try {
    const data = await api("/api/health");
    if (data.success) {
      dot.classList.add("online");
      dot.classList.remove("offline");
      label.textContent = "MCP server online";
    } else {
      throw new Error("unhealthy");
    }
  } catch {
    dot.classList.add("offline");
    label.textContent = "Server unreachable";
  }
}

/* ---------------- Tools list / audit log ---------------- */

async function loadTools() {
  const el = document.getElementById("toolsList");
  try {
    const data = await api("/api/mcp/tools");
    if (!data.success) throw new Error(data.error || "Failed to load tools");
    el.innerHTML = data.tools
      .map(
        (t) =>
          `<div class="tool-row"><span class="tool-name">${escapeHtml(t.name)}</span><span>${escapeHtml(
            t.description.slice(0, 40)
          )}…</span></div>`
      )
      .join("");
  } catch (err) {
    el.textContent = "Could not load tools: " + err.message;
  }
}

async function loadAuditLog() {
  const el = document.getElementById("auditLog");
  try {
    const data = await api("/api/audit-log");
    if (!data.success) return;
    const rows = data.log.slice(-6).reverse();
    el.innerHTML = rows
      .map(
        (r) =>
          `<div>[${r.ts.slice(11, 19)}] ${escapeHtml(r.name)} — ${r.ok ? "ok" : "error"} (${r.ms}ms)</div>`
      )
      .join("");
  } catch {
    /* non-critical */
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------------- Orbit animation ---------------- */

function drawOrbitLines() {
  const g = document.getElementById("orbitLines");
  g.innerHTML = Object.values(AGENT_NODE_POS)
    .map((p) => `<line data-line x1="${PLANNER_POS.x}" y1="${PLANNER_POS.y}" x2="${p.x}" y2="${p.y}"/>`)
    .join("");
}

function pulseAgents(agentNames) {
  document.querySelectorAll(".agent-node").forEach((n) => n.classList.remove("active"));
  document.querySelectorAll("[data-line]").forEach((l) => l.classList.remove("orbit-line-active"));

  agentNames.forEach((name, i) => {
    const node = document.getElementById(`agentNode-${name}`);
    const lines = document.querySelectorAll("[data-line]");
    setTimeout(() => {
      if (node) node.classList.add("active");
      const pos = AGENT_NODE_POS[name];
      if (pos) {
        lines.forEach((line) => {
          if (Number(line.getAttribute("x2")) === pos.x && Number(line.getAttribute("y2")) === pos.y) {
            line.classList.add("orbit-line-active");
          }
        });
      }
    }, i * 220);
  });
}

/* ---------------- Orchestrator (Planner Agent) ---------------- */

function parseCsvLines(text, fields) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      const obj = {};
      fields.forEach((f, i) => {
        if (parts[i] === undefined || parts[i] === "") return;
        obj[f.name] = f.numeric ? Number(parts[i]) : parts[i];
      });
      return obj;
    });
}

document.getElementById("orchestrateForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("orchestrateBtn");
  const resultBlock = document.getElementById("orchestrateResult");
  const goal = document.getElementById("goalInput").value.trim();
  if (!goal) return;

  btn.disabled = true;
  btn.textContent = "Routing…";
  resultBlock.hidden = false;
  resultBlock.innerHTML = "<em>Planner Agent is decomposing your goal…</em>";

  try {
    const data = await api("/api/orchestrate", { method: "POST", body: JSON.stringify({ goal }) });
    if (!data.success) throw new Error(data.error || "Orchestration failed.");

    pulseAgents(data.data.agentsInvoked || []);

    resultBlock.innerHTML = `
      <h3>Plan summary</h3>
      <p>${escapeHtml(data.data.summary)}</p>
      <p><strong>Agents invoked:</strong> ${data.data.agentsInvoked.map(escapeHtml).join(", ")}</p>
      <pre>${escapeHtml(JSON.stringify(data.data.results, null, 2))}</pre>
    `;
  } catch (err) {
    resultBlock.innerHTML = `<span class="err">Error: ${escapeHtml(err.message)}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Engage Planner";
    loadAuditLog();
  }
});

/* ---------------- Individual agent panels ---------------- */

function buildInputForAgent(agentName, form) {
  const fd = new FormData(form);

  if (agentName === "task_optimization_agent") {
    const tasks = parseCsvLines(fd.get("tasks") || "", [
      { name: "title" },
      { name: "urgency", numeric: true },
      { name: "importance", numeric: true },
      { name: "effortHours", numeric: true },
    ]);
    return { tasks };
  }

  if (agentName === "exam_study_agent") {
    return {
      subject: fd.get("subject"),
      topics: String(fd.get("topics") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      examDate: fd.get("examDate"),
      hoursPerDay: Number(fd.get("hoursPerDay") || 2),
    };
  }

  if (agentName === "life_scheduler_agent") {
    const fixedEvents = parseCsvLines(fd.get("fixedEvents") || "", [
      { name: "title" },
      { name: "start" },
      { name: "end" },
    ]);
    const items = parseCsvLines(fd.get("items") || "", [{ name: "title" }, { name: "hours", numeric: true }]);
    return {
      wakeTime: fd.get("wakeTime"),
      sleepTime: fd.get("sleepTime"),
      fixedEvents,
      items,
    };
  }

  return {};
}

document.querySelectorAll(".agent-form").forEach((form) => {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const agentName = form.dataset.agent;
    const output = form.parentElement.querySelector(".agent-output");
    const btn = form.querySelector("button");

    btn.disabled = true;
    btn.textContent = "Running…";
    output.hidden = false;
    output.innerHTML = "Calling MCP server…";

    try {
      const input = buildInputForAgent(agentName, form);
      const data = await api("/api/mcp/call", {
        method: "POST",
        body: JSON.stringify({ tool: agentName, input }),
      });

      if (!data.success) {
        output.innerHTML = `<span class="err">Error: ${escapeHtml(data.error || "Agent failed.")}</span>`;
      } else {
        pulseAgents([agentName]);
        let html = `<span class="ok-badge">✓ Completed in ${data.meta.durationMs}ms</span><br><br>`;

        if (agentName === "task_optimization_agent") {
          html += "<h3>📋 Prioritized Tasks</h3>";
          (data.data.prioritized || []).forEach((task,index)=>{
            html += `<div class="result-card"><b>${index+1}. ${escapeHtml(task.title)}</b><br>Priority: ${escapeHtml(task.quadrant)}<br>Score: ${task.score}</div>`;
          });
        } else if (agentName === "exam_study_agent") {
          html += "<h3>📚 Study Plan</h3>";
          (data.data.plan || []).forEach(day=>{
            html += `<div class="result-card"><b>Day ${day.day}</b><br>Date: ${day.date}<br>Topics: ${day.focus.join(", ")}<br>Hours: ${day.hours}</div>`;
          });
        } else if (agentName === "life_scheduler_agent") {
          html += "<h3>🗓 Daily Schedule</h3>";
          (data.data.schedule || []).forEach(item=>{
            html += `<div class="result-card"><b>${item.start} - ${item.end}</b><br>${escapeHtml(item.title)}</div>`;
          });
        }
        output.innerHTML = html;
      }
    } catch(err){
      output.innerHTML = `<span class="err">Error: ${escapeHtml(err.message)}</span>`;
    } finally {
      btn.disabled=false;
      btn.textContent="Run Agent";
      loadAuditLog();
    }
  });
});

/* ---------------- Init ---------------- */

(function init() {
  drawOrbitLines();
  checkHealth();
  loadTools();
  loadAuditLog();
  setInterval(checkHealth, 15000);
  setInterval(loadAuditLog, 8000);
})();
