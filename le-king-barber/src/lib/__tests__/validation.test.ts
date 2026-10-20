import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "../crypto";
import { hashToken, manageTokenFor } from "../tokens";
import { bookingRequestSchema, formatPhoneDisplay, normalizePhone } from "../validation";
import { formatDuration, formatPrice } from "../time";

describe("normalizePhone", () => {
  it.each([
    ["06 12 34 56 78", "+33612345678"],
    ["06.12.34.56.78", "+33612345678"],
    ["+33 6 12 34 56 78", "+33612345678"],
    ["0033612345678", "+33612345678"],
    ["+32 470 12 34 56", "+32470123456"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["123", "abcdefghij", "+33012345678", "06 12 34"])("refuse %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("formate pour l'affichage", () => {
    expect(formatPhoneDisplay("+33612345678")).toBe("06 12 34 56 78");
  });
});

describe("bookingRequestSchema", () => {
  const valid = {
    serviceId: "8a1c6c5e-6a43-4c51-9a2f-2f6b1d1f4e10",
    startsAt: "2026-11-03T08:00:00.000Z",
    firstName: "Jean-Émile",
    lastName: "D'Arc",
    phone: "06 12 34 56 78",
    email: "Jean@Example.com",
    note: "",
    privacyAccepted: true,
    website: "",
  };

  it("accepte et normalise une demande valide", () => {
    const r = bookingRequestSchema.parse(valid);
    expect(r.phone).toBe("+33612345678");
    expect(r.email).toBe("jean@example.com");
    expect(r.note).toBeNull();
  });

  it("l'email est facultatif", () => {
    expect(bookingRequestSchema.parse({ ...valid, email: "" }).email).toBeNull();
  });

  it("refuse le champ piège rempli (robots)", () => {
    expect(bookingRequestSchema.safeParse({ ...valid, website: "spam" }).success).toBe(false);
  });

  it("exige l'information RGPD", () => {
    expect(bookingRequestSchema.safeParse({ ...valid, privacyAccepted: false }).success).toBe(false);
  });

  it("refuse les noms avec balises", () => {
    expect(bookingRequestSchema.safeParse({ ...valid, firstName: "<script>" }).success).toBe(false);
  });
});

describe("jetons et chiffrement", () => {
  it("le jeton de gestion est reproductible, propre à chaque rendez-vous et au secret", () => {
    const secret = "s".repeat(32);
    const a = manageTokenFor("booking-a", secret);
    expect(manageTokenFor("booking-a", secret)).toBe(a);
    expect(manageTokenFor("booking-b", secret)).not.toBe(a);
    expect(manageTokenFor("booking-a", "t".repeat(32))).not.toBe(a);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(() => manageTokenFor("x", "court")).toThrow();
  });

  it("chiffre et déchiffre un secret, et détecte une altération", () => {
    const key = randomBytes(32).toString("base64");
    const enc = encryptSecret("refresh-token", key);
    expect(enc).not.toContain("refresh-token");
    expect(decryptSecret(enc, key)).toBe("refresh-token");
    const tampered = enc.slice(0, -2) + (enc.endsWith("A") ? "BB" : "AA");
    expect(() => decryptSecret(tampered, key)).toThrow();
  });
});

describe("formats", () => {
  it("prix et durées", () => {
    expect(formatPrice(2000).replace(/\s/g, " ")).toBe("20 €");
    expect(formatPrice(2550).replace(/\s/g, " ")).toBe("25,50 €");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(90)).toBe("1 h 30");
  });
});
