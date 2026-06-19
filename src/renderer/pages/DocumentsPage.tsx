import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type DocSection =
  | "getting-started"
  | "ai-interaction"
  | "mcp-integration"
  | "advanced";

// ── Shared primitives ─────────────────────────────────────────────────────────

function CodeBlock({
  code,
  language = "typescript",
}: {
  code: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="relative my-4 rounded-xl overflow-hidden border border-[#2a2a3c]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1c1c2a] border-b border-[#2a2a3c]">
        <span className="text-[11px] font-mono text-[#8888a0] uppercase tracking-wide">
          {language}
        </span>
        <button
          onClick={copy}
          className="text-[11px] text-[#8888a0] hover:text-[#f0f0f5] transition-colors flex items-center gap-1.5"
        >
          {copied ? (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#00d4aa"
                strokeWidth="2.5"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-[#00d4aa]">Copied</span>
            </>
          ) : (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="bg-[#0d0d18] p-4 overflow-x-auto text-[13px] leading-relaxed">
        <code className="text-[#a8d4ff] font-mono">{code}</code>
      </pre>
    </div>
  );
}

function Tip({
  children,
  type = "info",
}: {
  children: React.ReactNode;
  type?: "info" | "warning" | "success";
}) {
  const styles = {
    info: {
      border: "border-[#4ca3ff]/25",
      bg: "bg-[#4ca3ff]/6",
      icon: "ℹ",
      color: "text-[#4ca3ff]",
    },
    warning: {
      border: "border-[#ffb347]/25",
      bg: "bg-[#ffb347]/6",
      icon: "⚠",
      color: "text-[#ffb347]",
    },
    success: {
      border: "border-[#00d4aa]/25",
      bg: "bg-[#00d4aa]/6",
      icon: "✓",
      color: "text-[#00d4aa]",
    },
  }[type];
  return (
    <div
      className={`flex gap-3 p-4 rounded-xl border ${styles.border} ${styles.bg} my-4`}
    >
      <span className={`text-[14px] flex-shrink-0 ${styles.color}`}>
        {styles.icon}
      </span>
      <div className="text-[13px] text-[#c0c0d0] leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function Badge({
  children,
  color = "blue",
}: {
  children: React.ReactNode;
  color?: "blue" | "teal" | "orange";
}) {
  const cls = {
    blue: "bg-[#4ca3ff]/12 text-[#4ca3ff]",
    teal: "bg-[#00d4aa]/12 text-[#00d4aa]",
    orange: "bg-[#ffb347]/12 text-[#ffb347]",
  }[color];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide ${cls}`}
    >
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-bold text-[#f0f0f5] mt-8 mb-3 tracking-tight first:mt-0">
      {children}
    </h2>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[14px] font-semibold text-[#4ca3ff] mt-6 mb-2">
      {children}
    </h3>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] text-[#8888a0] leading-relaxed mb-3">
      {children}
    </p>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-[#1c1c2a] text-[#a8d4ff] px-1.5 py-0.5 rounded text-[12px] font-mono">
      {children}
    </code>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[#1e1e1e] border border-[#2a2a3c] rounded-2xl p-5 mb-4 ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold text-[#8888a0] uppercase tracking-[1.2px] mb-4">
      {children}
    </p>
  );
}

function MiniCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-[#14141f] border border-[#2a2a3c] rounded-xl p-4">
      <div className="text-xl mb-2">{icon}</div>
      <p className="text-[13px] font-semibold text-[#f0f0f5] mb-1">{title}</p>
      <p className="text-[11px] text-[#8888a0] leading-relaxed">{desc}</p>
    </div>
  );
}

function ToolRow({
  name,
  params,
  desc,
}: {
  name: string;
  params?: string;
  desc: string;
}) {
  return (
    <div className="bg-[#1c1c2a] border border-[#2a2a3c] rounded-xl px-4 py-3 mb-2 last:mb-0">
      <div className="flex items-center gap-2 mb-1">
        <InlineCode>{name}</InlineCode>
        {params && (
          <span className="text-[11px] text-[#666688] font-mono">
            ({params})
          </span>
        )}
      </div>
      <p className="text-[12px] text-[#8888a0]">{desc}</p>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-[#2a2a3c] my-5" />;
}

// ── Expandable step card (interactive, used in Getting Started) ──────────────

function ExpandableStep({
  n,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  n: number;
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#2a2a3c] rounded-2xl bg-[#1a1a26] mb-3 last:mb-0 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[#1f1f2d] transition-colors"
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#4ca3ff] flex items-center justify-center text-white font-bold text-[13px]">
          {n}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[14px] text-[#f0f0f5]">{title}</p>
          <p className="text-[12px] text-[#8888a0] mt-0.5">{summary}</p>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8888a0"
          strokeWidth="2"
          className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 text-[13px] text-[#c0c0d0] leading-relaxed border-t border-[#2a2a3c]">
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
}

// ── Copy-to-clipboard inline chip (interactive) ───────────────────────────────

function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 bg-[#1c1c2a] hover:bg-[#23233280] border border-[#2a2a3c] px-2 py-1 rounded-lg text-[12px] font-mono text-[#a8d4ff] transition-colors"
    >
      {text}
      {copied ? (
        <span className="text-[#00d4aa] text-[10px]">✓</span>
      ) : (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8888a0"
          strokeWidth="2"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

// ── Prompt example card with copy (interactive, used in Advanced) ────────────

function PromptExample({ prompt, note }: { prompt: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="bg-[#14141f] border border-[#2a2a3c] rounded-xl p-4 mb-3 last:mb-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-[#c0d4e8] leading-relaxed font-mono">
          "{prompt}"
        </p>
        <button
          onClick={copy}
          className="flex-shrink-0 text-[11px] text-[#8888a0] hover:text-[#4ca3ff] transition-colors flex items-center gap-1 mt-0.5"
        >
          {copied ? (
            <span className="text-[#00d4aa]">Copied</span>
          ) : (
            <>
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      {note && (
        <p className="text-[11px] text-[#666688] mt-2 leading-relaxed">
          {note}
        </p>
      )}
    </div>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: DocSection; label: string; badge?: string }[] = [
  { id: "getting-started", label: "Getting Started" },
  { id: "ai-interaction", label: "AI Interaction", badge: "new" },
  { id: "mcp-integration", label: "MCP Integration" },
  { id: "advanced", label: "Advanced Usage" },
];

// ── Sections ──────────────────────────────────────────────────────────────────

function GettingStarted() {
  return (
    <div>
      <SectionTitle>Getting Started</SectionTitle>
      <Prose>
        Walrus Memory is an agentic wallet on the Sui blockchain — vectorized,
        decentralized memory for your AI agents. Your AI stops forgetting what
        you told it: everything is stored, encrypted, on the Walrus network.
      </Prose>

      <Tip type="warning">
        Setting up a new Walrus Memory account is an on-chain action, so make
        sure your wallet holds a small amount of <strong>SUI</strong> before
        you start — it covers the network fee for creating the account.
      </Tip>

      <SubTitle>The four steps</SubTitle>
      <Prose>
        Tap each step below to expand it. Steps 1–3 are one-time setup; once
        they're done, you connect an AI through MCP whenever you want to work.
      </Prose>

      <ExpandableStep
          n={1}
          title="Generate or import a wallet"
          summary="Create a fresh Sui wallet, or bring your own via private key."
          defaultOpen
        >
          <p className="mb-2">
            Click <InlineCode>Generate Wallet</InlineCode> to create a new random
            Sui keypair instantly — no external wallet needed.
          </p>
          <p>
            Already have one? Click <InlineCode>Import Wallet</InlineCode> and
            paste your private key.
          </p>
      </ExpandableStep>

      <ExpandableStep
        n={2}
        title="Create or import a Walrus Memory"
        summary="This is your on-chain memory store — where your AI's context actually lives."
      >
        <p className="mb-2">
          Go to the <InlineCode>Memory</InlineCode> tab. If this is your first
          time, tap <InlineCode>✨ Create Memory Account</InlineCode> — this
          submits a one-time on-chain transaction, which is why you need a bit
          of SUI in your wallet first.
        </p>
        <p className="mb-2">
          Already have a Walrus Memory account from before? Tap{" "}
          <InlineCode>Import Memory</InlineCode> and enter its account ID
          instead of creating a new one.
        </p>
        <p>
          You can optionally set a namespace (e.g.{" "}
          <InlineCode>research</InlineCode>) to keep different memories
          separated. The default namespace is{" "}
          <InlineCode>default</InlineCode>.
        </p>
      </ExpandableStep>

      <ExpandableStep
        n={3}
        title="Create a project and attach your memory"
        summary="Projects are where your files live; memories give them long-term context."
      >
        <p className="mb-2">
          Open the <InlineCode>Projects</InlineCode> tab and tap{" "}
          <InlineCode>+ New Project</InlineCode>. Give it a name — this
          creates a fresh workspace with starter files (
          <InlineCode>WALRUS.md</InlineCode>, <InlineCode>CLAUDE.md</InlineCode>
          ).
        </p>
        <p>
          Then attach the Walrus Memory you created or imported in step 2.
          You can attach more than one memory to the same project if you want
          to combine multiple namespaces or accounts.
        </p>
      </ExpandableStep>

      <ExpandableStep
        n={4}
        title="Connect an AI agent through MCP"
        summary="Point Claude, Cursor, or any MCP-compatible client at your project."
      >
        <p className="mb-2">
          With your wallet, memory, and project set up, you can now connect
          any MCP-compatible AI — Claude Desktop, Cursor, VS Code — directly
          to your projects.
        </p>
        <p>
          Full setup instructions, configuration snippets, and the list of
          available tools are covered in the{" "}
          <strong className="text-[#4ca3ff]">MCP Integration</strong> section.
        </p>
      </ExpandableStep>

      <Tip type="success">
        Generate a delegate key from the{" "}
        <strong className="text-[#00d4aa]">memory.walrus.xyz</strong>{" "}
        Playground without ever exposing your main wallet key. A delegate key
        is scoped to memory operations only.
      </Tip>
    </div>
  );
}

function AiInteraction() {
  const chatMessages = [
    {
      role: "user",
      text: "Open the walrus-agent project and check where we left off.",
    },
    {
      role: "ai",
      text: "Opening the project, then running recall(). [3 results] In the last session we rewrote src/index.ts and extracted helpers.ts. According to WALRUS.md, the error handling layer is still missing.",
    },
    {
      role: "user",
      text: "Save that we handled error handling with try/catch blocks using exponential backoff.",
    },
    {
      role: "ai",
      text: 'Saved. [remember] → "Error handling: try/catch + exponential backoff (500ms, 1000ms, 2000ms). Blob ID: 0xcee7..."',
    },
  ];

  return (
    <div>
      <SectionTitle>AI Interaction</SectionTitle>
      <Prose>
        Your AI agent reaches every Walrus Memory feature through MCP.
        Context never gets lost between sessions — every memory lives on the
        Walrus network, not in a chat window that disappears.
      </Prose>

      <SubTitle>Available actions</SubTitle>
      <div className="grid grid-cols-2 gap-3 my-4">
        <MiniCard
          icon="🗂️"
          title="Manage projects"
          desc="List, open, create, delete, and rename projects."
        />
        <MiniCard
          icon="📁"
          title="File operations"
          desc="Read, write, delete, and rename files. Writes automatically trigger recall + remember."
        />
        <MiniCard
          icon="💾"
          title="Remember"
          desc="Saves text to the Walrus network as a vector embedding. Expected after every decision."
        />
        <MiniCard
          icon="🔍"
          title="Recall"
          desc="Semantic search. Should be called at the start of every session, before the AI does anything else."
        />
        <MiniCard
          icon="🔬"
          title="Analyze"
          desc="Extracts discrete facts from a longer passage of text and saves each one individually."
        />
        <MiniCard
          icon="❤️"
          title="Health check"
          desc="Returns relayer connectivity and account status. Useful for diagnostics."
        />
      </div>

      <Tip type="info">
        Use explicit language when you want something saved — phrases like{" "}
        <em>"save that"</em> or <em>"remember this"</em> — so the agent knows
        when to call <InlineCode>remember()</InlineCode> versus just
        responding conversationally.
      </Tip>

      <SubTitle>Natural language examples</SubTitle>
      <div className="flex flex-col gap-3 mt-3">
        {chatMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "ai" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 mt-0.5 ${
                msg.role === "ai" ? "bg-[#1c3a5c]" : "bg-[#2a2a3c]"
              }`}
            >
              {msg.role === "ai" ? "🦭" : "👤"}
            </div>
            <div
              className={`max-w-[82%] px-4 py-3 rounded-xl text-[13px] leading-relaxed ${
                msg.role === "ai"
                  ? "bg-[#1c1c2a] border border-[#2a2a3c] text-[#c0c0d0]"
                  : "bg-[#4ca3ff]/10 border border-[#4ca3ff]/20 text-[#c0d4e8]"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function McpIntegration() {
  const tools = [
    {
      name: "project_list",
      params: "",
      desc: "Lists all projects with name, path, file count, and last-modified date.",
    },
    {
      name: "project_open",
      params: "project_name",
      desc: "Opens a project — returns the file tree and memory credentials. Pass these along to every subsequent call.",
    },
    {
      name: "project_create",
      params: "project_name",
      desc: "Creates a new project with starter files (WALRUS.md, CLAUDE.md, README.md).",
    },
    {
      name: "project_delete",
      params: "project_name",
      desc: "Deletes a project — irreversible.",
    },
    {
      name: "project_rename",
      params: "old_name, new_name",
      desc: "Renames a project.",
    },
    {
      name: "file_read",
      params: "project_name, file_path",
      desc: "Reads the contents of a file. The path is relative to the project root.",
    },
    {
      name: "file_write",
      params: "project_name, file_path, content, accountId, delegateKey",
      desc: "Creates or overwrites a file. If accountId/delegateKey are provided, recall + remember run automatically.",
    },
    {
      name: "file_delete",
      params: "project_name, file_path",
      desc: "Deletes a file from the project.",
    },
    {
      name: "file_rename",
      params: "project_name, old_path, new_path",
      desc: "Renames or moves a file within the project.",
    },
    {
      name: "folder_create",
      params: "project_name, folder_path",
      desc: "Creates a folder (and any intermediate folders) within the project.",
    },
    {
      name: "folder_delete",
      params: "project_name, folder_path",
      desc: "Deletes a folder and all of its contents — irreversible.",
    },
    {
      name: "folder_rename",
      params: "project_name, old_path, new_path",
      desc: "Renames or moves a folder within the project.",
    },
    {
      name: "remember",
      params: "text, accountId, delegateKey, namespace?",
      desc: "Saves text to the Walrus network as a vector embedding. Expected after every decision or change.",
    },
    {
      name: "recall",
      params: "query, accountId, delegateKey, limit?",
      desc: "Semantic search. Call this at the very start of a session, before the AI takes any action.",
    },
    {
      name: "analyze",
      params: "text, accountId, delegateKey",
      desc: "Extracts facts from text and saves each one as a separate blob.",
    },
    {
      name: "get_health",
      params: "accountId, delegateKey",
      desc: "Returns relayer connectivity and account status.",
    },
    {
      name: "get_account_info",
      params: "",
      desc: "Returns the current wallet address, account ID, and network details.",
    },
  ];

  const claudeConfig = `// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "walrus-memory": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://0.0.0.0:47823/mcp",
        "--allow-http"
      ]
    }
  }
}`;

  const cursorConfig = `// .cursor/mcp.json (at the project root)
{
  "mcpServers": {
    "walrus-memory": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://0.0.0.0:47823/mcp",
        "--allow-http"
      ]
    }
  }
}`;

  return (
    <div>
      <SectionTitle>MCP Integration</SectionTitle>
      <Prose>
        The Model Context Protocol lets any MCP-compatible AI — Claude,
        Cursor, VS Code — connect directly to Walrus Memory's features.
      </Prose>

      <Card>
        <CardHeader>Supported clients</CardHeader>
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              name: "Claude Desktop",
              status: "supported",
              color: "teal" as const,
            },
            {
              name: "Cursor / VS Code",
              status: "supported",
              color: "teal" as const,
            },
            {
              name: "GPT-4 (OpenAI)",
              status: "coming soon",
              color: "orange" as const,
            },
          ].map((item) => (
            <div key={item.name} className="bg-[#0d0d18] rounded-xl p-3">
              <p className="text-[12px] font-medium text-[#f0f0f5] mb-2">
                {item.name}
              </p>
              <Badge color={item.color}>{item.status}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <SubTitle>Setting up Claude Desktop</SubTitle>
      <Prose>
        Open the configuration file and add the Walrus Memory MCP server:
      </Prose>
      <CodeBlock language="json" code={claudeConfig} />

      <Tip type="success">
        After restarting, Claude Desktop's sidebar will show the 🦭 Walrus
        Memory server. From there you can just say:{" "}
        <em className="text-[#00d4aa]">
          "Open the project and check where we left off."
        </em>
      </Tip>

      <SubTitle>Cursor / VS Code integration</SubTitle>
      <CodeBlock language="json" code={cursorConfig} />

      <SubTitle>Available MCP tools</SubTitle>
      <div className="mt-2">
        {tools.map((t) => (
          <ToolRow
            key={t.name}
            name={t.name}
            params={t.params || undefined}
            desc={t.desc}
          />
        ))}
      </div>

      <Tip type="warning">
        Always take the values for <InlineCode>accountId</InlineCode> and{" "}
        <InlineCode>delegateKey</InlineCode> from the{" "}
        <InlineCode>project_open</InlineCode> response — without them, Walrus
        Memory calls fail silently and context gets lost.
      </Tip>
    </div>
  );
}

function Advanced() {
  const handoffSnippet = `1. Run get_account_info to confirm which wallet/account is active.
