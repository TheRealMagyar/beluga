import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type DocSection =
  | "getting-started"
  | "modules"
  | "playground"
  | "packages"
  | "tools"
  | "ai-assistant"
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
  { id: "modules", label: "Memory & Projects" },
  { id: "playground", label: "Playground" },
  { id: "packages", label: "Packages" },
  { id: "tools", label: "Tools" },
  { id: "ai-assistant", label: "AI Assistant", badge: "new" },
  { id: "mcp-integration", label: "MCP Integration" },
  { id: "advanced", label: "Workflows" },
];

// ── Sections ──────────────────────────────────────────────────────────────────

function GettingStarted() {
  return (
    <div>
      <SectionTitle>Getting Started with Beluga</SectionTitle>
      <Prose>
        Beluga is a desktop hub for Sui and Walrus development. It combines
        persistent AI memory, local project workspaces, a Move playground,
        package management, and built-in dev tools — all reachable from one app
        or through MCP for external agents like Cursor and Claude.
      </Prose>

      <div className="grid grid-cols-3 gap-3 my-4">
        <MiniCard
          icon="🦭"
          title="Memory"
          desc="Walrus-backed vector memory that survives across chat sessions."
        />
        <MiniCard
          icon="📂"
          title="Projects"
          desc="Local workspaces with beluga.json metadata, skills, and packages."
        />
        <MiniCard
          icon="⚡"
          title="Playground"
          desc="Edit, build, and publish Move packages on Sui localnet."
        />
      </div>

      <Tip type="warning">
        Creating a Walrus Memory account is an on-chain action — keep a small
        amount of <strong>SUI</strong> in your Beluga wallet before you start.
      </Tip>

      <SubTitle>First-time setup</SubTitle>
      <Prose>
        Expand each step below. Steps 1–3 are one-time; after that you can use
        the built-in AI Assistant or connect an external agent through MCP.
      </Prose>

      <ExpandableStep
        n={1}
        title="Set up your wallet"
        summary="Generate or import a Sui wallet from the sidebar."
        defaultOpen
      >
        <p className="mb-2">
          Click the <InlineCode>Wallet</InlineCode> button in the sidebar.
          Use <InlineCode>Generate Wallet</InlineCode> for a new keypair, or{" "}
          <InlineCode>Import Wallet</InlineCode> to paste an existing private
          key.
        </p>
        <p>
          The wallet is used for memory account creation, Playground publishes,
          faucet requests, and on-chain tool actions.
        </p>
      </ExpandableStep>

      <ExpandableStep
        n={2}
        title="Create or import Walrus Memory"
        summary="Your on-chain context store for AI agents."
      >
        <p className="mb-2">
          Open <InlineCode>Memory</InlineCode> in the sidebar. Tap{" "}
          <InlineCode>Create Memory Account</InlineCode> for a new account, or{" "}
          <InlineCode>Import Memory</InlineCode> if you already have one.
        </p>
        <p>
          Namespaces (default: <InlineCode>default</InlineCode>) let you
          separate contexts — e.g. <InlineCode>research</InlineCode> vs{" "}
          <InlineCode>playground</InlineCode>.
        </p>
      </ExpandableStep>

      <ExpandableStep
        n={3}
        title="Create a project and link memory"
        summary="Projects hold your code; memory holds what the AI learned."
      >
        <p className="mb-2">
          Go to <InlineCode>Projects</InlineCode> →{" "}
          <InlineCode>+ New Project</InlineCode>. Beluga scaffolds starter
          files and a <InlineCode>beluga.json</InlineCode> config.
        </p>
        <p>
          Link your Walrus Memory to the project so{" "}
          <InlineCode>remember()</InlineCode> and <InlineCode>recall()</InlineCode>{" "}
          calls persist context across sessions. You can also attach Skills and
          Packages from their respective managers.
        </p>
      </ExpandableStep>

      <ExpandableStep
        n={4}
        title="Pick how you work with AI"
        summary="Built-in assistant or external MCP client — or both."
      >
        <p className="mb-2">
          Use the <InlineCode>AI Assistant</InlineCode> panel (sparkle icon) for
          in-app help with full Beluga tool access — Playground deploys,
          package installs, memory recall, and more.
        </p>
        <p>
          Prefer Cursor or Claude Desktop? Connect them via MCP — see{" "}
          <strong className="text-[#4ca3ff]">MCP Integration</strong> for
          config snippets and scoped endpoints.
        </p>
      </ExpandableStep>

      <Tip type="success">
        Configure the AI Assistant under <InlineCode>Settings → AI Assistant</InlineCode>.
        You can use a Grok API key or Grok Build OAuth — enable tool use so the
        assistant can act on your projects directly.
      </Tip>
    </div>
  );
}

