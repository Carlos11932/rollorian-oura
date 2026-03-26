"use client"
import { useTransition, useState } from "react"
import { triggerManualSync } from "@/features/oura/server/actions"

export function SyncNowButton() {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ status: "success" | "error"; message: string } | null>(null)

  function handleSync() {
    setFeedback(null)
    startTransition(async () => {
      try {
        const result = await triggerManualSync()
        setFeedback({
          status: result.status === "error" ? "error" : "success",
          message:
            result.status === "error"
              ? `Sync failed: ${result.errors.map((e) => e.message).join(", ")}`
              : `Synced — ${result.recordsInserted} inserted, ${result.recordsUpdated} updated`,
        })
      } catch (err) {
        setFeedback({
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        })
      }
    })
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={handleSync}
        disabled={isPending}
        className="flex h-9 items-center justify-center rounded-full border border-solid border-black/[.08] px-4 text-sm font-medium transition-colors hover:border-transparent hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
      >
        {isPending ? "Syncing…" : "Sync Now"}
      </button>
      {feedback && (
        <p
          className={`text-xs ${feedback.status === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
        >
          {feedback.message}
        </p>
      )}
    </div>
  )
}