2. Run project_open("your-project") to fetch the file tree
   and memory credentials (accountId, delegateKey).
3. Run recall({ query: "current state and next steps", limit: 10 })
   before touching any files.
4. Continue from there — the new agent now has full context,
   even though it never saw the previous conversation.`;

  return (
    <div>
      <SectionTitle>Advanced Usage</SectionTitle>
      <Prose>
        Once the basics are working, the biggest gains come from how you talk
        to your agent and how you structure handoffs between sessions, tools,
        or even different AI models entirely.
      </Prose>

      <SubTitle>Prompting tips</SubTitle>
      <Prose>
        Walrus Memory only saves what the agent decides to save, and only
        finds what it's told to look for. A few habits make a real
        difference:
      </Prose>

      <div className="grid grid-cols-2 gap-3 my-4">
        <MiniCard
          icon="🎯"
          title="Be explicit about saving"
          desc='Say "save this" or "remember this for later" rather than assuming the agent will store something on its own.'
        />
        <MiniCard
          icon="🔁"
          title="Open with a recall"
          desc='Start new sessions with "check where we left off" so the agent pulls context before acting.'
        />
        <MiniCard
          icon="🧩"
          title="Name the namespace"
          desc='For multi-project work, say which namespace applies: "save this under the research namespace."'
        />
        <MiniCard
          icon="🧾"
          title="Ask for a summary, not a dump"
          desc="Long debugging sessions produce noise. Ask the agent to summarize the outcome before it saves, not the full transcript."
        />
      </div>

      <SubTitle>Example prompts</SubTitle>
      <PromptExample
        prompt="Before we start, recall anything related to the auth refactor and summarize it."
        note="Forces an explicit recall() at the start of a session instead of relying on the agent to remember on its own."
      />
      <PromptExample
        prompt="We decided to use exponential backoff for retries — 500ms, 1000ms, 2000ms. Remember that under the agent-learnings namespace."
        note="Gives the agent a clear instruction, a concrete fact, and a target namespace in one sentence."
      />
      <PromptExample
        prompt="Read WALRUS.md, then analyze it and save anything that looks like an open task."
        note="Combines file_read with analyze() to turn a loosely written project file into discrete, searchable memories."
      />
      <PromptExample
        prompt="Don't write any code yet. First check get_health and confirm the account is reachable."
        note="Useful when something feels off — catches connectivity issues before the agent burns a turn on a failed write."
      />

      <SubTitle>Switching agents mid-task</SubTitle>
      <Prose>
        Because context lives on the Walrus network and not inside any one
        chat session, you're never locked into a single AI. If you run out of
        tokens, hit a rate limit, or just want to switch from Claude to Cursor
        partway through a task, a new agent can pick up exactly where the
        last one stopped.
      </Prose>

      <Tip type="info">
        The handoff works because memory is keyed to your{" "}
        <InlineCode>accountId</InlineCode> and project — not to a specific
        chat. Any MCP-compatible agent that opens the same project gets the
        same memories.
      </Tip>

      <Prose>
        A typical handoff sequence for the new agent looks like this:
      </Prose>
      <CodeBlock language="text" code={handoffSnippet} />

      <Tip type="success">
        In practice, you can just tell the new agent:{" "}
        <em className="text-[#00d4aa]">
          "Open the [project name] project and continue from where the last
          session left off."
        </em>{" "}
        It will call <InlineCode>project_open</InlineCode> and{" "}
        <InlineCode>recall</InlineCode> on its own and reconstruct the
        context from there.
      </Tip>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function DocsPage() {
  const [active, setActive] = useState<DocSection>("getting-started");
  const [search, setSearch] = useState("");

  const filtered = NAV_ITEMS.filter((n) =>
    n.label.toLowerCase().includes(search.toLowerCase()),
  );

  const renderSection = () => {
    switch (active) {
      case "getting-started":
        return <GettingStarted />;
      case "ai-interaction":
        return <AiInteraction />;
      case "mcp-integration":
        return <McpIntegration />;
      case "advanced":
        return <Advanced />;
    }
  };

  return (
    <div
      className="min-h-screen text-[#f0f0f5]"
      style={{ background: "#161616", fontFamily: "system-ui, sans-serif" }}
    >
      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-[220px_1fr] gap-8">
        {/* Sidebar */}
        <aside>
          <p className="text-[10px] font-bold text-[#8888a0] uppercase tracking-[1.2px] mb-2 px-2">
            Contents
          </p>

          <nav className="flex flex-col gap-0.5">
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-left transition-colors ${
                  active === item.id
                    ? "bg-[#4ca3ff]/12 text-[#4ca3ff]"
                    : "text-[#8888a0] hover:bg-[#1c1c2a] hover:text-[#f0f0f5]"
                }`}
              >
                {item.label}
                {item.badge && (
                  <span className="text-[10px] bg-[#4ca3ff]/15 text-[#4ca3ff] px-1.5 py-0.5 rounded font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <Divider />

          <div className="bg-[#14141f] border border-[#2a2a3c] rounded-xl p-4">
            <p className="text-[11px] font-bold text-[#8888a0] uppercase tracking-wide mb-3">
              Quick links
            </p>
            {[
              { label: "Walrus Playground", href: "https://memory.walrus.xyz" },
              { label: "Github", href: "https://modelcontextprotocol.io" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between py-1.5 text-[12px] text-[#8888a0] hover:text-[#4ca3ff] transition-colors border-b border-[#1e1e2a] last:border-b-0"
              >
                {link.label}
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            ))}
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0">{renderSection()}</main>
      </div>
    </div>
  );
}

export default DocsPage;