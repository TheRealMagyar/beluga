import { useCallback, useEffect, useState } from "react";
import {
  GitBranch,
  GitCommit,
  GitMerge,
  Loader2,
  RefreshCw,
  Upload,
  Download,
  X,
  Plus,
  ExternalLink,
} from "lucide-react";
import type { Project } from "../types";

type GitStatusPayload = {
  projectPath: string;
  status: {
    isRepo: boolean;
    branch: string | null;
    ahead: number;
    behind: number;
    staged: Array<{ path: string; status: string }>;
    unstaged: Array<{ path: string; status: string }>;
    untracked: Array<{ path: string; status: string }>;
    clean: boolean;
    remoteUrl: string | null;
  };
  github: {
    owner: string;
    repo: string;
    htmlUrl?: string;
    defaultBranch?: string;
    private?: boolean;
  } | null;
};

function VisibilityToggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (isPrivate: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2">
      {(["Private", "Public"] as const).map((label) => {
        const isPrivate = label === "Private";
        const active = value === isPrivate;
        return (
          <button
            key={label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(isPrivate)}
            className={`flex-1 py-2 rounded-xl text-[12px] font-medium border cursor-pointer disabled:opacity-50 ${
              active
                ? "bg-[#4ca3ff]/15 text-[#4ca3ff] border-[#4ca3ff]/30"
                : "bg-[#14141f] text-[#8888a0] border-[#2a2a3c] hover:text-[#f0f0f5]"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function GitHubPanel({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const gh = window.belugaGitHub;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [gitInstalled, setGitInstalled] = useState(true);
  const [payload, setPayload] = useState<GitStatusPayload | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [mergeBranch, setMergeBranch] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [repoName, setRepoName] = useState(project.name);
  const [repoPrivate, setRepoPrivate] = useState(true);
  const [linkOwner, setLinkOwner] = useState("");
  const [linkRepo, setLinkRepo] = useState("");
  const [repos, setRepos] = useState<
    Array<{ full_name: string; html_url: string; private: boolean }>
  >([]);
  const [tab, setTab] = useState<"status" | "connect">("status");

  const refresh = useCallback(async () => {
    if (!gh) return;
    setLoading(true);
    setError(null);
    try {
      const [statusRes, ghStatus] = await Promise.all([
        gh.projectStatus(project.name),
        gh.getStatus(),
      ]);
      setPayload(statusRes as GitStatusPayload);
      setConnected(ghStatus.connected);
      setGitInstalled(ghStatus.gitInstalled);
      if (ghStatus.login) setLinkOwner(ghStatus.login);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load git status.");
    } finally {
      setLoading(false);
    }
  }, [gh, project.name]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    if (!gh) return;
    setBusy(label);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `${label} failed.`);
    } finally {
      setBusy(null);
    }
  };

  const status = payload?.status;
  const linked = payload?.github;
  const hasRemote = Boolean(status?.remoteUrl || linked);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-[#14141f] border border-[#2a2a3c] rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a3c]">
          <div>
            <h2 className="text-[15px] font-semibold text-[#f0f0f5] flex items-center gap-2">
              <GitBranch size={16} className="text-[#4ca3ff]" />
              GitHub — {project.name}
            </h2>
            {linked?.htmlUrl && (
              <a
                href={linked.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#4ca3ff] hover:underline inline-flex items-center gap-1 mt-0.5"
              >
                {linked.owner}/{linked.repo}
                <ExternalLink size={10} />
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8888a0] hover:text-[#f0f0f5] hover:bg-white/5 border-none cursor-pointer bg-transparent"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-1 px-5 pt-3">
          {(["status", "connect"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border-none cursor-pointer ${
                tab === id
                  ? "bg-[#4ca3ff]/15 text-[#4ca3ff]"
                  : "bg-transparent text-[#8888a0] hover:text-[#f0f0f5]"
              }`}
            >
              {id === "status" ? "Git status" : "Connect repo"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!connected && (
            <div className="rounded-xl border border-[#ffb347]/30 bg-[#ffb347]/08 px-4 py-3 text-[12px] text-[#ffb347]">
              Paste a GitHub token under <strong>Settings → GitHub</strong> to
              push or create repos.
            </div>
          )}
          {!gitInstalled && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/08 px-4 py-3 text-[12px] text-red-300">
              Git is not installed. Install Git from Packages → Toolchain or your
              system package manager.
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/08 px-4 py-3 text-[12px] text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#8888a0] text-sm gap-2">
              <Loader2 size={16} className="animate-spin" />
              Loading…
            </div>
          ) : tab === "status" ? (
            <>
              {linked && (
                <div className="rounded-xl border border-[#2a2a3c] bg-[#1c1c2a] px-4 py-3 space-y-2">
                  <p className="text-[11px] font-bold text-[#8888a0] uppercase tracking-wide">
                    Repository visibility
                  </p>
                  <VisibilityToggle
                    value={linked.private !== false}
                    disabled={!!busy || !connected}
                    onChange={(isPrivate) =>
                      void run("Visibility", () =>
                        gh!.setRepoVisibility(project.name, isPrivate),
                      )
                    }
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-xl bg-[#1c1c2a] border border-[#2a2a3c] px-3 py-2">
                  <p className="text-[#666688] uppercase tracking-wide">Branch</p>
                  <p className="text-[#f0f0f5] font-mono mt-1">
                    {status?.branch ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-[#1c1c2a] border border-[#2a2a3c] px-3 py-2">
                  <p className="text-[#666688] uppercase tracking-wide">Ahead</p>
                  <p className="text-[#f0f0f5] font-mono mt-1">{status?.ahead ?? 0}</p>
                </div>
                <div className="rounded-xl bg-[#1c1c2a] border border-[#2a2a3c] px-3 py-2">
                  <p className="text-[#666688] uppercase tracking-wide">Behind</p>
                  <p className="text-[#f0f0f5] font-mono mt-1">{status?.behind ?? 0}</p>
                </div>
              </div>

              {!status?.isRepo && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() =>
                    void run("Init", () => gh!.gitInit(project.name))
                  }
                  className="w-full py-2.5 rounded-xl bg-[#4ca3ff]/15 text-[#4ca3ff] text-[13px] font-medium border border-[#4ca3ff]/25 cursor-pointer hover:bg-[#4ca3ff]/22 disabled:opacity-50"
                >
                  Initialize git repository
                </button>
              )}

              {status?.isRepo && !hasRemote && (
                <div className="rounded-xl border border-[#4ca3ff]/30 bg-[#4ca3ff]/08 px-4 py-3 text-[12px] text-[#4ca3ff]">
                  No GitHub remote yet. Switch to{" "}
                  <button
                    type="button"
                    onClick={() => setTab("connect")}
                    className="underline border-none bg-transparent p-0 text-inherit cursor-pointer"
                  >
                    Connect repo
                  </button>{" "}
                  to create or link a repository before pushing.
                </div>
              )}

              {status?.isRepo && (
                <>
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-[#8888a0] uppercase tracking-wide">
                      Changes
                    </p>
                    {[...(status.staged ?? []), ...(status.unstaged ?? []), ...(status.untracked ?? [])].length === 0 ? (
                      <p className="text-[12px] text-[#666688]">Working tree clean</p>
                    ) : (
                      <ul className="text-[11px] font-mono text-[#c0c0d0] space-y-1 max-h-32 overflow-y-auto">
                        {status.staged.map((f) => (
                          <li key={`s-${f.path}`} className="text-[#00d4aa]">
                            + {f.path}
                          </li>
                        ))}
                        {status.unstaged.map((f) => (
                          <li key={`u-${f.path}`} className="text-[#ffb347]">
                            ~ {f.path}
                          </li>
                        ))}
                        {status.untracked.map((f) => (
                          <li key={`t-${f.path}`} className="text-[#8888a0]">
                            ? {f.path}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder="Commit message"
                      className="flex-1 bg-[#1c1c2a] border border-[#2a2a3c] rounded-xl px-3 py-2 text-[13px] text-[#f0f0f5] outline-none focus:border-[#4ca3ff]/40"
                    />
                    <button
                      type="button"
                      disabled={!!busy || !commitMessage.trim()}
                      onClick={() =>
                        void run("Commit", async () => {
                          await gh!.gitAdd(project.name);
                          await gh!.gitCommit(project.name, commitMessage.trim());
                          setCommitMessage("");
                        })
                      }
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#6c63ff]/20 text-[#c4c0ff] text-[12px] border border-[#6c63ff]/30 cursor-pointer hover:bg-[#6c63ff]/28 disabled:opacity-50"
                    >
                      <GitCommit size={14} />
                      Commit
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!!busy || !connected || !hasRemote}
                      onClick={() => void run("Push", () => gh!.gitPush(project.name))}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#00d4aa]/12 text-[#00d4aa] text-[12px] border border-[#00d4aa]/25 cursor-pointer disabled:opacity-50"
                    >
                      {busy === "Push" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      Push
                    </button>
                    <button
                      type="button"
                      disabled={!!busy || !connected || !hasRemote}
                      onClick={() => void run("Pull", () => gh!.gitPull(project.name))}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#4ca3ff]/12 text-[#4ca3ff] text-[12px] border border-[#4ca3ff]/25 cursor-pointer disabled:opacity-50"
                    >
                      <Download size={14} />
                      Pull
                    </button>
                    <button
                      type="button"
                      disabled={!!busy || !hasRemote}
                      onClick={() => void run("Fetch", () => gh!.gitFetch(project.name))}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 text-[#8888a0] text-[12px] border border-[#2a2a3c] cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={14} />
                      Fetch
                    </button>
                  </div>

                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-[11px] text-[#8888a0] block mb-1">
                        Merge branch
                      </label>
                      <input
                        value={mergeBranch}
                        onChange={(e) => setMergeBranch(e.target.value)}
                        placeholder="feature/my-branch"
                        className="w-full bg-[#1c1c2a] border border-[#2a2a3c] rounded-xl px-3 py-2 text-[13px] text-[#f0f0f5] outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!!busy || !mergeBranch.trim()}
                      onClick={() =>
                        void run("Merge", () =>
                          gh!.gitMerge(project.name, mergeBranch.trim()),
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#ffb347]/12 text-[#ffb347] text-[12px] border border-[#ffb347]/25 cursor-pointer disabled:opacity-50"
                    >
                      <GitMerge size={14} />
                      Merge
                    </button>
                  </div>

                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-[11px] text-[#8888a0] block mb-1">
                        New branch
                      </label>
                      <input
                        value={newBranch}
                        onChange={(e) => setNewBranch(e.target.value)}
                        placeholder="feature/name"
                        className="w-full bg-[#1c1c2a] border border-[#2a2a3c] rounded-xl px-3 py-2 text-[13px] text-[#f0f0f5] outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!!busy || !newBranch.trim()}
                      onClick={() =>
                        void run("Branch", () =>
                          gh!.gitBranchCreate(project.name, newBranch.trim()),
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 text-[#c0c0d0] text-[12px] border border-[#2a2a3c] cursor-pointer disabled:opacity-50"
                    >
                      <Plus size={14} />
                      Create
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="rounded-xl border border-[#2a2a3c] bg-[#1c1c2a] p-4 space-y-3">
                <p className="text-[13px] font-medium text-[#f0f0f5]">
                  Create new GitHub repository
                </p>
                <input
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="Repository name"
                  className="w-full bg-[#14141f] border border-[#2a2a3c] rounded-xl px-3 py-2 text-[13px] text-[#f0f0f5] outline-none"
                />
                <div>
                  <label className="text-[11px] text-[#8888a0] block mb-1.5">
                    Visibility
                  </label>
                  <VisibilityToggle
                    value={repoPrivate}
                    disabled={!!busy}
                    onChange={setRepoPrivate}
                  />
                </div>
                <button
                  type="button"
                  disabled={!!busy || !connected || !repoName.trim()}
                  onClick={() =>
                    void run("Create repo", () =>
                      gh!.createRepo({
                        projectName: project.name,
                        repoName: repoName.trim(),
                        private: repoPrivate,
                        push: true,
                      }),
                    )
                  }
                  className="w-full py-2.5 rounded-xl bg-[#4ca3ff]/15 text-[#4ca3ff] text-[13px] font-medium border border-[#4ca3ff]/25 cursor-pointer disabled:opacity-50"
                >
                  Create on GitHub &amp; push
                </button>
              </div>

              <div className="rounded-xl border border-[#2a2a3c] bg-[#1c1c2a] p-4 space-y-3">
                <p className="text-[13px] font-medium text-[#f0f0f5]">
                  Link existing repository
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={linkOwner}
                    onChange={(e) => setLinkOwner(e.target.value)}
                    placeholder="owner"
                    className="bg-[#14141f] border border-[#2a2a3c] rounded-xl px-3 py-2 text-[13px] text-[#f0f0f5] outline-none"
                  />
                  <input
                    value={linkRepo}
                    onChange={(e) => setLinkRepo(e.target.value)}
                    placeholder="repo"
                    className="bg-[#14141f] border border-[#2a2a3c] rounded-xl px-3 py-2 text-[13px] text-[#f0f0f5] outline-none"
                  />
                </div>
                <button
                  type="button"
                  disabled={!!busy || !connected || !linkOwner || !linkRepo}
                  onClick={() =>
                    void run("Link repo", () =>
                      gh!.connectRepo({
                        projectName: project.name,
                        owner: linkOwner.trim(),
                        repo: linkRepo.trim(),
                      }),
                    )
                  }
                  className="w-full py-2.5 rounded-xl bg-white/5 text-[#c0c0d0] text-[13px] border border-[#2a2a3c] cursor-pointer disabled:opacity-50"
                >
                  Link remote
                </button>
                <button
                  type="button"
                  disabled={!!busy || !connected}
                  onClick={() =>
                    void run("Load repos", async () => {
                      const list = await gh!.listRepos(1);
                      setRepos(list);
                    })
                  }
                  className="text-[11px] text-[#4ca3ff] hover:underline cursor-pointer bg-transparent border-none"
                >
                  Load my repositories
                </button>
                {repos.length > 0 && (
                  <ul className="max-h-36 overflow-y-auto space-y-1">
                    {repos.map((r) => (
                      <li key={r.full_name}>
                        <button
                          type="button"
                          onClick={() => {
                            const [owner, repo] = r.full_name.split("/");
                            setLinkOwner(owner);
                            setLinkRepo(repo);
                          }}
                          className="w-full text-left text-[11px] font-mono text-[#8888a0] hover:text-[#4ca3ff] bg-transparent border-none cursor-pointer py-1"
                        >
                          {r.full_name}
                          {r.private ? " · private" : ""}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}