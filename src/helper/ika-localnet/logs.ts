import { broadcastLocalnetLogs } from "../localnet-log-broadcast";
import {
  createStreamLogEntry,
  streamLogMessages,
  type StreamLogEntry,
} from "../stream-log-entry";
import {
  IKA_FAUCET_FAILURE_HINT,
  IKA_MOVE_CACHE_HINT,
  IKA_PERMISSION_DENIED_HINT,
} from "./constants";
import {ikaLocalnetRuntime} from "./runtime";

export function pushIkaLog(chunk: string) {
  let changed = false;
  for (const line of chunk.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    ikaLocalnetRuntime.ikaLogs.push(createStreamLogEntry(trimmed));
    changed = true;
  }
  if (ikaLocalnetRuntime.ikaLogs.length > 200) {
    const overflow = ikaLocalnetRuntime.ikaLogs.length - 200;
    ikaLocalnetRuntime.ikaLogs.splice(0, overflow);
    ikaLocalnetRuntime.ikaLogSessionStart = Math.max(0, ikaLocalnetRuntime.ikaLogSessionStart - overflow);
  }
  if (changed) {
    broadcastLocalnetLogs("ika", ikaLocalnetRuntime.ikaLogs);
  }
}

export function sessionIkaLogs(): StreamLogEntry[] {
  return ikaLocalnetRuntime.ikaLogs.slice(ikaLocalnetRuntime.ikaLogSessionStart);
}

export function sessionIkaLogMessages(): string[] {
  return streamLogMessages(sessionIkaLogs());
}

export function isNetworkDkgReadyFromLogs(logs: string[]): boolean {
  return logs.some((line) => {
    if (/presign pool/i.test(line) && /filled|ready|started/i.test(line)) {
      return true;
    }
    if (/run_epoch/.test(line) && /\bepoch[=:\s]+([2-9]|\d{2,})\b/i.test(line)) {
      return true;
    }
    if (/Starting sui connector SuiExecutor run_epoch/.test(line)) {
      const match = line.match(/epoch[=:\s]+([2-9]|\d{2,})\b/i);
      return match != null;
    }
    return false;
  });
}

export function detectIkaFatalStartupError(logs: string[]): string | null {
  const text = logs.join("\n");

  if (
    /Faucet request was unsuccessful/i.test(text) ||
    /\[error\].*Faucet request/i.test(text)
  ) {
    return IKA_FAUCET_FAILURE_HINT;
  }

  if (
    (/\.move\/git|Error while loading dependency|acquiring lock/i.test(text) &&
      /Permission denied|PermissionDenied|os error 13/i.test(text)) ||
    /\[error\].*Error while loading dependency/i.test(text)
  ) {
    const pathMatch = text.match(/path:\s*`([^`]+)`/);
    return pathMatch
      ? `${IKA_MOVE_CACHE_HINT}\n\nLock/cache path:\n${pathMatch[1]}`
      : IKA_MOVE_CACHE_HINT;
  }

  if (
    !/RocksDBError|Failed to create RocksDB directory|Cannot open DB at/i.test(
      text,
    ) ||
    !/Permission denied|PermissionDenied/i.test(text)
  ) {
    return null;
  }

  const pathMatch = text.match(/Cannot open DB at "([^"]+)"/);
  const failedPath = pathMatch?.[1];
  if (failedPath && !failedPath.includes(".beluga-toolchain")) {
    return (
      `${IKA_PERMISSION_DENIED_HINT}\n\n` +
      `Ika still used the system temp folder:\n${failedPath}\n\n` +
      "Quit Beluga completely and run npm start again (without sudo)."
    );
  }

  return failedPath
    ? `${IKA_PERMISSION_DENIED_HINT}\n\nFailed path:\n${failedPath}`
    : IKA_PERMISSION_DENIED_HINT;
}

export function getIkaLocalnetLogSnapshot(): StreamLogEntry[] {
  return [...ikaLocalnetRuntime.ikaLogs];
}

export function getIkaLocalnetLogMessages(): string[] {
  return streamLogMessages(ikaLocalnetRuntime.ikaLogs);
}