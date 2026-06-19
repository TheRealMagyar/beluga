export const DEFAULT_FILES = [
  {
    name: "WALRUS.md",
    content: `# Walrus Memory Instructions for this Project

This project uses **Walrus Memory** as its long-term, persistent memory via the desktop app's MCP server.

## Mandatory Workflow at the Start of Every Session:

1. **Always recall first** — before doing anything else:
   - Call \`memwal_recall\` with: "all memories for this project"
   - Call \`memwal_recall\` with: "architecture, decisions, user preferences, previous changes"

2. **After every important step, decision, bug fix, or lesson learned:**
   - Call \`memwal_remember\` with a short, searchable fact + context

## Available Walrus MCP Tools:

- \`memwal_remember\` — save a single memory
- \`memwal_remember_bulk\` — save multiple memories at once
- \`memwal_recall\` — search and retrieve memories
- \`memwal_analyze\` — analyze stored memories
- \`memwal_restore\` — rebuild the search index if recall returns nothing
- \`memwal_health\` — check if the MCP server is reachable

## Examples:

- \`memwal_recall\`: "What do we know about the UI requirements?"
- \`memwal_remember\`: "User prefers Hungarian UI and dark mode. Decision: use Electron + Tailwind."
- \`memwal_remember\`: "Fixed bug in project generator: namespace collision solved with UUID."
- \`memwal_remember_bulk\`: save multiple decisions after a large refactor

**If \`memwal_recall\` returns nothing despite saved memories:** call \`memwal_restore\` to rebuild the index, then retry.

**Never make things up** — always recall first.
Walrus Memory is the single source of truth for all decisions and changes in this project.`
  },
  {
    name: "CLAUDE.md",
    content: `# AI Agent Instructions

You are working on this project via the desktop app's MCP server.

## Critical Rules (Always Follow)

- At the **very start** of every session: call \`memwal_recall\` to load relevant project memories.
- After any significant change, decision, or discovery: call \`memwal_remember\` to persist it.
- For multiple facts at once: use \`memwal_remember_bulk\`.
- If recall returns nothing: call \`memwal_restore\` to rebuild the index, then retry.
- Never invent information — always recall first.
- Walrus Memory is the single source of truth.

See WALRUS.md for the full tool list and examples.

## Project Overview
[Replace this with a short description of your project]`
  },
  {
    name: "README.md",
    content: `# Project Name

> Created with Walrus Project Manager

## Overview

[Write a short description of the project here.]

## For AI Agents

**Read \`WALRUS.md\` and \`CLAUDE.md\` before doing anything.**
Use \`memwal_recall\` at the start of every session and \`memwal_remember\` after every important change.

---
Generated on ${new Date().toISOString().split('T')[0]}
`
  }
];