import type { ReactNode } from "react";

type ClientStatus = Awaited<ReturnType<typeof window.playground.getClientStatus>>;
type LocalStatus = Awaited<
  ReturnType<typeof window.playground.getLocalNetworkStatus>
>;
type StackStatus = Awaited<
  ReturnType<typeof window.playground.getIkaLocalnetStackStatus>
>;
type ResumeStatus = Awaited<
  ReturnType<typeof window.playground.getLocalnetResumeStatus>
>;

export type DiagnosticsDiagramData = {
  client: ClientStatus | null;
  sui: LocalStatus | null;
  stack: StackStatus | null;
  resume: ResumeStatus | null;
};

type NodeTone = "ready" | "active" | "idle" | "warn" | "error";

const TONE_STYLES: Record<
  NodeTone,
  { fill: string; stroke: string; text: string; glow?: string }
> = {
  ready: {
    fill: "rgba(0,212,170,0.14)",
    stroke: "rgba(0,212,170,0.55)",
    text: "#00d4aa",
    glow: "rgba(0,212,170,0.25)",
  },
  active: {
    fill: "rgba(76,163,255,0.16)",
    stroke: "rgba(76,163,255,0.6)",
    text: "#4ca3ff",
    glow: "rgba(76,163,255,0.3)",
  },
  idle: {
    fill: "rgba(85,85,106,0.12)",
    stroke: "rgba(85,85,106,0.45)",
    text: "#8888a0",
  },
  warn: {
    fill: "rgba(255,179,71,0.12)",
    stroke: "rgba(255,179,71,0.5)",
    text: "#ffb347",
    glow: "rgba(255,179,71,0.2)",
  },
  error: {
    fill: "rgba(255,77,109,0.12)",
    stroke: "rgba(255,77,109,0.55)",
    text: "#ff4d6d",
    glow: "rgba(255,77,109,0.25)",
  },
};

