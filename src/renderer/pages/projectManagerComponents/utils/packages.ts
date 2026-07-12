export {
  getLinkedPackageIds,
  saveLinkedPackageIds,
} from "./beluga";

export async function installLinkedPackages(
  projectPath: string,
  packageIds: string[],
): Promise<void> {
  if (!packageIds.length) return;
  await window.packages.installToProject(projectPath, packageIds);
}