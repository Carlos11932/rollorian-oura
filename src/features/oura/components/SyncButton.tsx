"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { triggerManualSync } from "@/features/oura/server/actions";

const SYNC_STATE = {
  IDLE: "idle",
  SYNCING: "syncing",
  DONE: "done",
  ERROR: "error",
} as const;

type SyncState = (typeof SYNC_STATE)[keyof typeof SYNC_STATE];

export function SyncButton() {
  const [state, setState] = useState<SyncState>(SYNC_STATE.IDLE);
  const [message, setMessage] = useState<string | null>(null);

  const stateLabel =
    state === SYNC_STATE.SYNCING
      ? "..."
      : state === SYNC_STATE.DONE
        ? "OK"
        : state === SYNC_STATE.ERROR
          ? "ERR"
          : "SYNC";

  async function handleSync() {
    if (state === SYNC_STATE.SYNCING) return;

    setState(SYNC_STATE.SYNCING);
    setMessage(null);

    const result = await triggerManualSync();

    if (result.success) {
      setState(SYNC_STATE.DONE);
      setMessage(null);
      setTimeout(() => setState(SYNC_STATE.IDLE), 3000);
    } else {
      setState(SYNC_STATE.ERROR);
      setMessage(result.message);
      setTimeout(() => {
        setState(SYNC_STATE.IDLE);
        setMessage(null);
      }, 5000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {message && (
        <span className="text-xs text-red-400">{message}</span>
      )}
      <button
        onClick={handleSync}
        disabled={state === SYNC_STATE.SYNCING}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
          "border",
          state === SYNC_STATE.IDLE &&
            "border-emerald-700 bg-emerald-900 text-emerald-300 hover:bg-emerald-800 hover:text-white",
          state === SYNC_STATE.SYNCING &&
            "cursor-not-allowed border-emerald-800 bg-emerald-950 text-emerald-500",
          state === SYNC_STATE.DONE &&
            "border-emerald-600 bg-emerald-800 text-emerald-200",
          state === SYNC_STATE.ERROR &&
            "border-red-800 bg-red-950 text-red-400",
        )}
      >
        <span className="font-mono text-[11px] leading-none">{stateLabel}</span>
        <span>
          {state === SYNC_STATE.SYNCING
            ? "Sincronizando..."
            : state === SYNC_STATE.DONE
              ? "Listo"
              : state === SYNC_STATE.ERROR
                ? "Error"
                : "Sincronizar"}
        </span>
      </button>
    </div>
  );
}
