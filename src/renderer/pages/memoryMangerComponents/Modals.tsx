import React from "react";
import type { Network } from "./types";
import { isElectron } from "./constants";

// ── Updated ModalWrapper (sötétebb dizájn) ─────────────────────────────────

function ModalWrapper({
  children,
  onClose,
  maxWidth = "max-w-md",
}: {
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} rounded-2xl border border-[#2a2a3c] bg-[#14141f] p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ── Shared field components ─────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold text-[#8888a0] uppercase tracking-wider mb-1.5">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  type = "text",
  mono = false,
  autoFocus = false,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={`w-full bg-[#262626] border border-[#2a2a3c] text-[#f0f0f5] placeholder-[#8888a0]
        rounded-xl px-4 py-2.5 text-[14px] outline-none focus:border-[#4ca3ff]/60 transition-colors
        ${mono ? "font-mono text-[13px]" : ""} ${className}`}
    />
  );
}

function NetworkSelect({
  value,
  onChange,
  className = "",
}: {
  value: Network;
  onChange: (n: Network) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Network)}
      className={`w-full bg-[#262626] border border-[#2a2a3c] text-[#f0f0f5]
        rounded-xl px-4 py-2.5 text-[14px] outline-none focus:border-[#4ca3ff]/60
        transition-colors cursor-pointer appearance-none ${className}`}
    >
      <option value="mainnet">🟢 Mainnet</option>
      <option value="testnet">🟡 Testnet</option>
    </select>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="text-[12px] text-[#ff4d6d] bg-[#ff4d6d]/08 border border-[#ff4d6d]/20 rounded-lg px-3 py-2 leading-relaxed">
      ⚠️ {message}
    </div>
  );
}