function Modules() {
  return (
    <div>
      <SectionTitle>Memory &amp; Projects</SectionTitle>
      <Prose>
        Memory and Projects are the foundation of Beluga. Playground, Packages,
        and Tools build on top — see their dedicated sections in this guide.
      </Prose>

      <SubTitle>Memory</SubTitle>
      <Prose>
        Walrus vector memory linked to projects. Agents call{" "}
        <InlineCode>remember()</InlineCode> after decisions and{" "}
        <InlineCode>recall()</InlineCode> at session start. Supports namespaces
        and delegate keys scoped to memory operations only.
      </Prose>

      <SubTitle>Projects</SubTitle>
      <Prose>
        Local workspaces with file explorer, <InlineCode>beluga.json</InlineCode>{" "}
        metadata, and links to memories, skills, and packages. Open a project
        before any agent work — <InlineCode>project_open</InlineCode> returns the
        file tree, memory credentials, and attached skills/packages.
      </Prose>

      <SubTitle>Skills</SubTitle>
      <Prose>
        Reusable instruction files (<InlineCode>SKILL.md</InlineCode>) linked
        from the project card. Agents load them via{" "}
        <InlineCode>skill_get</InlineCode> or the attached list from{" "}
        <InlineCode>project_open</InlineCode>. Use skills for deploy flows,
        code conventions, or domain-specific rules.
      </Prose>

      <Tip type="info">
        The <strong>Console</strong> page (if enabled in your build) aggregates
        logs from localnet and toolchain jobs — handy when debugging Playground
        or package installs.
      </Tip>
    </div>
  );
}

