import { useState, useCallback, useEffect } from "react";
import {
  Project,
  Modal,
  SelectedProject,
} from "./projectManagerComponents/types";
import {
  loadProjects,
  createProject,
  renameProject,
  deleteProject,
  getFs,
} from "./projectManagerComponents/utils/fs";
import {
  saveLinkedMemoryIds,
  loadMemoryFragments,
} from "./projectManagerComponents/utils/memory";
import { Badge } from "./projectManagerComponents/ui";
import { ProjectCard } from "./projectManagerComponents/project-list/ProjectCard";
import { ProjectExplorer } from "./projectManagerComponents/explorer/ProjectExplorer";
import { MemoryLinkModal } from "./projectManagerComponents/modals/MemoryLinkModal";
import {
  NewProjectModal,
  RenameModal,
  DeleteModal,
} from "./projectManagerComponents/modals/ProjectModals";
import { CONFIG } from "../../config";

// ── ProjectManager ────────────────────────────────────────────────────────────

export default function ProjectManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>({ type: "none" });
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [openProject, setOpenProject] = useState<SelectedProject | null>(null);
  const [memoryModalProject, setMemoryModalProject] = useState<Project | null>(
    null,
  );
  const [availableFragments] = useState(() => loadMemoryFragments());

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setProjects(await loadProjects());
    } catch (e: any) {
      setLoadError(e.message || "Failed to load projects.");
      setProjects([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelectProject = async (project: Project) => {
    try {
      const fs = getFs();
      const selected: SelectedProject = await fs.selectProject(project.path);
      setOpenProject(selected);
    } catch (e: any) {
      setLoadError(e.message || "Failed to open project.");
    }
  };

  const handleCreate = async (name: string, memoryIds: string[]) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (projects.some((p) => p.name === trimmed)) {
      setActionError("A project with this name already exists.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const dir = await createProject(trimmed);
      if (memoryIds.length > 0) await saveLinkedMemoryIds(dir, memoryIds);
      await refresh();
      setModal({ type: "none" });
    } catch (e: any) {
      setActionError(e.message || "Something went wrong.");
    }
    setActionLoading(false);
  };

  const handleRename = async (newName: string) => {
    if (modal.type !== "rename") return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === modal.project.name) {
      setModal({ type: "none" });
      return;
    }
    if (projects.some((p) => p.name === trimmed)) {
      setActionError("A project with this name already exists.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await renameProject(modal.project.name, trimmed);
      await refresh();
      setModal({ type: "none" });
    } catch (e: any) {
      setActionError(e.message || "Something went wrong.");
    }
    setActionLoading(false);
  };

  const handleDelete = async () => {
    if (modal.type !== "delete") return;
    setActionLoading(true);
    setActionError(null);
    try {
      await deleteProject(modal.project.name);
      await refresh();
      setModal({ type: "none" });
    } catch (e: any) {
      setActionError(e.message || "Something went wrong.");
    }
    setActionLoading(false);
  };

  const closeModal = () => {
    setModal({ type: "none" });
    setActionError(null);
  };

  if (openProject) {
    return (
      <ProjectExplorer
        project={openProject}
        onBack={() => {
          setOpenProject(null);
          refresh();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#161616] text-[#f0f0f5]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#1e1e1e] border-b border-[#2a2a2a] px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8888a0] text-sm">
                <img
                  className="h-3 w-3"
                  src={CONFIG.projectManager.projectCard.searchIcon}
                />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full bg-[#1e1e1e] border border-[#2a2a2a] text-[#f0f0f5] placeholder-[#8888a0]
                rounded-xl pl-9 pr-4 py-2.5 text-[13px] outline-none focus:border-[#4ca3ff]/50 transition-colors"
              />
            </div>
            <button
              onClick={refresh}
              title="Refresh"
              className="p-2.5 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] text-[#8888a0] hover:text-[#f0f0f5] hover:border-[#4ca3ff]/40 transition-all text-sm"
            >
              <img
                className="h-4 w-4"
                src={CONFIG.projectManager.projectCard.refreshIcon}
              />
            </button>
          </div>
        </div>
        <button
          onClick={() => {
            setModal({ type: "newProject" });
            setActionError(null);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-opacity hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg, #4ca3ff, #3a85e0)" }}
        >
          <span>+</span>
          <span>New project</span>
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {loadError && (
          <div className="mb-6 text-[13px] text-[#ff4d6d] bg-[#ff4d6d]/08 border border-[#ff4d6d]/20 rounded-xl px-4 py-3">
            ⚠️ {loadError}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-[#4ca3ff] border-t-transparent animate-spin" />
            <div className="text-[#8888a0] text-sm">Loading projects...</div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="text-5xl">
              <img
                className="h-8 w-8"
                src={CONFIG.projectManager.projectCard.noProjectIcon}
              />
            </div>
            <div className="text-lg font-semibold">
              {search ? "No results found" : "No projects yet"}
            </div>
            <div className="text-sm text-[#8888a0] max-w-xs leading-relaxed">
              {search
                ? `No projects matched "${search}".`
                : "Create your first project using the + New project button."}
            </div>
            {!search && (
              <button
                onClick={() => setModal({ type: "newProject" })}
                className="mt-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{
                  background: "linear-gradient(135deg, #4ca3ff, #3a85e0)",
                }}
              >
                + Create first project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onRename={() => {
                  setActionError(null);
                  setModal({ type: "rename", project });
                }}
                onDelete={() => {
                  setActionError(null);
                  setModal({ type: "delete", project });
                }}
                onSelect={() => handleSelectProject(project)}
                onManageMemories={() => setMemoryModalProject(project)}
              />
            ))}
          </div>
        )}
      </div>

      {modal.type === "newProject" && (
        <NewProjectModal
          availableFragments={availableFragments}
          actionError={actionError}
          actionLoading={actionLoading}
          onClose={closeModal}
          onCreate={handleCreate}
        />
      )}
      {modal.type === "rename" && (
        <RenameModal
          project={modal.project}
          actionError={actionError}
          actionLoading={actionLoading}
          onClose={closeModal}
          onRename={handleRename}
        />
      )}
      {modal.type === "delete" && (
        <DeleteModal
          project={modal.project}
          actionError={actionError}
          actionLoading={actionLoading}
          onClose={closeModal}
          onDelete={handleDelete}
        />
      )}
      {/* Fixed project count badge */}
      <div className="fixed bottom-4 right-4 z-50">
        <Badge color="muted">{projects.length} projects</Badge>
      </div>

      {memoryModalProject && (
        <MemoryLinkModal
          projectPath={memoryModalProject.path}
          projectName={memoryModalProject.name}
          onClose={() => setMemoryModalProject(null)}
          onSaved={() => {
            setMemoryModalProject(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
