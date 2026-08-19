"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createSessionAction } from "@/actions/session-actions";
import { submitTestResultAction } from "@/actions/test-actions";
import {
  isNetworkError,
  isOffline,
  queueSize,
  readQueue,
  removeFromQueue,
  type QueuedItem,
} from "@/lib/offline/queue";

/** Forms dispatch this after queueing so the indicator updates immediately. */
export const QUEUE_CHANGED_EVENT = "pz:queue-changed";

export function notifyQueueChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
  }
}

async function send(item: QueuedItem): Promise<{ ok: boolean; message: string }> {
  if (item.kind === "session") {
    const formData = new FormData();
    formData.set("date", item.payload.date);
    formData.set("sessionType", item.payload.sessionType);
    formData.set("durationMinutes", String(item.payload.durationMinutes));
    if (item.payload.position) formData.set("position", item.payload.position);
    if (item.payload.rpe) formData.set("rpe", String(item.payload.rpe));
    if (item.payload.notes) formData.set("notes", item.payload.notes);
    return createSessionAction(null, formData);
  }
  return submitTestResultAction(item.payload);
}

/**
 * Registers the service worker and replays the offline queue.
 *
 * Draining is sequential and stops at the first network failure, so a flaky
 * connection retries rather than losing entries. An entry the server rejects on
 * its merits is dropped and reported — keeping it would block everything behind
 * it forever.
 */
export function OfflineSync() {
  const router = useRouter();
  // Guards against overlapping drains: a mount and an `online` event can fire
  // within the same tick, and sending one entry twice would duplicate it.
  const flushing = useRef(false);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [rejected, setRejected] = useState(0);

  const flush = useCallback(async () => {
    if (flushing.current || isOffline()) return;
    const items = readQueue();
    if (items.length === 0) return;

    flushing.current = true;
    setSyncing(true);
    let sent = 0;
    let dropped = 0;
    try {
      for (const item of items) {
        try {
          const result = await send(item);
          removeFromQueue(item.id);
          if (result.ok) sent += 1;
          else dropped += 1;
        } catch (error) {
          // Still offline: leave this entry and everything after it queued.
          if (isNetworkError(error)) break;
          removeFromQueue(item.id);
          dropped += 1;
        }
      }
    } finally {
      flushing.current = false;
      setSyncing(false);
      setPending(queueSize());
    }
    setRejected((current) => current + dropped);
    if (sent > 0) router.refresh();
  }, [router]);

  useEffect(() => {
    setOnline(!isOffline());
    setPending(queueSize());

    const onOnline = () => {
      setOnline(true);
      void flush();
    };
    const onOffline = () => setOnline(false);
    const onQueueChanged = () => setPending(queueSize());

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);
    void flush();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);
    };
  }, [flush]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failures are not fatal: the app still works online.
    });
  }, []);

  if (online && pending === 0 && rejected === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[64px] z-50 flex justify-center px-4 md:bottom-4">
      <p
        role="status"
        className={`rounded-full border px-4 py-2 text-xs font-medium shadow-lg ${
          online
            ? "border-signal/40 bg-ink-850 text-signal"
            : "border-caution/40 bg-ink-850 text-caution"
        }`}
      >
        {!online
          ? pending > 0
            ? `Offline — ${pending} entr${pending > 1 ? "ies" : "y"} saved on this device`
            : "Offline — recording still works"
          : syncing
            ? "Syncing…"
            : pending > 0
              ? `${pending} entr${pending > 1 ? "ies" : "y"} waiting to sync`
              : `${rejected} entr${rejected > 1 ? "ies were" : "y was"} rejected by the server`}
      </p>
    </div>
  );
}
