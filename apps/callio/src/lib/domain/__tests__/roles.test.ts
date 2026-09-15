import { describe, expect, it } from "vitest";

import { can, hasAtLeast, roleRank } from "../roles";
import { COMPANY_ROLES } from "../types";

describe("hierarchie des roles", () => {
  it("ordonne member < admin < owner", () => {
    expect(roleRank("member")).toBeLessThan(roleRank("admin"));
    expect(roleRank("admin")).toBeLessThan(roleRank("owner"));
  });

  it("chaque role se satisfait lui-meme", () => {
    for (const role of COMPANY_ROLES) {
      expect(hasAtLeast(role, role)).toBe(true);
    }
  });

  it("un member ne satisfait pas un minimum admin", () => {
    expect(hasAtLeast("member", "admin")).toBe(false);
    expect(hasAtLeast("admin", "owner")).toBe(false);
  });
});

describe("permissions", () => {
  it("laisse un member consulter sans le laisser configurer", () => {
    expect(can("member", "leads.read")).toBe(true);
    expect(can("member", "calls.read")).toBe(true);
    expect(can("member", "settings.read")).toBe(true);
    expect(can("member", "settings.write")).toBe(false);
    expect(can("member", "team.manage")).toBe(false);
  });

  it("laisse un admin configurer sans lui donner les droits du proprietaire", () => {
    expect(can("admin", "settings.write")).toBe(true);
    expect(can("admin", "team.manage")).toBe(true);
    expect(can("admin", "company.suspend")).toBe(false);
    expect(can("admin", "billing.manage")).toBe(false);
  });

  it("accorde tout au proprietaire", () => {
    expect(can("owner", "company.suspend")).toBe(true);
    expect(can("owner", "billing.manage")).toBe(true);
    expect(can("owner", "settings.write")).toBe(true);
  });
});
