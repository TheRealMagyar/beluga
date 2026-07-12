import { ipcMain } from "electron";
import {
  createSkill,
  deleteSkill,
  getSkill,
  getSkillsByIds,
  importSkillFromCatalog,
  listSkillCatalog,
  listSkills,
  updateSkill,
} from "../helper/skills-manager";

export function registerSkillsIpc() {
  ipcMain.handle("skills:list-catalog", async () => listSkillCatalog());

  ipcMain.handle("skills:list", async () => listSkills());

  ipcMain.handle("skills:get", async (_event, { id }: { id: string }) =>
    getSkill(id),
  );

  ipcMain.handle(
    "skills:get-many",
    async (_event, { ids }: { ids: string[] }) => getSkillsByIds(ids),
  );

  ipcMain.handle(
    "skills:create",
    async (
      _event,
      params: {
        name: string;
        description: string;
        content: string;
        id?: string;
      },
    ) => createSkill(params),
  );

  ipcMain.handle(
    "skills:update",
    async (
      _event,
      {
        id,
        patch,
      }: {
        id: string;
        patch: { name?: string; description?: string; content?: string };
      },
    ) => updateSkill(id, patch),
  );

  ipcMain.handle("skills:delete", async (_event, { id }: { id: string }) => {
    await deleteSkill(id);
    return { ok: true };
  });

  ipcMain.handle(
    "skills:import-from-catalog",
    async (_event, { catalogId }: { catalogId: string }) =>
      importSkillFromCatalog(catalogId),
  );

}