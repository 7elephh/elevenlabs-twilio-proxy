import { describe, expect, it } from "vitest";

import { formatPhone, maskPhone } from "../phone";

describe("maskPhone", () => {
  it("conserve un préfixe lisible et les deux derniers chiffres", () => {
    expect(maskPhone("+33612480091")).toBe("+33 6 •• •• •• 91");
  });

  it("accepte un numéro déjà mis en forme", () => {
    expect(maskPhone("+33 6 12 48 00 91")).toBe("+33 6 •• •• •• 91");
  });

  it("met en forme un numéro national", () => {
    expect(maskPhone("0612345678")).toBe("06 •• •• •• 78");
  });

  it("ne divulgue aucun chiffre du milieu", () => {
    const masked = maskPhone("0612345678");
    expect(masked).not.toContain("1234");
    expect(masked).not.toContain("345");
    expect(masked).not.toContain("56");
  });

  it("gère un indicatif étranger inconnu", () => {
    const masked = maskPhone("+15550100");
    expect(masked.startsWith("+15")).toBe(true);
    expect(masked.endsWith("00")).toBe(true);
    expect(masked).toContain("••");
  });

  it("rend une valeur neutre pour une entrée absente", () => {
    expect(maskPhone(null)).toBe("—");
    expect(maskPhone(undefined)).toBe("—");
    expect(maskPhone("")).toBe("—");
  });

  it("masque entièrement un numéro trop court", () => {
    expect(maskPhone("12")).toBe("••");
  });

  it("laisse toujours au moins un groupe masqué", () => {
    // Un numero court ne doit pas se retrouver integralement lisible.
    expect(maskPhone("0612")).toContain("••");
  });
});

describe("formatPhone", () => {
  it("met en forme un numéro français international", () => {
    expect(formatPhone("+33612345678")).toBe("+33 6 12 34 56 78");
  });

  it("met en forme un numéro national à dix chiffres", () => {
    expect(formatPhone("0612345678")).toBe("06 12 34 56 78");
  });

  it("rend la valeur telle quelle quand le format est inconnu", () => {
    expect(formatPhone("+1 555 0100")).toBe("+1 555 0100");
  });

  it("rend une valeur neutre pour une entrée absente", () => {
    expect(formatPhone(null)).toBe("—");
  });
});
