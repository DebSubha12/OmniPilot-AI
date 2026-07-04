# 🚀 OmniPilot AI

> **A Secure Multi-Agent AI Dashboard** built with **Node.js, Express.js, HTML, CSS, and Vanilla JavaScript**.

OmniPilot AI is a modular AI-inspired system that demonstrates how multiple intelligent agents collaborate to solve different productivity tasks through a centralized **Planner Agent** using an **MCP-style (Model Context Protocol) architecture**.

The project runs completely **offline**, requires **no external AI API**, and provides both a **modern web dashboard** and a **CLI interface**.

---

# 📸 Dashboard

The dashboard includes:

- 🧠 Planner Console
- 📋 Task Optimization Agent
- 📚 Exam Study Planner
- 📅 Life Scheduler Agent
- 📊 Mission Control Visualization
- 📝 Audit Log
- ❤️ Health Monitoring
- ⚡ Live MCP Server Status

---

# ✨ Features

- 🧠 Multi-Agent AI Architecture
- 🎯 Planner (Orchestrator) Agent
- 📋 Task Optimization Agent
- 📚 Exam Study Agent
- 📅 Life Scheduler Agent
- 🔒 Security Middleware
- ⚡ Rate Limiting
- 🌐 REST API
- 💻 Command Line Interface (CLI)
- 📝 Audit Logging
- ❤️ Health Check Endpoint
- 📊 Interactive Dashboard
- 🛡 Input Validation & Safe Execution

---

# 🛠 Tech Stack

## Frontend

- HTML5
- CSS3
- Vanilla JavaScript

## Backend

- Node.js
- Express.js

## Security

- CORS
- Content Security Policy
- Rate Limiting
- JSON Validation
- Security Headers
- Environment Variables (.env)

---

# 🧩 System Architecture

```
                    Planner Agent
                  (Orchestrator)
                        │
     ┌──────────────────┼──────────────────┐
     │                  │                  │
     ▼                  ▼                  ▼
Task Optimization   Exam Study      Life Scheduler
      Agent            Agent             Agent
            │
            ▼
       MCP Server
   (Validation + Security)
            │
      Express REST API
            │
     Web Dashboard / CLI
```

---

# 📂 Project Structure

```
omnipilot-ai/
│
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
│
├── server/
│   ├── index.js
│   └── mcp/
│       ├── agents/
│       ├── security/
│       ├── skills/
│       └── mcpServer.js
│
├── cli/
│   └── omnipilot-cli.js
│
├── package.json
├── package-lock.json
├── .env.example
└── README.md
```

---

# 🤖 Available Agents

## 🧠 Planner Agent

Acts as the central orchestrator.

Responsibilities:

- Understands user goals
- Selects appropriate agents
- Combines outputs
- Returns a complete execution plan

---

## 📋 Task Optimization Agent

Optimizes tasks using:

- Urgency
- Importance
- Effort Hours

Returns:

- Prioritized task list
- Scores
- Eisenhower Matrix category

---

## 📚 Exam Study Agent

Creates personalized study plans.

Input:

- Subject
- Topics
- Exam Date
- Study Hours

Output:

- Daily study schedule
- Revision days
- Topic distribution

---

## 📅 Life Scheduler Agent

Creates optimized daily schedules.

Input:

- Wake Time
- Sleep Time
- Fixed Events
- Tasks

Output:

- Complete timetable
- Free time allocation
- Unscheduled tasks

---

# 🔐 Security Features

Every request passes through multiple security layers.

- Input Validation
- Data Sanitization
- Safe Execution Wrapper
- Request Rate Limiting
- CORS Protection
- Security Headers
- Body Size Limiting
- Global Error Handling
- Audit Logging

---

# 📡 REST API

## Health Check

```
GET /api/health
```

---

## List Available Agents

```
GET /api/mcp/tools
```

---

## Execute Any Agent

```
POST /api/mcp/call
```

Example

```json
{
  "tool":"task_optimization_agent",
  "input":{}
}
```

---

## Planner Agent

```
POST /api/orchestrate
```

Example

```json
{
  "goal":"Prepare for upcoming exams"
}
```

---

## Audit Log

```
GET /api/audit-log
```

---

# 💻 CLI Commands

List available agents

```bash
node cli/omnipilot-cli.js list
```

Run Planner

```bash
node cli/omnipilot-cli.js plan "Prepare for exams"
```

Run specific agent

```bash
node cli/omnipilot-cli.js call exam_study_agent "{...}"
```

---

# ⚙ Installation

Clone the repository

```bash
git clone https://github.com/DebSubha12/OmniPilot-AI.git
```

Move into the project

```bash
cd OmniPilot-AI
```

Install dependencies

```bash
npm install
```

Create environment file

```bash
cp .env.example .env
```

---

# ▶ Running the Project

Start the server

```bash
npm start
```

Open your browser

```
http://localhost:5000
```

---

# 🔧 Environment Variables

Example:

```env
PORT=5000
RATE_LIMIT_PER_MINUTE=60
ALLOWED_ORIGINS=http://localhost:5000
```

---

# 🚀 Future Improvements

- OpenAI API Integration
- Google Gemini Integration
- Voice Assistant
- User Authentication
- MongoDB/MySQL Database
- Export to PDF
- Calendar Integration
- Notification System
- Responsive Mobile UI
- Dark / Light Theme

---

# 👨‍💻 Author

**Subhajit Deb**

GitHub:
https://github.com/DebSubha12

---

# 📜 License

This project is licensed under the **MIT License**.

---

## ⭐ If you like this project

Please consider giving it a ⭐ on GitHub.

It helps others discover the project and supports future development.
