import { describe, expect, it } from "vitest";

import { buildRecentActivity, computeDashboardMetrics, formatDelay } from "../metrics";
import type { Appointment, Call, Lead } from "../types";

const PERIOD = {
  from: new Date("2026-03-01T00:00:00Z"),
  to: new Date("2026-03-31T00:00:00Z"),
};

function lead(over: Partial<Lead>): Lead {
  return {
    id: "l1",
    companyId: "c1",
    fullName: "Test",
    phone: "+33600000000",
    email: null,
    postalCode: null,
    city: null,
    requestType: "installation_pac",
    source: "quote_form",
    status: "new",
    urgency: "normal",
    nextAction: null,
    nextActionAt: null,
    notes: null,
    createdAt: "2026-03-10T09:00:00Z",
    firstHandledAt: null,
    ...over,
  };
}

function call(over: Partial<Call>): Call {
  return {
    id: "k1",
    companyId: "c1",
    leadId: "l1",
    direction: "outbound",
    startedAt: "2026-03-10T09:05:00Z",
    durationSeconds: 120,
    outcome: "qualified",
    urgency: "normal",
    summary: null,
    providerCallId: null,
    ...over,
  };
}

function appointment(over: Partial<Appointment>): Appointment {
  return {
    id: "a1",
    companyId: "c1",
    leadId: "l1",
    service: "Installation PAC",
    assigneeMemberId: null,
    assigneeName: null,
    scheduledAt: "2026-03-12T10:00:00Z",
    durationMinutes: 60,
    status: "confirmed",
    externalEventId: null,
    ...over,
  };
}

describe("computeDashboardMetrics", () => {
  it("ne compte que ce qui tombe dans la periode", () => {
    const leads = [
      lead({ id: "in", createdAt: "2026-03-10T09:00:00Z" }),
      lead({ id: "before", createdAt: "2026-02-10T09:00:00Z" }),
      lead({ id: "after", createdAt: "2026-04-10T09:00:00Z" }),
    ];
    const m = computeDashboardMetrics(leads, [], [], PERIOD);
    expect(m.newLeads).toBe(1);
  });

  it("exclut les echecs techniques des appels traites", () => {
    const calls = [
      call({ id: "k1", outcome: "qualified" }),
      call({ id: "k2", outcome: "no_answer" }),
      call({ id: "k3", outcome: "failed" }),
    ];
    const m = computeDashboardMetrics([], calls, [], PERIOD);
    expect(m.handledCalls).toBe(2);
  });

  it("compte les transferts separement", () => {
    const calls = [
      call({ id: "k1", outcome: "transferred_to_human" }),
      call({ id: "k2", outcome: "qualified" }),
    ];
    const m = computeDashboardMetrics([], calls, [], PERIOD);
    expect(m.transferredCalls).toBe(1);
    expect(m.handledCalls).toBe(2);
  });

  it("compte un RDV pris comme prospect qualifie", () => {
    const leads = [
      lead({ id: "a", status: "qualified" }),
      lead({ id: "b", status: "appointment_set" }),
      lead({ id: "c", status: "new" }),
    ];
    const m = computeDashboardMetrics(leads, [], [], PERIOD);
    expect(m.qualifiedLeads).toBe(2);
  });

  it("ignore les rendez-vous annules", () => {
    const appts = [
      appointment({ id: "a1", status: "confirmed" }),
      appointment({ id: "a2", status: "cancelled" }),
    ];
    const m = computeDashboardMetrics([], [], appts, PERIOD);
    expect(m.appointmentsSet).toBe(1);
  });

  it("calcule le delai moyen de prise en charge", () => {
    const leads = [
      lead({
        id: "a",
        createdAt: "2026-03-10T09:00:00Z",
        firstHandledAt: "2026-03-10T09:10:00Z", // 10 min
      }),
      lead({
        id: "b",
        createdAt: "2026-03-11T09:00:00Z",
        firstHandledAt: "2026-03-11T09:30:00Z", // 30 min
      }),
    ];
    const m = computeDashboardMetrics(leads, [], [], PERIOD);
    expect(m.averageHandlingDelayMinutes).toBe(20);
    expect(m.handlingDelaySampleSize).toBe(2);
  });

  it("renvoie null plutot que zero quand rien n'a ete pris en charge", () => {
    const m = computeDashboardMetrics([lead({})], [], [], PERIOD);
    expect(m.averageHandlingDelayMinutes).toBeNull();
    expect(m.handlingDelaySampleSize).toBe(0);
  });

  it("ecarte une prise en charge anterieure a la creation", () => {
    const leads = [
      lead({
        id: "incoherent",
        createdAt: "2026-03-10T09:00:00Z",
        firstHandledAt: "2026-03-10T08:00:00Z",
      }),
      lead({
        id: "sain",
        createdAt: "2026-03-11T09:00:00Z",
        firstHandledAt: "2026-03-11T09:20:00Z",
      }),
    ];
    const m = computeDashboardMetrics(leads, [], [], PERIOD);
    expect(m.handlingDelaySampleSize).toBe(1);
    expect(m.averageHandlingDelayMinutes).toBe(20);
  });
});

describe("buildRecentActivity", () => {
  it("fusionne les trois natures et trie du plus recent au plus ancien", () => {
    const items = buildRecentActivity(
      [lead({ id: "l1", createdAt: "2026-03-01T10:00:00Z", fullName: "Alice" })],
      [call({ id: "k1", startedAt: "2026-03-03T10:00:00Z" })],
      [appointment({ id: "a1", scheduledAt: "2026-03-02T10:00:00Z" })],
    );
    expect(items.map((i) => i.kind)).toEqual(["call", "appointment", "lead"]);
  });

  it("respecte la limite demandee", () => {
    const leads = Array.from({ length: 20 }, (_, i) =>
      lead({ id: `l${i}`, createdAt: `2026-03-${String(i + 1).padStart(2, "0")}T10:00:00Z` }),
    );
    expect(buildRecentActivity(leads, [], [], 5)).toHaveLength(5);
  });

  it("resout le nom du prospect rattache a un appel", () => {
    const items = buildRecentActivity(
      [lead({ id: "l9", fullName: "Bernard Martin" })],
      [call({ id: "k1", leadId: "l9" })],
      [],
    );
    const callItem = items.find((i) => i.kind === "call");
    expect(callItem?.detail).toBe("Bernard Martin");
  });
});

describe("formatDelay", () => {
  it("rend un tiret pour une absence de mesure", () => {
    expect(formatDelay(null)).toBe("—");
  });

  it("met en forme minutes, heures et jours", () => {
    expect(formatDelay(0.5)).toBe("moins d'une minute");
    expect(formatDelay(42)).toBe("42 min");
    expect(formatDelay(120)).toBe("2 h");
    expect(formatDelay(150)).toBe("2 h 30");
    expect(formatDelay(1500)).toBe("1 j 1 h");
  });
});
