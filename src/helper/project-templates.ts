import { createBelugaConfig } from "./beluga-project";
import { DEFAULT_FILES } from "./default-files";

export type ProjectTemplateId = "empty" | "vite" | "nextjs" | "move";

export interface ProjectTemplate {
  id: ProjectTemplateId;
  label: string;
  description: string;
  icon: string;
  accent: string;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "empty",
    label: "Empty",
    description: "Beluga starter files only — bring your own stack.",
    icon: "📁",
    accent: "#8888a0",
  },
  {
    id: "vite",
    label: "Vite + React",
    description: "TypeScript React app with Vite dev server and Tailwind.",
    icon: "⚡",
    accent: "#ffb347",
  },
  {
    id: "nextjs",
    label: "Next.js",
    description: "App Router project with TypeScript and Tailwind CSS.",
    icon: "▲",
    accent: "#f0f0f5",
  },
  {
    id: "move",
    label: "Smart contracts",
    description: "Sui Move package with a starter counter module.",
    icon: "⛓",
    accent: "#4ca3ff",
  },
];

interface ScaffoldFile {
  path: string;
  content: string | ((name: string) => string);
}

function sanitizePackageName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/^-+/, "") || "project";
}

function sanitizeMoveName(name: string) {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return cleaned.match(/^[a-z_]/) ? cleaned : `pkg_${cleaned}`;
}

function viteFiles(name: string): ScaffoldFile[] {
  const pkg = sanitizePackageName(name);
  return [
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: pkg,
          private: true,
          version: "0.1.0",
          type: "module",
          scripts: {
            dev: "vite",
            build: "tsc -b && vite build",
            preview: "vite preview",
          },
          dependencies: {
            react: "^19.0.0",
            "react-dom": "^19.0.0",
          },
          devDependencies: {
            "@types/react": "^19.0.0",
            "@types/react-dom": "^19.0.0",
            "@vitejs/plugin-react": "^4.3.4",
            autoprefixer: "^10.4.20",
            postcss: "^8.4.49",
            tailwindcss: "^3.4.17",
            typescript: "^5.7.2",
            vite: "^6.0.3",
          },
        },
        null,
        2,
      ),
    },
    {
      path: "vite.config.ts",
      content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`,
    },
    {
      path: "tsconfig.json",
      content: `{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
`,
    },
    {
      path: "tsconfig.node.json",
      content: `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler"
  },
  "include": ["vite.config.ts"]
}
`,
    },
    {
      path: "index.html",
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    },
    {
      path: "postcss.config.js",
      content: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
    },
    {
      path: "tailwind.config.js",
      content: `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
`,
    },
    {
      path: "src/main.tsx",
      content: `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
    },
    {
      path: "src/App.tsx",
      content: `export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-bold">${name}</h1>
        <p className="text-slate-400 text-sm">
          Vite + React starter. Run <code className="text-amber-300">npm install && npm run dev</code>.
        </p>
      </div>
    </main>
  );
}
`,
    },
    {
      path: "src/index.css",
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;
`,
    },
    {
      path: ".gitignore",
      content: `node_modules
dist
.DS_Store
*.local
`,
    },
  ];
}

function nextjsFiles(name: string): ScaffoldFile[] {
  const pkg = sanitizePackageName(name);
  return [
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: pkg,
          private: true,
          version: "0.1.0",
          scripts: {
            dev: "next dev",
            build: "next build",
            start: "next start",
            lint: "next lint",
          },
          dependencies: {
            next: "^15.1.0",
            react: "^19.0.0",
            "react-dom": "^19.0.0",
          },
          devDependencies: {
            "@types/node": "^22.10.0",
            "@types/react": "^19.0.0",
            "@types/react-dom": "^19.0.0",
            autoprefixer: "^10.4.20",
            postcss: "^8.4.49",
            tailwindcss: "^3.4.17",
            typescript: "^5.7.2",
          },
        },
        null,
        2,
      ),
    },
    {
      path: "next.config.ts",
      content: `import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
`,
    },
    {
      path: "tsconfig.json",
      content: `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`,
    },
    {
      path: "next-env.d.ts",
      content: `/// <reference types="next" />
/// <reference types="next/image-types/global" />
`,
    },
    {
      path: "postcss.config.mjs",
      content: `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
`,
    },
    {
      path: "tailwind.config.ts",
      content: `import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};

export default config;
`,
    },
    {
      path: "app/globals.css",
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-slate-950 text-slate-100 antialiased;
}
`,
    },
    {
      path: "app/layout.tsx",
      content: `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${name}",
  description: "Next.js project created with Beluga",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
    },
    {
      path: "app/page.tsx",
      content: `export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-bold">${name}</h1>
        <p className="text-slate-400 text-sm">
          Next.js starter. Run <code className="text-amber-300">npm install && npm run dev</code>.
        </p>
      </div>
    </main>
  );
}
`,
    },
    {
      path: ".gitignore",
      content: `node_modules
.next
out
.DS_Store
*.local
`,
    },
  ];
}

function moveFiles(name: string): ScaffoldFile[] {
  const moveName = sanitizeMoveName(name);
  return [
    {
      path: "Move.toml",
      content: `[package]
name = "${moveName}"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
${moveName} = "0x0"
`,
    },
    {
      path: `sources/${moveName}.move`,
      content: `module ${moveName}::${moveName} {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::TxContext;

    public struct Counter has key {
        id: UID,
        value: u64,
    }

    entry fun create(ctx: &mut TxContext) {
        transfer::transfer(
            Counter {
                id: object::new(ctx),
                value: 0,
            },
            ctx.sender(),
        );
    }

    entry fun increment(counter: &mut Counter) {
        counter.value = counter.value + 1;
    }
}
`,
    },
    {
      path: ".gitignore",
      content: `build
.DS_Store
`,
    },
  ];
}

function templateReadme(name: string, template: ProjectTemplateId): string {
  const base = PROJECT_TEMPLATES.find((t) => t.id === template);
  const stack = base?.label ?? "Project";

  const setup =
    template === "vite" || template === "nextjs"
      ? `\n## Setup\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`
      : template === "move"
        ? `\n## Build\n\n\`\`\`bash\nsui move build\n\`\`\`\n\nPublish and test from Beluga Playground.\n`
        : "";

  return `# ${name}

> ${stack} project created with Beluga

## Overview

[Write a short description of the project here.]
${setup}
## For AI Agents

**Read \`WALRUS.md\` and \`CLAUDE.md\` before doing anything.**
Use \`memwal_recall\` at the start of every session and \`memwal_remember\` after every important change.

---
Generated on ${new Date().toISOString().split("T")[0]}
`;
}

function metadataFile(name: string, template: ProjectTemplateId): ScaffoldFile {
  return {
    path: "beluga.json",
    content: JSON.stringify(createBelugaConfig(name, template), null, 2),
  };
}

export function getProjectScaffold(
  template: ProjectTemplateId,
  projectName: string,
): ScaffoldFile[] {
  const files: ScaffoldFile[] = [
    metadataFile(projectName, template),
    ...DEFAULT_FILES.map((f) => ({
      path: f.name,
      content:
        f.name === "README.md"
          ? templateReadme(projectName, template)
          : f.content,
    })),
  ];

  if (template === "vite") files.push(...viteFiles(projectName));
  if (template === "nextjs") files.push(...nextjsFiles(projectName));
  if (template === "move") files.push(...moveFiles(projectName));

  return files;
}