function PlaygroundSection() {
  const localFlow = `Typical local test loop:
1. CLI panel → Start Sui localnet
2. Faucet panel → fund your Beluga wallet on localnet
3. Edit Move sources in the Monaco editor (or Load from Project)
4. Build → fix compile errors in the console
5. Deploy → publish package; package ID is saved for this session
6. Test → call entry functions with auto-detected args (u64, objects, Coin<SUI>)
7. Explorer → inspect txs, objects, and emitted events`;

  return (
    <div>
      <SectionTitle>Playground — Local Test Environment</SectionTitle>
      <Prose>
        The Playground is Beluga's integrated Move IDE and Sui localnet sandbox.
        Write, compile, publish, and test packages without leaving the app — no
        external terminal required for the core loop.
      </Prose>

      <SubTitle>Two tabs</SubTitle>
      <div className="grid grid-cols-2 gap-3 my-4">
        <MiniCard
          icon="📝"
          title="Move"
          desc="Standard Sui Move packages — editor, build, publish, entry testing, explorer."
        />
        <MiniCard
          icon="🔐"
          title="Ika"
          desc="Ika dWallet stack: local Sui + Ika nodes, heal, faucet, dWallet create/list."
        />
      </div>

      <SubTitle>Dock panels</SubTitle>
      <Prose>
        The vertical dock on the right opens focused panels. Each maps to a step
        in the local dev loop:
      </Prose>
      <div className="mt-2">
        <ToolRow
          name="Build"
          desc="Compile the current workspace with sui move build. Errors and warnings stream to the console."
        />
        <ToolRow
          name="Faucet"
          desc="Request SUI on localnet (or testnet/devnet via network switcher) to fund publishes and entry calls."
        />
        <ToolRow
          name="CLI"
          desc="Start/stop/reset Sui localnet, view live logs, check RPC readiness. For Ika tab: full stack controls."
        />
        <ToolRow
          name="Explorer"
          desc="Browse recent local transactions, object changes, and emitted events with full JSON payloads."
        />
        <ToolRow
          name="Test"
          desc="Auto-detects public entry functions from sources. Builds typed inputs per arg (u64, object IDs, Coin<SUI>)."
        />
        <ToolRow
          name="Deploy"
          desc="Publish compiled modules to the active network. Saves package ID and upgrade cap for follow-up txs."
        />
      </div>

      <SubTitle>Load from Project</SubTitle>
      <Prose>
        Projects with Move code can be loaded into the Playground workspace via{" "}
        <InlineCode>Load from Project</InlineCode>. Beluga copies sources and
        parses entry functions for the Test panel. After iterating locally,
        sync changes back to the project through the AI assistant or file tools.
      </Prose>

      <SubTitle>Local test workflow</SubTitle>
      <CodeBlock language="text" code={localFlow} />

      <Tip type="warning">
        Move 2024: structs need <InlineCode>public</InlineCode> visibility when
        referenced across modules. Entry args use <InlineCode>vector[]</InlineCode>{" "}
        literal syntax where applicable — the Test panel distinguishes{" "}
        <InlineCode>u64</InlineCode> from object IDs automatically.
      </Tip>

      <SubTitle>Networks</SubTitle>
      <Prose>
        The network switcher at the top sets the target for publish and test:
        <InlineCode>localnet</InlineCode> (default for dev),{" "}
        <InlineCode>testnet</InlineCode>, <InlineCode>devnet</InlineCode>, or{" "}
        <InlineCode>mainnet</InlineCode>. Localnet must be running (CLI panel)
        before local publishes succeed.
      </Prose>

      <SubTitle>MCP tools</SubTitle>
      <Prose>
        Agents use scoped endpoint{" "}
        <InlineCode>/mcp/playground</InlineCode> for this area. Key tools:
      </Prose>
      <div className="mt-2">
        <ToolRow
          name="playground_start_sui_localnet"
          params=""
          desc="Start managed Sui localnet."
        />
        <ToolRow
          name="playground_write_files"
          params="files[]"
          desc="Sync Move sources into the workspace before build."
        />
        <ToolRow
          name="playground_build / playground_publish"
          params="files[]"
          desc="Compile and deploy; returns package ID and modules."
        />
        <ToolRow
          name="playground_get_localnet_logs"
          params=""
          desc="Stream validator logs for debugging failed publishes."
        />
        <ToolRow
          name="playground_start_ika_stack"
          params=""
          desc="Boot Ika + Sui stack for dWallet development (Ika tab)."
        />
      </div>
    </div>
  );
}

function PackagesSection() {
  return (
    <div>
      <SectionTitle>Packages</SectionTitle>
      <Prose>
        The Packages manager handles two concerns: installing the Move/Sui{" "}
        <strong>toolchain</strong> on your machine, and managing{" "}
        <strong>SDK npm packages</strong> from the Sui ecosystem catalog.
      </Prose>

      <SubTitle>SDK Catalog</SubTitle>
      <Prose>
        Browse curated npm packages grouped by category — Core, Wallet, Storage,
        Payments, and Tooling. Each entry shows dependencies, install command,
        and documentation link.
      </Prose>
      <div className="grid grid-cols-2 gap-3 my-4">
        <MiniCard
          icon="📥"
          title="Install"
          desc="Downloads the package into Beluga's local package store with pinned versions."
        />
        <MiniCard
          icon="🔗"
          title="Link to project"
          desc="From the project card or MCP — wires versions into the project's package config."
        />
        <MiniCard
          icon="⬆️"
          title="Update"
          desc="Refresh installed packages to newer catalog versions."
        />
        <MiniCard
          icon="🗑️"
          title="Uninstall"
          desc="Remove from the local store; unlink from projects first if attached."
        />
      </div>

      <SubTitle>Toolchain</SubTitle>
      <Prose>
        The Toolchain tab installs and verifies the binaries Playground and Move
        builds depend on:
      </Prose>
      <div className="mt-2">
        <ToolRow
          name="Sui CLI"
          desc="sui move build / publish — required for Playground compile and deploy."
        />
        <ToolRow
          name="suiup"
          desc="Version manager for switching Sui CLI releases."
        />
        <ToolRow
          name="Rust / Cargo"
          desc="Needed for Ika toolchain builds and some native dependencies."
        />
        <ToolRow
          name="Ika CLI + SDK"
          desc="Clone, compile, and install Ika for the Playground Ika tab and dWallet flows."
        />
      </div>

      <Tip type="info">
        Long toolchain jobs show live progress and logs. If a build fails, copy
        logs from the progress panel and check the Console page.
      </Tip>

      <SubTitle>Linking packages to projects</SubTitle>
      <Prose>
        In <InlineCode>Projects</InlineCode>, open a project card →{" "}
        <InlineCode>Link Package</InlineCode> to attach installed SDKs. Linked
        packages appear in <InlineCode>project_open</InlineCode> responses so
        agents know which versions are in use.
      </Prose>

      <SubTitle>MCP tools</SubTitle>
      <div className="mt-2">
        <ToolRow
          name="packages_list_catalog"
          params=""
          desc="List available SDK entries with categories and versions."
        />
        <ToolRow
          name="packages_install"
          params="package_id"
          desc="Install a catalog package into the local store."
        />
        <ToolRow
          name="packages_install_to_project"
          params="package_id, project_name"
          desc="Install and link in one step."
        />
        <ToolRow
          name="packages_link_to_project"
          params="package_id, project_name"
          desc="Link an already-installed package to a project."
        />
        <ToolRow
          name="packages_get_toolchain_status"
          params=""
          desc="Check which CLIs are installed and their versions."
        />
      </div>

      <Tip type="warning">
        Playground publish will fail if Sui CLI is missing — install it from the
        Toolchain tab before your first local deploy.
      </Tip>
    </div>
  );
}

