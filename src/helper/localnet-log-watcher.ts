import { findListenerPidsOnPort } from "./platform-process";

export async function findSuiLocalnetListenerPid(): Promise<number | null> {
  const pids = await findListenerPidsOnPort(9000);
  return pids[0] ?? null;
}