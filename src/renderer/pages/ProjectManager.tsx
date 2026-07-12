import { useState, useCallback, useEffect, useMemo } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";
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
import type { ProjectTemplateId } from "./projectManagerComponents/types";
import {
  saveLinkedMemoryIds,
  loadMemoryFragments,
} from "./projectManagerComponents/utils/memory";
import { ProjectCard } from "./projectManagerComponents/project-list/ProjectCard";
import { ProjectExplorer } from "./projectManagerComponents/explorer/ProjectExplorer";
import { MemoryLinkModal } from "./projectManagerComponents/modals/MemoryLinkModal";
import { PackageLinkModal } from "./projectManagerComponents/modals/PackageLinkModal";
import { SkillLinkModal } from "./projectManagerComponents/modals/SkillLinkModal";
import {
  NewProjectModal,
  RenameModal,
  DeleteModal,
} from "./projectManagerComponents/modals/ProjectModals";
import { GitHubPanel } from "./projectManagerComponents/modals/GitHubPanel";
import {
  FilterChip,
  IconButton,
  ProjectsEmpty,
  ProjectsPanel,
  ProjectCardSkeleton,
  SearchField,
  SortSelect,
  ViewToggle,
} from "./projectManagerComponents/projects-ui";

type ProjectFilter = "all" | "memories" | "packages" | "skills";
type ProjectSort = "recent" | "name" | "files";
type ProjectView = "grid" | "list";

function fileCount(project: Project) {
  return project.files.length;
}

function integrationScore(project: Project) {
  return (
    (project.linkedMemoryIds.length > 0 ? 1 : 0) +
    (project.linkedPackageIds.length > 0 ? 1 : 0) +
    (project.linkedSkillIds.length > 0 ? 1 : 0)
  );
}

