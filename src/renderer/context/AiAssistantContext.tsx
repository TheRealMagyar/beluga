import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface AiAssistantContextValue {
  aiReady: boolean;
  isOpen: boolean;
  pendingMessage: string | null;
  openAssistant: (message?: string) => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  clearPendingMessage: () => void;
  refreshAiStatus: () => void;
}

const AiAssistantContext = createContext<AiAssistantContextValue | null>(null);

export function AiAssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [aiReady, setAiReady] = useState(false);

  const refreshAiStatus = useCallback(() => {
    if (!window.belugaAi?.getStatus) {
      setAiReady(false);
      return;
    }
    window.belugaAi
      .getStatus()
      .then((s) => setAiReady(Boolean(s.enabled && s.hasAuth)))
      .catch(() => setAiReady(false));
  }, []);

  useEffect(() => {
    refreshAiStatus();
  }, [refreshAiStatus, isOpen]);

  const openAssistant = useCallback((message?: string) => {
    if (message?.trim()) setPendingMessage(message.trim());
    setIsOpen(true);
  }, []);

  const closeAssistant = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleAssistant = useCallback(() => {
    setIsOpen((v) => !v);
  }, []);

  const clearPendingMessage = useCallback(() => {
    setPendingMessage(null);
  }, []);

  const value = useMemo(
    () => ({
      aiReady,
      isOpen,
      pendingMessage,
      openAssistant,
      closeAssistant,
      toggleAssistant,
      clearPendingMessage,
      refreshAiStatus,
    }),
    [
      aiReady,
      isOpen,
      pendingMessage,
      openAssistant,
      closeAssistant,
      toggleAssistant,
      clearPendingMessage,
      refreshAiStatus,
    ],
  );

  return (
    <AiAssistantContext.Provider value={value}>
      {children}
    </AiAssistantContext.Provider>
  );
}

export function useAiAssistant(): AiAssistantContextValue {
  const ctx = useContext(AiAssistantContext);
  if (!ctx) {
    throw new Error("useAiAssistant must be used within AiAssistantProvider");
  }
  return ctx;
}