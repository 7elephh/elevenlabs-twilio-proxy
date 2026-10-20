import { describe, expect, it } from "vitest";

import { computeAvailability, isSlotAvailable, type AvailabilityInput } from "../availability";

const TZ = "Europe/Paris";

function base(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    timezone: TZ,
    now: new Date("2026-11-02T06:00:00Z"), // lundi 2 novembre 2026, 7h à Paris
    fromDate: "2026-11-03",
    toDate: "2026-11-03",
    durationMinutes: 45,
    slotIntervalMinutes: 15,
    bufferMinutes: 0,
    minNoticeMinutes: 60,
    maxAdvanceDays: 60,
    hours: [
      { weekday: 2, opensAt: "09:00", closesAt: "12:00" },
      { weekday: 2, opensAt: "14:00", closesAt: "16:00" },
    ],
    bookings: [],
    blocked: [],
    ...overrides,
  };
}

const labels = (input: AvailabilityInput) => computeAvailability(input)[0]?.slots.map((s) => s.label) ?? [];

describe("computeAvailability", () => {
  it("génère les créneaux dans les plages d'ouverture en respectant la pause", () => {
    const l = labels(base());
    expect(l[0]).toBe("09:00");
    expect(l).toContain("11:15"); // 11:15 + 45 min = 12:00 pile
    expect(l).not.toContain("11:30");
    expect(l).not.toContain("12:00");
    expect(l).not.toContain("13:45");
    expect(l).toContain("14:00");
    expect(l.at(-1)).toBe("15:15");
  });

  it("convertit correctement l'heure de Paris en UTC (heure d'hiver)", () => {
    const [day] = computeAvailability(base());
    expect(day.slots[0].start).toBe("2026-11-03T08:00:00.000Z");
  });

  it("marque les jours sans horaires comme fermés", () => {
    const [day] = computeAvailability(base({ fromDate: "2026-11-02", toDate: "2026-11-02" }));
    expect(day.isOpen).toBe(false);
    expect(day.slots).toEqual([]);
  });

  it("exclut les créneaux qui chevauchent un rendez-vous existant", () => {
    const l = labels(
      base({ bookings: [{ start: new Date("2026-11-03T09:00:00Z"), end: new Date("2026-11-03T09:45:00Z") }] }),
    );
    // Rendez-vous 10h00–10h45 heure locale
    expect(l).toContain("09:15"); // 9h15–10h00 : se termine pile au début
    expect(l).not.toContain("09:30");
    expect(l).not.toContain("10:00");
    expect(l).not.toContain("10:30");
    expect(l).toContain("10:45");
  });

  it("applique la marge entre rendez-vous", () => {
    const l = labels(
      base({
        bufferMinutes: 15,
        bookings: [{ start: new Date("2026-11-03T09:00:00Z"), end: new Date("2026-11-03T09:45:00Z") }],
      }),
    );
    expect(l).not.toContain("09:15");
    expect(l).toContain("09:00");
    expect(l).not.toContain("10:45");
    expect(l).toContain("11:00");
  });

  it("exclut les congés et périodes bloquées", () => {
    const [day] = computeAvailability(
      base({ blocked: [{ start: new Date("2026-11-02T23:00:00Z"), end: new Date("2026-11-03T23:00:00Z") }] }),
    );
    expect(day.isOpen).toBe(true);
    expect(day.slots).toEqual([]);
  });

  it("respecte le délai minimum de réservation", () => {
    const l = labels(base({ now: new Date("2026-11-03T08:20:00Z") })); // 9h20 à Paris
    expect(l[0]).toBe("10:30"); // 9h20 + 60 min = 10h20 → premier pas de 15 min suivant
  });

  it("ne propose rien au-delà de la fenêtre de réservation", () => {
    const days = computeAvailability(base({ maxAdvanceDays: 0 }));
    expect(days).toEqual([]);
  });

  it("ne propose rien dans le passé", () => {
    const days = computeAvailability(base({ fromDate: "2026-10-01", toDate: "2026-11-02" }));
    expect(days[0].date).toBe("2026-11-02");
  });

  it("prend en compte une modification d'horaires", () => {
    const l = labels(base({ hours: [{ weekday: 2, opensAt: "10:00", closesAt: "11:00" }] }));
    expect(l).toEqual(["10:00", "10:15"]);
  });

  it("gère le passage à l'heure d'hiver (25 octobre 2026)", () => {
    const [day] = computeAvailability(
      base({
        now: new Date("2026-10-20T06:00:00Z"),
        fromDate: "2026-10-25",
        toDate: "2026-10-25",
        hours: [{ weekday: 7, opensAt: "09:00", closesAt: "10:00" }],
      }),
    );
    expect(day.slots.map((s) => s.start)).toEqual(["2026-10-25T08:00:00.000Z", "2026-10-25T08:15:00.000Z"]);
  });

  it("gère le passage à l'heure d'été (29 mars 2026)", () => {
    const [day] = computeAvailability(
      base({
        now: new Date("2026-03-20T06:00:00Z"),
        fromDate: "2026-03-29",
        toDate: "2026-03-29",
        hours: [{ weekday: 7, opensAt: "09:00", closesAt: "10:00" }],
      }),
    );
    expect(day.slots[0].start).toBe("2026-03-29T07:00:00.000Z");
    expect(day.slots[0].label).toBe("09:00");
  });

  it("ignore les rendez-vous annulés (non transmis)", () => {
    expect(labels(base())).toContain("10:00");
  });
});

describe("isSlotAvailable", () => {
  it("valide un créneau libre et refuse un créneau occupé ou hors grille", () => {
    const input = base({ bookings: [{ start: new Date("2026-11-03T09:00:00Z"), end: new Date("2026-11-03T09:45:00Z") }] });
    expect(isSlotAvailable(input, "2026-11-03T08:00:00.000Z")).toBe(true);
    expect(isSlotAvailable(input, "2026-11-03T09:00:00.000Z")).toBe(false);
    expect(isSlotAvailable(input, "2026-11-03T08:07:00.000Z")).toBe(false);
    expect(isSlotAvailable(input, "pas une date")).toBe(false);
  });
});
