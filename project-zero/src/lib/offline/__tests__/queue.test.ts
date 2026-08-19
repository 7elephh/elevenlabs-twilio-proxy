import { beforeEach, describe, expect, it } from "vitest";

import {
  QUEUE_KEY,
  QUEUE_LIMIT,
  clearQueue,
  enqueue,
  isNetworkError,
  queueSize,
  readQueue,
  removeFromQueue,
  type StorageLike,
} from "../queue";

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

const session = {
  kind: "session" as const,
  payload: { date: "2026-08-19", sessionType: "INDIVIDUAL", durationMinutes: 45 },
};

let storage: StorageLike;

beforeEach(() => {
  storage = memoryStorage();
});

describe("queue basics", () => {
  it("starts empty", () => {
    expect(readQueue(storage)).toEqual([]);
    expect(queueSize(storage)).toBe(0);
  });

  it("keeps insertion order", () => {
    enqueue({ ...session, payload: { ...session.payload, durationMinutes: 45 } }, storage);
    enqueue({ ...session, payload: { ...session.payload, durationMinutes: 60 } }, storage);
    expect(readQueue(storage).map((i) => (i as { payload: { durationMinutes: number } }).payload.durationMinutes)).toEqual([45, 60]);
  });

  it("stamps each entry with a unique id and a timestamp", () => {
    const a = enqueue(session, storage);
    const b = enqueue(session, storage);
    expect(a?.id).not.toBe(b?.id);
    expect(Date.parse(a!.createdAt)).not.toBeNaN();
  });

  it("removes a single entry by id", () => {
    const a = enqueue(session, storage);
    enqueue(session, storage);
    removeFromQueue(a!.id, storage);
    expect(queueSize(storage)).toBe(1);
    expect(readQueue(storage).find((i) => i.id === a!.id)).toBeUndefined();
  });

  it("ignores removal of an unknown id", () => {
    enqueue(session, storage);
    removeFromQueue("does-not-exist", storage);
    expect(queueSize(storage)).toBe(1);
  });

  it("clears everything", () => {
    enqueue(session, storage);
    clearQueue(storage);
    expect(queueSize(storage)).toBe(0);
  });
});

describe("queue resilience", () => {
  it("survives corrupt JSON instead of throwing", () => {
    const broken = memoryStorage({ [QUEUE_KEY]: "{not json" });
    expect(readQueue(broken)).toEqual([]);
  });

  it("survives a non-array payload", () => {
    const broken = memoryStorage({ [QUEUE_KEY]: '{"a":1}' });
    expect(readQueue(broken)).toEqual([]);
  });

  it("drops malformed entries but keeps valid ones", () => {
    const mixed = memoryStorage({
      [QUEUE_KEY]: JSON.stringify([
        { id: "ok", kind: "session", createdAt: "2026-01-01", payload: {} },
        { nope: true },
        { id: "bad-kind", kind: "banana" },
      ]),
    });
    expect(readQueue(mixed).map((i) => i.id)).toEqual(["ok"]);
  });

  it("is a no-op without storage, rather than crashing", () => {
    expect(readQueue(null)).toEqual([]);
    expect(enqueue(session, null)).toBeNull();
    expect(queueSize(null)).toBe(0);
  });

  it("refuses to grow past the limit", () => {
    for (let i = 0; i < QUEUE_LIMIT; i += 1) enqueue(session, storage);
    expect(enqueue(session, storage)).toBeNull();
    expect(queueSize(storage)).toBe(QUEUE_LIMIT);
  });
});

describe("isNetworkError", () => {
  it("treats a failed fetch as a network error", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("NetworkError when attempting to fetch"))).toBe(true);
  });

  it("does not treat a server rejection as a network error", () => {
    expect(isNetworkError(new Error("Value cannot exceed 20."))).toBe(false);
    expect(isNetworkError("nope")).toBe(false);
  });
});