function BtnCancel({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded-xl text-[13px] text-[#8888a0] bg-[#262626] border border-[#2a2a3c]
        hover:text-[#f0f0f5] transition-colors disabled:opacity-40"
    >
      Cancel
    </button>
  );
}

function BtnPrimary({
  onClick,
  disabled = false,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40
        transition-opacity hover:opacity-90"
      style={{ background: "linear-gradient(135deg, #4ca3ff, #3a85e0)" }}
    >
      {children}
    </button>
  );
}

// ── Create Account Modal ────────────────────────────────────────────────

interface CreateModalProps {
  walletAddress: string | null;
  createLabel: string;
  setCreateLabel: (v: string) => void;
  createNetwork: Network;
  setCreateNetwork: (n: Network) => void;
  createLoading: boolean;
  createError: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function CreateModal({
  walletAddress,
  createLabel,
  setCreateLabel,
  createNetwork,
  setCreateNetwork,
  createLoading,
  createError,
  onConfirm,
  onClose,
}: CreateModalProps) {
  return (
    <ModalWrapper onClose={() => !createLoading && onClose()}>
      <div className="text-lg font-bold mb-1">✨ Create new memory</div>
      <div className="text-[13px] text-[#8888a0] mb-5 leading-relaxed">
        This will create a new on-chain account along with its delegate key.{" "}
        {isElectron
          ? "Signing will be handled automatically by the integrated wallet."
          : "You'll need to approve a wallet transaction for this."}
      </div>

      {!walletAddress ? (
        <>
          <div className="text-[13px] text-[#ff4d6d] mb-4">
            No integrated wallet available. Set one up on the Wallet page.
          </div>
          <div className="flex gap-3 justify-end">
            <BtnCancel onClick={onClose} />
          </div>
        </>
      ) : (
        <>
          <FieldLabel>Name</FieldLabel>
          <TextInput
            value={createLabel}
            onChange={setCreateLabel}
            placeholder="E.g.: Work, Personal, Project X..."
            className="mb-3.5"
          />

          <FieldLabel>Network</FieldLabel>
          <NetworkSelect
            value={createNetwork}
            onChange={setCreateNetwork}
            className="mb-4"
          />

          {createError && (
            <div className="mb-4">
              <ErrorBox message={createError} />
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <BtnCancel onClick={onClose} disabled={createLoading} />
            <BtnPrimary onClick={onConfirm} disabled={createLoading}>
              {createLoading ? "⏳ In progress…" : "✨ Create"}
            </BtnPrimary>
          </div>
        </>
      )}
    </ModalWrapper>
  );
}

// ── Import Modal ────────────────────────────────────────────────────────

interface ImportModalProps {
  importLabel: string;
  setImportLabel: (v: string) => void;
  importAccountId: string;
  setImportAccountId: (v: string) => void;
  importDelegateKey: string;
  setImportDelegateKey: (v: string) => void;
  importNetwork: Network;
  setImportNetwork: (n: Network) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function ImportModal({
  importLabel,
  setImportLabel,
  importAccountId,
  setImportAccountId,
  importDelegateKey,
  setImportDelegateKey,
  importNetwork,
  setImportNetwork,
  onConfirm,
  onClose,
}: ImportModalProps) {
  return (
    <ModalWrapper onClose={onClose}>
      <div className="text-lg font-bold mb-1">📥 Import memory</div>
      <div className="text-[13px] text-[#8888a0] mb-5 leading-relaxed">
        Enter an existing account ID and its corresponding delegate private key.
      </div>

      <FieldLabel>Name</FieldLabel>
      <TextInput
        value={importLabel}
        onChange={setImportLabel}
        placeholder="E.g.: Work, Personal, Project X..."
        className="mb-3.5"
      />

      <FieldLabel>Account ID (0x…)</FieldLabel>
      <TextInput
        value={importAccountId}
        onChange={setImportAccountId}
        placeholder="0xcee7…"
        mono
        className="mb-3.5"
      />

      <FieldLabel>Delegate Private Key (hex)</FieldLabel>
      <TextInput
        value={importDelegateKey}
        onChange={setImportDelegateKey}
        placeholder="a1b2c3…"
        type="password"
        mono
        className="mb-3.5"
      />

      <FieldLabel>Network</FieldLabel>
      <NetworkSelect
        value={importNetwork}
        onChange={setImportNetwork}
        className="mb-4"
      />

      <div className="text-[11.5px] text-[#8888a0] leading-relaxed mb-5">
        You can generate the delegate private key on the{" "}
        <a
          href="https://memory.walrus.xyz"
          target="_blank"
          rel="noreferrer"
          className="text-[#4ca3ff] hover:underline"
        >
          memory.walrus.xyz
        </a>{" "}
        Playground.
      </div>

      <div className="flex gap-3 justify-end">
        <BtnCancel onClick={onClose} />
        <BtnPrimary
          onClick={onConfirm}
          disabled={!importAccountId.trim() || !importDelegateKey.trim()}
        >
          📥 Import
        </BtnPrimary>
      </div>
    </ModalWrapper>
  );
}

// ── Rename Modal ────────────────────────────────────────────────────────

interface RenameModalProps {
  renameValue: string;
  setRenameValue: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function RenameModal({
  renameValue,
  setRenameValue,
  onConfirm,
  onClose,
}: RenameModalProps) {
  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-xs">
      <div className="text-lg font-bold mb-1">✏️ Rename memory</div>

      <FieldLabel>New name</FieldLabel>
      <TextInput
        value={renameValue}
        onChange={setRenameValue}
        onKeyDown={(e) => e.key === "Enter" && onConfirm()}
        autoFocus
        className="mb-4"
      />

      <div className="flex gap-3 justify-end">
        <BtnCancel onClick={onClose} />
        <BtnPrimary onClick={onConfirm} disabled={!renameValue.trim()}>
          ✏️ Save
        </BtnPrimary>
      </div>
    </ModalWrapper>
  );
}

// ── Delete Confirm Modal ────────────────────────────────────────────────

interface DeleteModalProps {
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteModal({ onConfirm, onClose }: DeleteModalProps) {
  return (
    <ModalWrapper onClose={onClose}>
      <div className="text-lg font-bold mb-1 text-[#ff4d6d]">
        🗑️ Delete memory
      </div>
      <div className="text-[13.5px] text-[#8888a0] leading-relaxed mb-5">
        This only removes the connection here — be sure to safely store the
        account ID and delegate key elsewhere if you might need them later. This
        does not delete the on-chain account.
      </div>

      <div className="flex gap-3 justify-end">
        <BtnCancel onClick={onClose} />
        <button
          onClick={onConfirm}
          className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white bg-[#ff4d6d] hover:bg-[#e03058] transition-colors"
        >
          🗑️ Yes, delete
        </button>
      </div>
    </ModalWrapper>
  );
}