function DiagramCard({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/[0.06] bg-[#0a0a12] overflow-hidden">
      <div
        className="px-2.5 py-1.5 border-b border-white/[0.05] text-[10px] font-bold uppercase tracking-wide"
        style={{ color: accent }}
      >
        {title}
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}

function toneFromBool(
  ok: boolean | undefined,
  active = false,
): NodeTone {
  if (ok === true) return "ready";
  if (active) return "active";
  if (ok === false) return "idle";
  return "warn";
}

function TopologyNode({
  x,
  y,
  w,
  h,
  label,
  sublabel,
  tone,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sublabel?: string;
  tone: NodeTone;
}) {
  const s = TONE_STYLES[tone];
  const cx = x + w / 2;
  const dotY = y + 11;
  const labelY = sublabel ? y + 25 : y + 28;
  const sublabelY = y + 36;
  return (
    <g>
      {s.glow ? (
        <rect
          x={x - 2}
          y={y - 2}
          width={w + 4}
          height={h + 4}
          rx={10}
          fill={s.glow}
          opacity={0.6}
        />
      ) : null}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        fill={s.fill}
        stroke={s.stroke}
        strokeWidth={1.2}
      />
      <circle
        cx={cx}
        cy={dotY}
        r={3.5}
        fill={s.text}
        opacity={tone === "idle" ? 0.45 : 1}
      />
      <text
        x={cx}
        y={labelY}
        textAnchor="middle"
        fill={s.text}
        fontSize={9}
        fontWeight={600}
      >
        {label}
      </text>
      {sublabel ? (
        <text
          x={cx}
          y={sublabelY}
          textAnchor="middle"
          fill="#666688"
          fontSize={7.5}
        >
          {sublabel}
        </text>
      ) : null}
    </g>
  );
}

function TopologyArrow({
  x1,
  y1,
  x2,
  y2,
  active,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active: boolean;
}) {
  const stroke = active ? "rgba(76,163,255,0.7)" : "rgba(85,85,106,0.35)";
  const midX = (x1 + x2) / 2;
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={stroke}
        strokeWidth={1.5}
        strokeDasharray={active ? undefined : "4 3"}
      />
      <polygon
        points={`${x2},${y2} ${x2 - 5},${y2 - 3} ${x2 - 5},${y2 + 3}`}
        fill={stroke}
      />
      {active ? (
        <circle cx={midX} cy={y1} r={2} fill="#4ca3ff" opacity={0.9}>
          <animate
            attributeName="opacity"
            values="0.3;1;0.3"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </circle>
      ) : null}
    </g>
  );
}

export function ChainTopologyDiagram({ data }: { data: DiagnosticsDiagramData }) {
  const clientTone = toneFromBool(data.client?.configured);
  const suiTone = toneFromBool(
    data.sui?.rpcReady,
    Boolean(data.sui?.managed || data.sui?.running),
  );
  const ikaTone = toneFromBool(
    data.stack?.ika?.networkDkgReady,
    Boolean(data.stack?.ika?.running),
  );
  const walletTone = toneFromBool(data.stack?.ika?.dwalletReady);

  const link1 = Boolean(data.client?.configured && data.sui?.rpcReady);
  const link2 = Boolean(data.sui?.rpcReady && data.stack?.ika?.running);
  const link3 = Boolean(
    data.stack?.ika?.networkDkgReady && data.stack?.ika?.dwalletReady,
  );

  const NODE_W = 64;
  const NODE_H = 46;
  const NODE_Y = 18;
  const ARROW_Y = NODE_Y + NODE_H / 2;
  const GAP = 18;
  const nodes = [
    {
      label: "Sui client",
      sublabel: data.client?.activeEnv ?? "—",
      tone: clientTone,
    },
    {
      label: "Localnet",
      sublabel: data.sui?.rpcReady ? "RPC" : "off",
      tone: suiTone,
    },
    {
      label: "Ika",
      sublabel: data.stack?.phase ?? "—",
      tone: ikaTone,
    },
    {
      label: "dWallet",
      sublabel: data.stack?.ika?.dwalletReady ? "ready" : "wait",
      tone: walletTone,
    },
  ] as const;
  const links = [link1, link2, link3];

  return (
    <DiagramCard title="Stack topology" accent="#4ca3ff">
      <svg
        viewBox="0 0 320 82"
        className="w-full h-auto block"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Chain stack topology"
      >
        {nodes.map((node, index) => {
          const x = index * (NODE_W + GAP);
          return (
            <g key={node.label}>
              {index > 0 ? (
                <TopologyArrow
                  x1={x - GAP}
                  y1={ARROW_Y}
                  x2={x}
                  y2={ARROW_Y}
                  active={links[index - 1]}
                />
              ) : null}
              <TopologyNode
                x={x}
                y={NODE_Y}
                w={NODE_W}
                h={NODE_H}
                label={node.label}
                sublabel={node.sublabel}
                tone={node.tone}
              />
            </g>
          );
        })}
      </svg>
    </DiagramCard>
  );
}

const READINESS_STEPS = [
  { key: "config", label: "Config" },
  { key: "rpc", label: "RPC" },
  { key: "dkg", label: "DKG" },
  { key: "dwallet", label: "dWallet" },
] as const;

export function ReadinessPipelineDiagram({
  data,
}: {
  data: DiagnosticsDiagramData;
}) {
  const stepState: Record<(typeof READINESS_STEPS)[number]["key"], NodeTone> = {
    config: toneFromBool(
      data.stack?.ika?.configReady,
      Boolean(data.stack?.ika?.running && !data.stack?.ika?.configReady),
    ),
    rpc: toneFromBool(
      data.sui?.rpcReady,
      Boolean(data.sui?.managed && !data.sui?.rpcReady),
    ),
    dkg: toneFromBool(
      data.stack?.ika?.networkDkgReady,
      data.stack?.phase === "dkg" || data.stack?.phase === "bootstrapping",
    ),
    dwallet: toneFromBool(
      data.stack?.ika?.dwalletReady,
      data.stack?.phase === "ready" && !data.stack?.ika?.dwalletReady,
    ),
  };

  const stepWidth = 72;
  const gap = 8;
  const totalW = READINESS_STEPS.length * stepWidth + (READINESS_STEPS.length - 1) * gap;

  return (
    <DiagramCard title="Readiness pipeline" accent="#00e5ff">
      <svg
        viewBox={`0 0 ${totalW} 56`}
        className="w-full h-auto"
        role="img"
        aria-label="Ika readiness pipeline"
      >
        {READINESS_STEPS.map((step, i) => {
          const x = i * (stepWidth + gap);
          const tone = stepState[step.key];
          const s = TONE_STYLES[tone];
          const isLast = i === READINESS_STEPS.length - 1;
          const nextTone = !isLast
            ? stepState[READINESS_STEPS[i + 1].key]
            : null;
          const connectorActive =
            tone === "ready" &&
            (nextTone === "ready" || nextTone === "active");

          return (
            <g key={step.key}>
              {!isLast ? (
                <line
                  x1={x + stepWidth}
                  y1={22}
                  x2={x + stepWidth + gap}
                  y2={22}
                  stroke={
                    connectorActive
                      ? "rgba(0,229,255,0.55)"
                      : "rgba(85,85,106,0.35)"
                  }
                  strokeWidth={2}
                  strokeDasharray={connectorActive ? undefined : "3 3"}
                />
              ) : null}
              <rect
                x={x}
                y={8}
                width={stepWidth}
                height={28}
                rx={6}
                fill={s.fill}
                stroke={s.stroke}
                strokeWidth={1.2}
              />
              <circle
                cx={x + 12}
                cy={22}
                r={4}
                fill={tone === "ready" ? s.text : "transparent"}
                stroke={s.text}
                strokeWidth={tone === "ready" ? 0 : 1.2}
              />
              {tone === "ready" ? (
                <path
                  d={`M ${x + 9.5} 22 L ${x + 11.5} 24.5 L ${x + 15} 19.5`}
                  fill="none"
                  stroke="#080810"
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
              <text
                x={x + stepWidth / 2 + 4}
                y={23}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={s.text}
                fontSize={9}
                fontWeight={600}
              >
                {step.label}
              </text>
              <text
                x={x + stepWidth / 2}
                y={46}
                textAnchor="middle"
                fill="#55556a"
                fontSize={7}
              >
                {tone === "ready"
                  ? "done"
                  : tone === "active"
                    ? "…"
                    : tone === "error"
                      ? "err"
                      : "—"}
              </text>
            </g>
          );
        })}
      </svg>
    </DiagramCard>
  );
}

const PHASES: Array<{
  id: StackStatus["phase"];
  label: string;
}> = [
  { id: "stopped", label: "Stop" },
  { id: "starting", label: "Start" },
  { id: "bootstrapping", label: "Boot" },
  { id: "dkg", label: "DKG" },
  { id: "ready", label: "Ready" },
];

const PHASE_ORDER: StackStatus["phase"][] = [
  "stopped",
  "starting",
  "bootstrapping",
  "dkg",
  "ready",
];

function phaseIndex(phase: StackStatus["phase"] | undefined): number {
  if (!phase) return -1;
  if (phase === "error") return PHASE_ORDER.length;
  return PHASE_ORDER.indexOf(phase);
}

export function StackPhaseDiagram({ data }: { data: DiagnosticsDiagramData }) {
  const current = data.stack?.phase ?? "stopped";
  const currentIdx = phaseIndex(current);
  const isError = current === "error";

  return (
    <DiagramCard title="Stack phase" accent="#7dd3fc">
      <svg
        viewBox="0 0 320 52"
        className="w-full h-auto"
        role="img"
        aria-label="Ika stack phase progression"
      >
        {PHASES.map((phase, i) => {
          const x = 8 + i * 62;
          const isPast = !isError && currentIdx > i;
          const isCurrent = current === phase.id;
          const tone: NodeTone = isError
            ? i === 0
              ? "error"
              : "idle"
            : isCurrent
              ? "active"
              : isPast
                ? "ready"
                : "idle";
          const s = TONE_STYLES[tone];

          return (
            <g key={phase.id}>
              {i < PHASES.length - 1 ? (
                <line
                  x1={x + 36}
                  y1={18}
                  x2={x + 62}
                  y2={18}
                  stroke={
                    isPast || (isCurrent && i < currentIdx)
                      ? "rgba(0,212,170,0.45)"
                      : "rgba(85,85,106,0.3)"
                  }
                  strokeWidth={2}
                />
              ) : null}
              <circle
                cx={x + 18}
                cy={18}
                r={isCurrent ? 9 : 7}
                fill={s.fill}
                stroke={s.stroke}
                strokeWidth={isCurrent ? 2 : 1.2}
              />
              {isPast ? (
                <path
                  d={`M ${x + 15} 18 L ${x + 17} 20.5 L ${x + 21.5} 15`}
                  fill="none"
                  stroke={s.text}
                  strokeWidth={1.3}
                  strokeLinecap="round"
                />
              ) : isCurrent ? (
                <circle cx={x + 18} cy={18} r={3} fill={s.text}>
                  <animate
                    attributeName="r"
                    values="2.5;4;2.5"
                    dur="1.4s"
                    repeatCount="indefinite"
                  />
                </circle>
              ) : null}
              <text
                x={x + 18}
                y={40}
                textAnchor="middle"
                fill={isCurrent ? s.text : "#666688"}
                fontSize={8}
                fontWeight={isCurrent ? 600 : 400}
              >
                {phase.label}
              </text>
            </g>
          );
        })}
        {isError ? (
          <text x={300} y={20} textAnchor="end" fill="#ff4d6d" fontSize={9} fontWeight={600}>
            ERROR
          </text>
        ) : null}
      </svg>
      {data.stack?.label ? (
        <p className="text-[10px] text-[#8888a0] px-0.5 -mt-0.5 leading-snug">
          {data.stack.label}
        </p>
      ) : null}
    </DiagramCard>
  );
}

export function ResumeSessionDiagram({
  data,
}: {
  data: DiagnosticsDiagramData;
}) {
  const resume = data.resume;
  const hasSession = Boolean(resume?.session);

  const nodes = [
    {
      label: "Genesis",
      tone: toneFromBool(resume?.suiGenesisReady),
      detail: resume?.suiGenesisReady ? "saved" : "—",
    },
    {
      label: "Sui resume",
      tone: toneFromBool(resume?.canResumeSui),
      detail: resume?.canResumeSui ? "yes" : "no",
    },
    {
      label: "Ika config",
      tone: toneFromBool(resume?.ikaConfigReady),
      detail: resume?.configMatchesPersisted ? "sync" : "drift",
    },
    {
      label: "Ika resume",
      tone: toneFromBool(resume?.canResumeIka),
      detail: resume?.canResumeIka ? "yes" : "no",
    },
  ];

  return (
    <DiagramCard title="Resume / session" accent="#c4c0ff">
      <svg
        viewBox="0 0 320 72"
        className="w-full h-auto"
        role="img"
        aria-label="Resume and session state"
      >
        {nodes.map((node, i) => {
          const x = 6 + i * 78;
          const s = TONE_STYLES[node.tone];
          return (
            <g key={node.label}>
              {i < nodes.length - 1 ? (
                <line
                  x1={x + 58}
                  y1={24}
                  x2={x + 78}
                  y2={24}
                  stroke={
                    node.tone === "ready"
                      ? "rgba(196,192,255,0.45)"
                      : "rgba(85,85,106,0.3)"
                  }
                  strokeWidth={1.5}
                  strokeDasharray={node.tone === "ready" ? undefined : "3 3"}
                />
              ) : null}
              <rect
                x={x}
                y={8}
                width={58}
                height={32}
                rx={6}
                fill={s.fill}
                stroke={s.stroke}
                strokeWidth={1.2}
              />
              <text
                x={x + 29}
                y={22}
                textAnchor="middle"
                fill={s.text}
                fontSize={8}
                fontWeight={600}
              >
                {node.label}
              </text>
              <text
                x={x + 29}
                y={33}
                textAnchor="middle"
                fill="#666688"
                fontSize={7}
              >
                {node.detail}
              </text>
            </g>
          );
        })}
        <rect
          x={8}
          y={48}
          width={304}
          height={20}
          rx={5}
          fill={
            hasSession
              ? "rgba(196,192,255,0.08)"
              : "rgba(85,85,106,0.08)"
          }
          stroke={
            hasSession
              ? "rgba(196,192,255,0.35)"
              : "rgba(85,85,106,0.3)"
          }
          strokeWidth={1}
        />
        <text x={16} y={61} fill={hasSession ? "#c4c0ff" : "#666688"} fontSize={8}>
          {hasSession
            ? `Session · DKG ${resume?.session?.networkDkgReady ? "ready" : "pending"} · lag ${resume?.suiCheckpointLag ?? "—"}`
            : "No saved session on disk"}
        </text>
      </svg>
    </DiagramCard>
  );
}

export function ChainDiagnosticsDiagrams({
  data,
}: {
  data: DiagnosticsDiagramData;
}) {
  return (
    <div className="space-y-2">
      <ChainTopologyDiagram data={data} />
      <ReadinessPipelineDiagram data={data} />
      <StackPhaseDiagram data={data} />
      <ResumeSessionDiagram data={data} />
    </div>
  );
}