export default function ProjectManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>({ type: "none" });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProjectFilter>("all");
  const [sort, setSort] = useState<ProjectSort>("recent");
  const [view, setView] = useState<ProjectView>("grid");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [openProject, setOpenProject] = useState<SelectedProject | null>(null);
  const [memoryModalProject, setMemoryModalProject] = useState<Project | null>(
    null,
  );
  const [packageModalProject, setPackageModalProject] =
    useState<Project | null>(null);
  const [skillModalProject, setSkillModalProject] = useState<Project | null>(
    null,
  );
  const [gitHubModalProject, setGitHubModalProject] =
    useState<Project | null>(null);
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

  const stats = useMemo(() => {
    const withMemories = projects.filter((p) => p.linkedMemoryIds.length > 0)
      .length;
    const withPackages = projects.filter((p) => p.linkedPackageIds.length > 0)
      .length;
    const withSkills = projects.filter((p) => p.linkedSkillIds.length > 0)
      .length;
    const integrated = projects.filter((p) => integrationScore(p) > 0).length;
    return {
      total: projects.length,
      withMemories,
      withPackages,
      withSkills,
      integrated,
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = projects.filter((p) => {
      if (q) {
        const hay = `${p.name} ${p.path}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === "memories") return p.linkedMemoryIds.length > 0;
      if (filter === "packages") return p.linkedPackageIds.length > 0;
      if (filter === "skills") return p.linkedSkillIds.length > 0;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "files") return fileCount(b) - fileCount(a);
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    return list;
  }, [projects, search, filter, sort]);

  const handleSelectProject = async (project: Project) => {
    try {
      const fs = getFs();
      const selected: SelectedProject = await fs.selectProject(project.path);
      setOpenProject(selected);
    } catch (e: any) {
      setLoadError(e.message || "Failed to open project.");
    }
  };

  const handleCreate = async (
    name: string,
    template: ProjectTemplateId,
    memoryIds: string[],
  ) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (projects.some((p) => p.name === trimmed)) {
      setActionError("A project with this name already exists.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const dir = await createProject(trimmed, template);
      if (memoryIds.length > 0) {
        await saveLinkedMemoryIds(dir, memoryIds, trimmed);
      }
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
    <div className="flex h-full min-h-0 flex-col bg-[#161616] text-[#f0f0f5] projects-main-glow">
      <header className="flex-shrink-0 sticky top-0 z-30 border-b border-[#2a2a2a] bg-[#1e1e1e]/95 backdrop-blur-sm">
        <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-[#f4f4fa]">Projects</h1>
            <p className="text-[11px] text-[#666688] mt-0.5">
              {stats.total} project{stats.total === 1 ? "" : "s"}
              <span className="mx-1.5 text-[#3a3a48]">·</span>
              {stats.integrated} integrated
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ViewToggle view={view} onChange={setView} />
            <IconButton onClick={refresh} disabled={loading} title="Refresh">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </IconButton>
            <button
              type="button"
              onClick={() => {
                setModal({ type: "newProject" });
                setActionError(null);
              }}
              className="h-9 px-4 flex items-center gap-2 rounded-xl text-[12px] font-semibold cursor-pointer border border-[#4ca3ff]/40 bg-[#4ca3ff]/18 text-[#9ed0ff] hover:bg-[#4ca3ff]/26"
            >
              <Plus size={14} />
              New project
            </button>
          </div>
        </div>

        <div className="px-6 pb-3 flex flex-wrap items-center gap-2.5">
          <div className="flex-1 min-w-[200px] max-w-md">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search projects..."
              icon={<Search size={14} />}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip
              compact
              active={filter === "all"}
              onClick={() => setFilter("all")}
              count={stats.total}
            >
              All
            </FilterChip>
            <FilterChip
              compact
              active={filter === "memories"}
              onClick={() => setFilter("memories")}
              count={stats.withMemories}
            >
              Memories
            </FilterChip>
            <FilterChip
              compact
              active={filter === "packages"}
              onClick={() => setFilter("packages")}
              count={stats.withPackages}
            >
              Packages
            </FilterChip>
            <FilterChip
              compact
              active={filter === "skills"}
              onClick={() => setFilter("skills")}
              count={stats.withSkills}
            >
              Skills
            </FilterChip>
          </div>

          <SortSelect value={sort} onChange={(v) => setSort(v as ProjectSort)} />
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 py-6 max-w-[1400px] mx-auto">
          <ProjectsPanel>
            {loadError ? (
              <div className="mb-6 text-[13px] text-[#ff8fa3] bg-[#ff4d6d]/08 border border-[#ff4d6d]/20 rounded-2xl px-4 py-3">
                {loadError}
              </div>
            ) : null}

            {loading ? (
              <div
                className={
                  view === "grid"
                    ? "grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4"
                    : "space-y-3"
                }
              >
                {Array.from({ length: view === "grid" ? 6 : 4 }).map((_, i) => (
                  <ProjectCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredProjects.length === 0 ? (
              <ProjectsEmpty
                search={search}
                onCreate={() => setModal({ type: "newProject" })}
              />
            ) : (
              <div
                className={
                  view === "grid"
                    ? "grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4"
                    : "space-y-3"
                }
              >
                {filteredProjects.map((project, index) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    variant={view}
                    index={index}
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
                    onManagePackages={() => setPackageModalProject(project)}
                    onManageSkills={() => setSkillModalProject(project)}
                    onManageGitHub={() => setGitHubModalProject(project)}
                  />
                ))}
              </div>
            )}
          </ProjectsPanel>
        </div>
      </main>

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
      {packageModalProject && (
        <PackageLinkModal
          projectPath={packageModalProject.path}
          projectName={packageModalProject.name}
          onClose={() => setPackageModalProject(null)}
          onSaved={() => {
            setPackageModalProject(null);
            refresh();
          }}
        />
      )}
      {skillModalProject && (
        <SkillLinkModal
          projectPath={skillModalProject.path}
          projectName={skillModalProject.name}
          onClose={() => setSkillModalProject(null)}
          onSaved={() => {
            setSkillModalProject(null);
            refresh();
          }}
        />
      )}
      {gitHubModalProject && (
        <GitHubPanel
          project={gitHubModalProject}
          onClose={() => setGitHubModalProject(null)}
        />
      )}
    </div>
  );
}