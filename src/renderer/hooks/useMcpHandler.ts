import { useEffect, useRef } from 'react';

interface MemoryEntry {
  id: string;
  label: string;
  accountId: string;
  delegateKey: string;
  network: 'mainnet' | 'testnet';
  namespace: string;
}

export function useMcpHandler({
  walletAddress,
  accountState,
  memwalClient,
  network,
  health,
  entries
}: {
  walletAddress: string | null;
  accountState: { accountId: string | null; delegateKey: string | null };
  memwalClient: any;
  network: string;
  health: string | null;
  entries: MemoryEntry[];
}) {
  const stateRef = useRef({
    walletAddress,
    accountState,
    memwalClient,
    network,
    health,
    entries,
  });

  // Frissítjük a ref-et minden renderkor
  stateRef.current = {
    walletAddress,
    accountState,
    memwalClient,
    network,
    health,
    entries,
  };

  const entriesRef = useRef(entries); // ← új
  entriesRef.current = entries;       // ← mindig friss

  useEffect(() => {
    // 1. Ellenőrzés: Létezik-e electronAPI?
    if (typeof window === 'undefined' || !window.electronAPI) {
      console.warn('[MCP] window.electronAPI nem elérhető (valószínűleg nem Electron környezet)');
      return;
    }

    // 2. Ellenőrzés: Létezik-e onMcpRequest és sendMcpResponse?
    if (!window.electronAPI.onMcpRequest || !window.electronAPI.sendMcpResponse) {
      console.error('[MCP] electronAPI.onMcpRequest vagy sendMcpResponse hiányzik!');
      return;
    }

    // 3. Handlerek definiálása
    const handlers: Record<string, (payload: any) => Promise<any>> = {
      'mcp:get-account-info': async () => {
        const { walletAddress, accountState, network, health } = stateRef.current;
        return {
          walletAddress: walletAddress || null,
          accountId: accountState.accountId || null,
          network,
          health: health || null,
        };
      },

      'mcp:project-list': async () => {
        return await (window as any).mcp.projectList();
      },
      'mcp:project-open': async ({ project_name }: { project_name: string }) => {
        console.log('[hook] project-open ELINDULT', project_name);
        const result = await (window as any).mcp.projectOpen(project_name);
        console.log('[hook] mcp.projectOpen result:', JSON.stringify(result));
        console.log('[hook] entries:', entriesRef.current);
        
        const allEntries: MemoryEntry[] = entriesRef.current;
        const memoryCredentials = (result.linkedIds ?? [])
          .map((id: string) => allEntries.find(e => e.id === id))
          .filter(Boolean)
          .map((e: MemoryEntry) => ({
            id: e.id,
            label: e.label,
            accountId: e.accountId,
            delegateKey: e.delegateKey,
            network: e.network,
            namespace: e.namespace,
          }));

        const attachedSkills = await window.skills.getMany(
          result.linkedSkillIds ?? [],
        );

        console.log('[hook] memoryCredentials:', memoryCredentials);
        return {
          ...result,
          memoryCredentials,
          attachedSkills: attachedSkills.map((skill) => ({
            id: skill.id,
            name: skill.name,
            description: skill.description,
            content: skill.content,
          })),
        };
      },
      'mcp:skill-list': async () => window.skills.list(),
      'mcp:skill-get': async ({ skill_id }: { skill_id: string }) => {
        const skill = await window.skills.get(skill_id);
        if (!skill) throw new Error(`Skill not found: ${skill_id}`);
        return skill;
      },
      'mcp:project-create': async ({ project_name }: { project_name: string }) => {
        return await (window as any).mcp.projectCreate(project_name);
      },
      'mcp:project-delete': async ({ project_name }: { project_name: string }) => {
        return await (window as any).mcp.projectDelete(project_name);
      },
      'mcp:project-rename': async ({ old_name, new_name }: { old_name: string; new_name: string }) => {
        return await (window as any).mcp.projectRename(old_name, new_name);
      },
      'mcp:file-read': async ({ project_name, file_path }: { project_name: string; file_path: string }) => {
        return await (window as any).mcp.fileRead(project_name, file_path);
      },
      'mcp:file-write': async ({ project_name, file_path, content }: { project_name: string; file_path: string; content: string }) => {
        return await (window as any).mcp.fileWrite(project_name, file_path, content);
      },
      'mcp:file-delete': async ({ project_name, file_path }: { project_name: string; file_path: string }) => {
        return await (window as any).mcp.fileDelete(project_name, file_path);
      },
      'mcp:file-rename': async ({ project_name, old_path, new_path }: { project_name: string; old_path: string; new_path: string }) => {
        return await (window as any).mcp.fileRename(project_name, old_path, new_path);
      },
      'mcp:folder-create': async ({ project_name, folder_path }: { project_name: string; folder_path: string }) => {
        return await (window as any).mcp.folderCreate(project_name, folder_path);
      },
      'mcp:folder-delete': async ({ project_name, folder_path }: { project_name: string; folder_path: string }) => {
        return await (window as any).mcp.folderDelete(project_name, folder_path);
      },
      'mcp:folder-rename': async ({ project_name, old_path, new_path }: { project_name: string; old_path: string; new_path: string }) => {
        return await (window as any).mcp.folderRename(project_name, old_path, new_path);
      },

      'mcp:playground-create-dwallet': async ({ curve }: { curve?: string }) => {
        const { createSharedDWallet, toIkaConfig } = await import(
          '../pages/playgroundComponents/ika-playground'
        );
        const { createSuiClient, getWalletAddress } = await import(
          '../pages/playgroundComponents/utils'
        );
        const { IkaClient } = await import('@ika.xyz/sdk');

        const config = await window.playground.getIkaConfig();
        if (!config?.packages || !config?.objects) {
          throw new Error('Ika localnet is not configured. Start Ika stack first.');
        }

        const walletAddress = await getWalletAddress();
        if (!walletAddress) {
          throw new Error('Connect or create a Beluga wallet first.');
        }

        const suiClient = createSuiClient('localnet');
        const ikaClient = new IkaClient({
          suiClient,
          config: toIkaConfig(config),
        });

        const validCurves = ['secp256k1', 'secp256r1', 'ed25519', 'ristretto'] as const;
        const picked = validCurves.includes(curve as (typeof validCurves)[number])
          ? (curve as (typeof validCurves)[number])
          : 'secp256k1';

        return createSharedDWallet({
          ikaClient,
          suiClient,
          walletAddress,
          curve: picked,
        });
      },

      'mcp:playground-list-dwallets': async () => {
        const { listOwnedDWalletCaps, toIkaConfig } = await import(
          '../pages/playgroundComponents/ika-playground'
        );
        const { createSuiClient, getWalletAddress } = await import(
          '../pages/playgroundComponents/utils'
        );
        const { IkaClient } = await import('@ika.xyz/sdk');

        const config = await window.playground.getIkaConfig();
        if (!config?.packages || !config?.objects) {
          return [];
        }

        const walletAddress = await getWalletAddress();
        if (!walletAddress) {
          throw new Error('Connect or create a Beluga wallet first.');
        }

        const suiClient = createSuiClient('localnet');
        const ikaClient = new IkaClient({
          suiClient,
          config: toIkaConfig(config),
        });

        return listOwnedDWalletCaps(ikaClient, suiClient, walletAddress);
      },
    };

    console.log('[MCP] Handlerek regisztrálása... (memwalClient ready:', !!stateRef.current.memwalClient, ')');

    // 4. Handlerek regisztrálása + cleanup
    const cleanups: (() => void)[] = [];

    Object.entries(handlers).forEach(([channel, handler]) => {
      const cleanup = window.electronAPI.onMcpRequest(channel, async (payload: any, responseChannel: string) => {
        try {
          // Ellenőrzés: Létezik-e responseChannel?
          if (!responseChannel) {
            throw new Error('Hiányzik a responseChannel.');
          }

          const result = await handler(payload);
          window.electronAPI.sendMcpResponse(responseChannel, result);
        } catch (e: any) {
          console.error(`[MCP] Hiba ${channel}:`, e.message);
          window.electronAPI.sendMcpResponse(responseChannel, {
            error: e.message,
            success: false,
            message: `❌ Hiba: ${e.message}`,
          });
        }
      });
      cleanups.push(cleanup);
    });

    // 5. Cleanup
    // 5. Cleanup - NE töröljük a listenereket, a ref-ek mindig frissek
    return () => {
      console.log('[MCP] Handlerek cleanup - listenetek MARADNAK');
      // cleanups.forEach((cleanup) => cleanup?.());  ← kikommentelve
    };
  }, []); // Üres dependency array = csak mount + unmount
}