function ToolsSection() {
  return (
    <div>
      <SectionTitle>Tools</SectionTitle>
      <Prose>
        The Tools page bundles on-chain utilities for exploring, auditing, and
        deploying Sui assets. All tools respect the global{" "}
        <InlineCode>NetworkSwitcher</InlineCode> — pick localnet, testnet,
        devnet, or mainnet before running queries.
      </Prose>

      <SubTitle>Transaction Visualizer</SubTitle>
      <Prose>
        Enter any Sui address to map incoming and outgoing transfers as an
        interactive graph. Useful for tracing fund flows, identifying counterparties,
        and understanding wallet activity before interacting with a contract.
      </Prose>

      <SubTitle>Token Scanner</SubTitle>
      <Prose>
        Paste a coin type or package ID to audit mint authority, upgrade
        policies, and liquidity risk signals. Returns a color-coded risk level
        (low → critical) with explanatory flags — handy before swapping or
        holding unfamiliar tokens.
      </Prose>

      <SubTitle>RPC Query Builder</SubTitle>
      <Prose>
        Build and execute Sui gRPC requests with preset templates (objects,
        transactions, checkpoints, events). Edit the JSON body, run the query,
        and inspect formatted responses — a lightweight alternative to grpcurl
        for debugging RPC behavior on your selected network.
      </Prose>

      <SubTitle>Token Generator</SubTitle>
      <Prose>
        Scaffold and deploy a custom Sui coin: name, symbol, decimals, icon URI,
        and supply controls. Choose whether the treasury cap stays in your
        wallet (mint later) or is burned for a fixed supply. Requires a funded
        wallet on the active network.
      </Prose>

      <SubTitle>NFT Manager</SubTitle>
      <Prose>
        End-to-end generative NFT workflow across five tabs:
      </Prose>
      <div className="mt-2">
        <ToolRow
          name="Art & Rarity"
          desc="Layer-based image generation with per-trait rarity weights."
        />
        <ToolRow
          name="Contract"
          desc="Configure collection metadata and on-chain contract parameters."
        />
        <ToolRow
          name="Walrus Storage"
          desc="Upload images and metadata blobs to Walrus before mint."
        />
        <ToolRow
          name="Deploy"
          desc="Publish the collection package to the selected network."
        />
        <ToolRow
          name="Manage"
          desc="Mint, list, and inspect collection objects after deploy."
        />
      </div>

      <SubTitle>MCP tools</SubTitle>
      <Prose>
        Scoped endpoint: <InlineCode>/mcp/tools</InlineCode>
      </Prose>
      <div className="mt-2">
        <ToolRow
          name="tool_scan_token"
          params="coin_type or package"
          desc="Run token scanner analysis from an agent."
        />
        <ToolRow
          name="tool_build_token_package"
          params="metadata, supply options"
          desc="Generate Move sources for a custom coin."
        />
        <ToolRow
          name="tool_build_nft_package"
          params="collection config"
          desc="Generate NFT collection contract sources."
        />
        <ToolRow
          name="tool_grpc_query"
          params="service, method, request JSON"
          desc="Execute a gRPC query programmatically."
        />
        <ToolRow
          name="tool_fetch_address_graph"
          params="address, depth?"
          desc="Fetch transfer graph data for the visualizer."
        />
      </div>

      <Tip type="success">
        Combine Tools with Playground: generate a token or NFT package here,
        then load or adapt the Move sources in the Playground for local testing
        before mainnet deploy.
      </Tip>
    </div>
  );
}

