import type { SubmitTestPayload } from "@/actions/test-actions";

/**
 * Offline write queue.
 *
 * Sessions and test results captured without a connection are parked in
 * localStorage and replayed when the browser comes back online. Only writes go
 * through here — reads fall back to whatever the service worker cached.
 *
 * Every function takes the storage explicitly so the logic is testable outside
 * a browser.
 */

export const QUEUE_KEY = "pz.queue.v1";
/** Hard cap: a queue longer than this means something is wrong, not a busy week. */
export const QUEUE_LIMIT = 200;

export type QueuedSession = {
  id: string;
  kind: "session";
  createdAt: string;
  payload: {
    date: string;
    sessionType: string;
    durationMinutes: number;
    position?: string | null;
    rpe?: number | null;
    notes?: string | null;
  };
};

export type QueuedTest = {
  id: string;
  kind: "test";
  createdAt: string;
  payload: SubmitTestPayload;
};

export type QueuedItem = QueuedSession | QueuedTest;

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Private mode or blocked storage: queueing is simply unavailable.
    return null;
  }
}

export function readQueue(storage: StorageLike | null = defaultStorage()): QueuedItem[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Drop anything that does not look like a queued item rather than throwing
    // away the whole queue on one corrupt entry.
    return parsed.filter(
      (item): item is QueuedItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as QueuedItem).id === "string" &&
        ((item as QueuedItem).kind === "session" || (item as QueuedItem).kind === "test"),
    );
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedItem[], storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or unavailable: nothing sensible to do client-side.
  }
}

export function enqueue(
  item: Omit<QueuedSession, "id" | "createdAt"> | Omit<QueuedTest, "id" | "createdAt">,
  storage: StorageLike | null = defaultStorage(),
): QueuedItem | null {
  if (!storage) return null;
  const current = readQueue(storage);
  if (current.length >= QUEUE_LIMIT) return null;
  const entry = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
  } as QueuedItem;
  writeQueue([...current, entry], storage);
  return entry;
}

export function removeFromQueue(
  id: string,
  storage: StorageLike | null = defaultStorage(),
): void {
  const remaining = readQueue(storage).filter((item) => item.id !== id);
  writeQueue(remaining, storage);
}

export function clearQueue(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(QUEUE_KEY);
  } catch {
    // ignored
  }
}

export function queueSize(storage: StorageLike | null = defaultStorage()): number {
  return readQueue(storage).length;
}

/** True when the browser is known to be offline. Absent API means assume online. */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * A failed fetch from a server action looks like a TypeError. Anything else is
 * a real server rejection and must not be silently queued.
 */
export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error && /fetch|network|load failed/i.test(error.message))
  );
}
