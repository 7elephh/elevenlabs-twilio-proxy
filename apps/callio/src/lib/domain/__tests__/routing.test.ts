import { describe, expect, it } from "vitest";

import { decideTransfer, isInServiceArea, isWithinBusinessHours } from "../routing";
import type { AgentSettings } from "../types";

function settings(over: Partial<AgentSettings> = {}): AgentSettings {
  return {
    companyId: "c1",
    enabled: true,
    agentDisplayName: "Agent",
    services: [],
    serviceAreaPostalCodes: [],
    // Lundi (1) au vendredi (5), 9h-18h. Samedi et dimanche non declares.
    businessHours: [1, 2, 3, 4, 5].map((weekday) => ({
      weekday,
      opensAt: "09:00",
      closesAt: "18:00",
      closed: false,
    })),
    transferPhone: "+33499000000",
    transferOnUrgency: ["critical"],
    transferOutsideHours: true,
    qualificationQuestions: [],
    updatedAt: "2026-03-01T00:00:00Z",
    ...over,
  };
}

// Les dates sont construites en heure locale : isWithinBusinessHours raisonne
// sur l'heure locale du serveur, comme les horaires saisis par l'entreprise.
const MONDAY_10H = new Date(2026, 2, 2, 10, 0);
const MONDAY_20H = new Date(2026, 2, 2, 20, 0);
const SUNDAY_10H = new Date(2026, 2, 1, 10, 0);

describe("isWithinBusinessHours", () => {
  it("accepte un instant dans la plage declaree", () => {
    expect(isWithinBusinessHours(settings(), MONDAY_10H)).toBe(true);
  });

  it("refuse un instant apres la fermeture", () => {
    expect(isWithinBusinessHours(settings(), MONDAY_20H)).toBe(false);
  });

  it("considere ferme un jour non declare", () => {
    expect(isWithinBusinessHours(settings(), SUNDAY_10H)).toBe(false);
  });

  it("respecte un jour explicitement marque ferme", () => {
    const s = settings({
      businessHours: [{ weekday: 1, opensAt: "09:00", closesAt: "18:00", closed: true }],
    });
    expect(isWithinBusinessHours(s, MONDAY_10H)).toBe(false);
  });

  it("considere ferme un horaire invalide plutot que d'ouvrir par defaut", () => {
    const s = settings({
      businessHours: [{ weekday: 1, opensAt: "25:00", closesAt: "18:00", closed: false }],
    });
    expect(isWithinBusinessHours(s, MONDAY_10H)).toBe(false);
  });

  it("considere ferme une plage dont la fin precede le debut", () => {
    const s = settings({
      businessHours: [{ weekday: 1, opensAt: "18:00", closesAt: "09:00", closed: false }],
    });
    expect(isWithinBusinessHours(s, MONDAY_10H)).toBe(false);
  });

  it("exclut la minute de fermeture", () => {
    const s = settings({
      businessHours: [{ weekday: 1, opensAt: "09:00", closesAt: "18:00", closed: false }],
    });
    expect(isWithinBusinessHours(s, new Date(2026, 2, 2, 18, 0))).toBe(false);
    expect(isWithinBusinessHours(s, new Date(2026, 2, 2, 17, 59))).toBe(true);
  });
});

describe("isInServiceArea", () => {
  it("accepte tout quand aucune zone n'est declaree", () => {
    expect(isInServiceArea(settings(), null)).toBe(true);
    expect(isInServiceArea(settings(), "75001")).toBe(true);
  });

  it("filtre sur les codes postaux declares", () => {
    const s = settings({ serviceAreaPostalCodes: ["34000", "34070"] });
    expect(isInServiceArea(s, "34000")).toBe(true);
    expect(isInServiceArea(s, "75001")).toBe(false);
  });

  it("refuse un code postal absent quand une zone est declaree", () => {
    const s = settings({ serviceAreaPostalCodes: ["34000"] });
    expect(isInServiceArea(s, null)).toBe(false);
  });
});

describe("decideTransfer", () => {
  it("ne transfere rien quand l'agent est desactive", () => {
    const d = decideTransfer(settings({ enabled: false }), {
      urgency: "critical",
      postalCode: null,
      at: MONDAY_10H,
    });
    expect(d).toEqual({ transfer: false, reason: "agent_disabled" });
  });

  it("transfere sur une urgence declaree", () => {
    const d = decideTransfer(settings(), {
      urgency: "critical",
      postalCode: null,
      at: MONDAY_10H,
    });
    expect(d.transfer).toBe(true);
    expect(d.transfer && d.reason).toBe("urgency");
    expect(d.transfer && d.toPhone).toBe("+33499000000");
  });

  it("ne transfere pas une urgence non listee pendant les horaires", () => {
    const d = decideTransfer(settings(), {
      urgency: "high",
      postalCode: null,
      at: MONDAY_10H,
    });
    expect(d).toEqual({ transfer: false, reason: "not_required" });
  });

  it("transfere hors zone d'intervention", () => {
    const s = settings({ serviceAreaPostalCodes: ["34000"] });
    const d = decideTransfer(s, { urgency: "normal", postalCode: "75001", at: MONDAY_10H });
    expect(d.transfer && d.reason).toBe("out_of_service_area");
  });

  it("transfere hors horaires quand la regle est active", () => {
    const d = decideTransfer(settings(), {
      urgency: "normal",
      postalCode: null,
      at: MONDAY_20H,
    });
    expect(d.transfer && d.reason).toBe("outside_hours");
  });

  it("ne transfere pas hors horaires quand la regle est desactivee", () => {
    const d = decideTransfer(settings({ transferOutsideHours: false }), {
      urgency: "normal",
      postalCode: null,
      at: MONDAY_20H,
    });
    expect(d).toEqual({ transfer: false, reason: "not_required" });
  });

  it("signale la regle meme sans numero configure, avec toPhone a null", () => {
    const d = decideTransfer(settings({ transferPhone: null }), {
      urgency: "critical",
      postalCode: null,
      at: MONDAY_10H,
    });
    expect(d.transfer).toBe(true);
    expect(d.transfer && d.toPhone).toBeNull();
  });

  it("donne la priorite a l'urgence sur les autres regles", () => {
    const s = settings({ serviceAreaPostalCodes: ["34000"] });
    const d = decideTransfer(s, {
      urgency: "critical",
      postalCode: "75001",
      at: MONDAY_20H,
    });
    expect(d.transfer && d.reason).toBe("urgency");
  });
});