function AiAssistant() {
  const chatMessages = [
    {
      role: "user",
      text: "Open my lottery project, recall what we did, and check if localnet is running.",
    },
    {
      role: "ai",
      text: "Opened lottery → recall() returned 4 hits about ticket_price and deploy. Localnet is up on port 9000. Ready to build or test entry functions.",
    },
    {
      role: "user",
      text: "Build the Move package and publish to localnet.",
    },
    {
      role: "ai",
      text: "playground_write_files → playground_build ✓ → playground_publish ✓ Package ID: 0x160b… Remembered the deploy details.",
    },
  ];

  return (
    <div>
      <SectionTitle>AI Assistant</SectionTitle>
      <Prose>
        Beluga includes a built-in assistant with access to all MCP tools —
        projects, memory, Playground, packages, wallet, and dev tools. No external
        client required for most workflows.
      </Prose>

      <SubTitle>Setup</SubTitle>
      <Prose>
        Go to <InlineCode>Settings → AI Assistant</InlineCode>. Choose{" "}
        <InlineCode>Grok API key</InlineCode> or <InlineCode>Grok Build OAuth</InlineCode>,
        pick a model, and enable <InlineCode>Allow tool use</InlineCode>. Optional:
        toggle <InlineCode>Include page context</InlineCode> so the assistant
        knows which Beluga page you're on.
      </Prose>

      <SubTitle>What it can do</SubTitle>
      <div className="grid grid-cols-2 gap-3 my-4">
        <MiniCard
          icon="📂"
          title="Project workflows"
          desc="Open projects, read/write files, recall and remember context."
        />
        <MiniCard
          icon="⚡"
          title="Playground deploy"
          desc="Write Move files, build, publish, start localnet, test entries."
        />
        <MiniCard
          icon="📦"
          title="Package management"
          desc="Install SDKs, link packages to projects, check toolchain status."
        />
        <MiniCard
          icon="🔧"
          title="Dev tools"
          desc="Token scanner, gRPC queries, wallet faucet, NFT/token generators."
        />
      </div>

      <Tip type="info">
        Tool calls appear as expandable cards in the chat — click to inspect
        arguments and responses. Pin chats in the history sidebar to keep
        long-running tasks organized.
      </Tip>

      <SubTitle>Example conversation</SubTitle>
      <div className="flex flex-col gap-3 mt-3">
        {chatMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "ai" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 mt-0.5 ${
                msg.role === "ai" ? "bg-[#6c63ff]/30" : "bg-[#2a2a3c]"
              }`}
            >
              {msg.role === "ai" ? "✨" : "👤"}
            </div>
            <div
              className={`max-w-[82%] px-4 py-3 rounded-xl text-[13px] leading-relaxed ${
                msg.role === "ai"
                  ? "bg-[#1c1c2a] border border-[#2a2a3c] text-[#c0c0d0]"
                  : "bg-[#6c63ff]/10 border border-[#6c63ff]/20 text-[#c0d4e8]"
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
  const coreTools = [
    {
      name: "project_open",
      params: "project_name",
      desc: "Opens a project — returns file tree, memory credentials, and linked skills/packages.",
    },
    {
      name: "file_read / file_write",
      params: "project_name, file_path, …",
      desc: "Read and write project files. Writes can auto-trigger recall + remember when credentials are set.",
    },
    {
      name: "remember / recall",
      params: "text or query, accountId, delegateKey",
      desc: "Persist and search Walrus Memory. Recall at session start; remember after every decision.",
    },
    {
      name: "skill_list / skill_get",
      params: "skill_id?",
      desc: "List available skills or fetch full SKILL.md instructions by id.",
    },
  ];

  const scopedTools = [
    {
      name: "playground_build / playground_publish",
      params: "files[]",
      desc: "Compile and deploy Move packages from the Playground workspace.",
    },
    {
      name: "playground_start_sui_localnet",
      params: "",
      desc: "Start Sui localnet for testing publishes and entry functions.",
    },
    {
      name: "packages_install",
      params: "package_id, project_name?",
      desc: "Install an SDK package and optionally link it to a project.",
    },
    {
      name: "wallet_request_faucet",
      params: "network?",
      desc: "Fund the Beluga wallet on testnet/devnet/localnet.",
    },
    {
      name: "tool_scan_token",
      params: "address",
      desc: "Scan a wallet for token holdings via the Tools module.",
    },
  ];

  const claudeConfig = `// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "beluga": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://0.0.0.0:47823/mcp",
        "--allow-http"
      ]
    }
  }
}`;

  const cursorConfig = `// .cursor/mcp.json (project root or global)
{
  "mcpServers": {
    "beluga": {
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
        Beluga runs an MCP server on port <InlineCode>47823</InlineCode> while
        the app is open. External agents — Cursor, Claude Desktop, VS Code —
        get the same tools as the built-in AI Assistant.
      </Prose>

      <Tip type="info">
        Beluga must be running for MCP to work. Check{" "}
        <InlineCode>Settings → MCP endpoint</InlineCode> for the live URL and
        connection test.
      </Tip>

      <Card>
        <CardHeader>Scoped endpoints</CardHeader>
        <Prose>
          Use a scoped URL when an agent only needs one area. Playground scope
          includes core project tools.
        </Prose>
        <div className="mt-3 space-y-1.5 text-[12px] font-mono text-[#a8d4ff]">
          <p>
            <CopyChip text="http://0.0.0.0:47823/mcp" /> — all tools
          </p>
          <p>
            <CopyChip text="http://0.0.0.0:47823/mcp/core" /> — projects,
            memory, files, skills
          </p>
          <p>
            <CopyChip text="http://0.0.0.0:47823/mcp/playground" /> —
            localnet, Move build/publish
          </p>
          <p>
            <CopyChip text="http://0.0.0.0:47823/mcp/packages" /> — SDK
            install/link
          </p>
          <p>
            <CopyChip text="http://0.0.0.0:47823/mcp/tools" /> — token
            scanner, gRPC, generators
          </p>
          <p>
            <CopyChip text="http://0.0.0.0:47823/mcp/wallet" /> — balance,
            faucet, send SUI
          </p>
        </div>
      </Card>

      <SubTitle>Claude Desktop</SubTitle>
      <CodeBlock language="json" code={claudeConfig} />

      <SubTitle>Cursor / VS Code</SubTitle>
      <CodeBlock language="json" code={cursorConfig} />

      <Tip type="success">
        For Playground-only work in Cursor, point at{" "}
        <InlineCode>/mcp/playground</InlineCode> — fewer tools, less noise for
        the model.
      </Tip>

      <SubTitle>Core tools</SubTitle>
      <div className="mt-2">
        {coreTools.map((t) => (
          <ToolRow
            key={t.name}
            name={t.name}
            params={t.params || undefined}
            desc={t.desc}
          />
        ))}
      </div>

      <SubTitle>Playground, packages &amp; tools</SubTitle>
      <div className="mt-2">
        {scopedTools.map((t) => (
          <ToolRow
            key={t.name}
            name={t.name}
            params={t.params || undefined}
            desc={t.desc}
          />
        ))}
      </div>

      <Tip type="warning">
        Always pass <InlineCode>accountId</InlineCode> and{" "}
        <InlineCode>delegateKey</InlineCode> from{" "}
        <InlineCode>project_open</InlineCode> into memory calls — without them,
        context won't persist between sessions.
      </Tip>
    </div>
  );
}

function Advanced() {
  const deployFlow = `Playground deploy (agent or manual):
1. playground_start_sui_localnet      — start Sui localnet if needed
2. wallet_request_faucet              — fund wallet on localnet
3. project_open("my-project")         — get memory creds + file context
4. recall({ query: "deploy state" })  — pull prior decisions
5. playground_write_files({ files })  — sync Move sources to workspace
6. playground_build({ files })        — compile; fix errors if any
7. playground_publish({ files })      — deploy; save package ID via remember()`;

  const handoffSnippet = `1. project_open("your-project") — file tree + memory credentials
2. recall({ query: "current state, deploy IDs, open tasks", limit: 10 })
3. Continue work — context lives on Walrus, not in the chat window`;

  return (
    <div>
      <SectionTitle>Common Workflows</SectionTitle>
      <Prose>
        Beluga shines when memory, projects, and Playground work together.
        These patterns work in the built-in assistant and any MCP client.
      </Prose>

      <SubTitle>Playground deploy flow</SubTitle>
      <Prose>
        The standard path from Move source to on-chain package on localnet:
      </Prose>
      <CodeBlock language="text" code={deployFlow} />

      <Tip type="warning">
        Move 2024 requires <InlineCode>public</InlineCode> visibility on structs
        used across modules. Use <InlineCode>vector[]</InlineCode> syntax, not{" "}
        <InlineCode>vector::empty()</InlineCode>, in entry arguments where
        applicable.
      </Tip>

      <SubTitle>Linking packages &amp; skills</SubTitle>
      <Prose>
        Install SDKs in <InlineCode>Packages</InlineCode>, then link them to a
        project from the project card or via{" "}
        <InlineCode>packages_link_to_project</InlineCode>. Link Skills from
        the project card in the UI — agents read attached skills via{" "}
        <InlineCode>project_open</InlineCode> and <InlineCode>skill_get</InlineCode>.
      </Prose>

      <SubTitle>Prompting habits</SubTitle>
      <div className="grid grid-cols-2 gap-3 my-4">
        <MiniCard
          icon="🔁"
          title="Recall first"
          desc='Start sessions with "check where we left off" — agents should recall before editing.'
        />
        <MiniCard
          icon="💾"
          title="Remember outcomes"
          desc='After deploys or decisions: "remember the package ID and what changed."'
        />
        <MiniCard
          icon="📦"
          title="Name the project"
          desc="Always say which project to open — Beluga has no implicit active project for agents."
        />
        <MiniCard
          icon="🧾"
          title="Summarize before saving"
          desc="Ask for a short summary of a long debug session before calling remember()."
        />
      </div>

      <SubTitle>Example prompts</SubTitle>
      <PromptExample
        prompt="Open lottery-project, recall deploy history, start localnet if needed, and publish the current Move code."
        note="Full Playground workflow in one instruction — works in AI Assistant or Cursor with /mcp/playground."
      />
      <PromptExample
        prompt="Install the latest Sui framework package and link it to my-token-project."
        note="Packages manager action via MCP — no manual Move.toml editing."
      />
      <PromptExample
        prompt="Remember: package ID 0x160b…, entry functions are create_lottery(u64), buy_ticket, draw_winner."
        note="Explicit remember after a deploy so the next session knows callable functions."
      />

      <SubTitle>Switching agents mid-task</SubTitle>
      <Prose>
        Memory is on Walrus, keyed to your project — not to a chat. Switch from
        the built-in assistant to Cursor (or vice versa) anytime:
      </Prose>
      <CodeBlock language="text" code={handoffSnippet} />

      <Tip type="success">
        Shorthand for any new agent:{" "}
        <em className="text-[#00d4aa]">
          "Open [project] and continue where we left off."
        </em>
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
      case "modules":
        return <Modules />;
      case "playground":
        return <PlaygroundSection />;
      case "packages":
        return <PackagesSection />;
      case "tools":
        return <ToolsSection />;
      case "ai-assistant":
        return <AiAssistant />;
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
              { label: "Sui Docs", href: "https://docs.sui.io" },
              { label: "Walrus Memory", href: "https://memory.walrus.xyz" },
              { label: "MCP Specification", href: "https://modelcontextprotocol.io" },
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