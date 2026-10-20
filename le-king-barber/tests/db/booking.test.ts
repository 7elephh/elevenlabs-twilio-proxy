import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { asRole, createTestDb, type TestDb } from "./helpers";

let db: TestDb;
let client: Client;
let serviceId: string;

const SLOT = "date_trunc('hour', now()) + interval '3 days'";

async function book(
  c: Client,
  startsAtSql: string,
  opts: { phone?: string; source?: string; ip?: string | null; service?: string; first?: string } = {},
) {
  const res = await c.query(
    `select * from public.create_booking($1, ${startsAtSql}, $2, 'Test', $3, null, null, $4, null, $5)`,
    [opts.service ?? serviceId, opts.first ?? "Alex", opts.phone ?? "+33600000001", opts.source ?? "online", opts.ip ?? null],
  );
  return res.rows[0];
}

async function errorOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  return "no error";
}

beforeAll(async () => {
  db = await createTestDb();
  client = await db.connect();
});

afterAll(async () => {
  await client?.end();
  await db?.drop();
});

beforeEach(async () => {
  await client.query("truncate public.bookings, public.customers, public.blocked_periods, public.booking_attempts, public.services cascade");
  await client.query("update public.business_settings set max_active_bookings_per_customer = 2, min_notice_minutes = 60, booking_enabled = true");
  const res = await client.query(
    "insert into public.services (name, price_cents, duration_minutes, is_active) values ('Coupe + barbe', 2000, 45, true) returning id",
  );
  serviceId = res.rows[0].id;
});

describe("create_booking", () => {
  it("crée une réservation avec instantané de la prestation", async () => {
    const b = await book(client, SLOT);
    expect(b.status).toBe("confirmed");
    expect(b.service_name).toBe("Coupe + barbe");
    expect(b.price_cents).toBe(2000);
    const diff = (new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000;
    expect(diff).toBe(45);
  });

  it("refuse un créneau qui chevauche une réservation existante", async () => {
    await book(client, SLOT);
    const msg = await errorOf(book(client, `${SLOT} + interval '30 minutes'`, { phone: "+33600000002" }));
    expect(msg).toBe("slot_taken");
  });

  it("accepte un créneau qui commence exactement à la fin du précédent", async () => {
    await book(client, SLOT);
    const b = await book(client, `${SLOT} + interval '45 minutes'`, { phone: "+33600000002" });
    expect(b.status).toBe("confirmed");
  });

  it("libère le créneau quand la réservation est annulée", async () => {
    const first = await book(client, SLOT);
    await client.query("update public.bookings set status = 'cancelled', cancelled_at = now() where id = $1", [first.id]);
    const again = await book(client, SLOT, { phone: "+33600000002" });
    expect(again.status).toBe("confirmed");
  });

  it("n'accepte qu'une seule réservation en cas de requêtes simultanées", async () => {
    const clients = await Promise.all(Array.from({ length: 6 }, () => db.connect()));
    try {
      const results = await Promise.allSettled(
        clients.map((c, i) => book(c, SLOT, { phone: `+3361000000${i}` })),
      );
      const ok = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
      expect(ok).toHaveLength(1);
      expect(failed.every((f) => (f.reason as Error).message === "slot_taken")).toBe(true);
      const count = await client.query("select count(*)::int as n from public.bookings where status <> 'cancelled'");
      expect(count.rows[0].n).toBe(1);
    } finally {
      await Promise.all(clients.map((c) => c.end()));
    }
  });

  it("la contrainte d'exclusion protège aussi les insertions directes", async () => {
    await book(client, SLOT);
    const msg = await errorOf(
      client.query(
        `insert into public.bookings (service_name, price_cents, duration_minutes, starts_at, ends_at)
         values ('x', 0, 30, ${SLOT} + interval '10 minutes', ${SLOT} + interval '40 minutes')`,
      ),
    );
    expect(msg).toMatch(/bookings_no_overlap/);
  });

  it("refuse un créneau pendant une période bloquée (congés)", async () => {
    await client.query(
      `insert into public.blocked_periods (starts_at, ends_at, kind) values (${SLOT} - interval '1 day', ${SLOT} + interval '1 day', 'vacation')`,
    );
    expect(await errorOf(book(client, SLOT))).toBe("slot_unavailable");
    // Le salon peut toutefois forcer un rendez-vous manuel.
    const forced = await book(client, SLOT, { source: "admin" });
    expect(forced.source).toBe("admin");
  });

  it("refuse un créneau trop proche (délai de prévenance)", async () => {
    expect(await errorOf(book(client, "now() + interval '10 minutes'"))).toBe("slot_unavailable");
  });

  it("refuse une prestation inactive en ligne", async () => {
    await client.query("update public.services set is_active = false where id = $1", [serviceId]);
    expect(await errorOf(book(client, SLOT))).toBe("service_unavailable");
  });

  it("refuse les réservations quand la réservation en ligne est désactivée", async () => {
    await client.query("update public.business_settings set booking_enabled = false");
    expect(await errorOf(book(client, SLOT))).toBe("booking_disabled");
  });

  it("limite le nombre de rendez-vous actifs par client", async () => {
    await book(client, SLOT);
    await book(client, `${SLOT} + interval '1 day'`);
    expect(await errorOf(book(client, `${SLOT} + interval '2 days'`))).toBe("too_many_bookings");
  });

  it("limite le nombre de réservations par adresse IP et par heure", async () => {
    await client.query("update public.business_settings set max_active_bookings_per_customer = 20");
    for (let i = 0; i < 5; i++) {
      await book(client, `${SLOT} + interval '${i} hours'`, { ip: "iphash", phone: `+3362000000${i}` });
    }
    expect(await errorOf(book(client, `${SLOT} + interval '6 hours'`, { ip: "iphash", phone: "+33620000009" }))).toBe(
      "rate_limited",
    );
  });

  it("ne remplace pas l'identité d'un client existant depuis le site", async () => {
    await book(client, SLOT, { first: "Alex" });
    await book(client, `${SLOT} + interval '1 day'`, { first: "Usurpateur" });
    const c = await client.query("select first_name from public.customers");
    expect(c.rows).toEqual([{ first_name: "Alex" }]);
  });

  it("une réservation en ligne ne peut pas détourner l'email d'un client existant", async () => {
    // Client connu du salon, sans email (réservé par téléphone)
    const victim = await book(client, SLOT, { source: "admin" });
    // Un inconnu réserve en ligne avec le même numéro et son propre email
    const attacker = await client.query(
      `select * from public.create_booking($1, ${SLOT} + interval '1 day', 'X', 'Y', '+33600000001', 'pirate@example.com', null, 'online', null)`,
      [serviceId],
    );
    expect(attacker.rows[0].contact_email).toBe("pirate@example.com");
    const c = await client.query("select email from public.customers where id = $1", [victim.customer_id]);
    expect(c.rows[0].email).toBeNull();
    const v = await client.query("select contact_email from public.bookings where id = $1", [victim.id]);
    expect(v.rows[0].contact_email).toBeNull();
  });

  it("interdit d'activer une prestation sans durée", async () => {
    const msg = await errorOf(
      client.query("insert into public.services (name, price_cents, is_active) values ('Sans durée', 1000, true)"),
    );
    expect(msg).toMatch(/services_active_needs_duration/);
  });

  it("interdit des plages horaires qui se chevauchent le même jour", async () => {
    await client.query("insert into public.business_hours (weekday, opens_at, closes_at) values (2, '09:00', '12:00')");
    await client.query("insert into public.business_hours (weekday, opens_at, closes_at) values (2, '14:00', '19:00')");
    const msg = await errorOf(
      client.query("insert into public.business_hours (weekday, opens_at, closes_at) values (2, '11:00', '15:00')"),
    );
    expect(msg).toMatch(/business_hours_no_overlap/);
    await client.query("delete from public.business_hours");
  });
});

describe("sécurité (RLS)", () => {
  const adminId = "00000000-0000-0000-0000-0000000000a1";
  const userId = "00000000-0000-0000-0000-0000000000b2";

  beforeAll(async () => {
    await client.query("insert into auth.users (id, email) values ($1, 'admin@test'), ($2, 'user@test') on conflict do nothing", [
      adminId,
      userId,
    ]);
    await client.query("insert into public.admin_users (user_id) values ($1) on conflict do nothing", [adminId]);
  });

  it("le public lit les réglages et seulement les prestations actives", async () => {
    await client.query("insert into public.services (name, price_cents) values ('Brouillon', 1000)");
    await asRole(client, "anon", null, async () => {
      const s = await client.query("select salon_name from public.business_settings");
      expect(s.rows).toHaveLength(1);
      const services = await client.query("select name from public.services order by name");
      expect(services.rows.map((r) => r.name)).toEqual(["Coupe + barbe"]);
    });
  });

  it("le public ne voit ni les réservations, ni les clients, ni les intégrations", async () => {
    await book(client, SLOT);
    for (const role of ["anon", "authenticated"] as const) {
      await asRole(client, role, role === "authenticated" ? userId : null, async () => {
        for (const table of ["bookings", "customers", "blocked_periods", "calendar_integrations", "booking_attempts"]) {
          const r = await client.query(`select * from public.${table}`);
          expect(r.rows, `${role} ${table}`).toHaveLength(0);
        }
      });
    }
  });

  it("le public ne peut ni écrire une réservation ni appeler create_booking", async () => {
    await asRole(client, "anon", null, async () => {
      await client.query("savepoint s");
      const msg = await errorOf(
        client.query(
          `insert into public.bookings (service_name, price_cents, duration_minutes, starts_at, ends_at)
           values ('x', 0, 30, now() + interval '5 days', now() + interval '5 days 30 minutes')`,
        ),
      );
      expect(msg).toMatch(/row-level security/);
      await client.query("rollback to savepoint s");
      const rpc = await errorOf(client.query(`select public.create_booking($1, ${SLOT}, 'a','b','+33611111111',null,null,'online',null)`, [serviceId]));
      expect(rpc).toMatch(/permission denied/);
    });
  });

  it("un utilisateur connecté non administrateur ne peut pas modifier le site", async () => {
    await asRole(client, "authenticated", userId, async () => {
      const r = await client.query("update public.business_settings set salon_name = 'Piraté' returning id");
      expect(r.rows).toHaveLength(0);
    });
  });

  it("l'administrateur voit et gère les réservations", async () => {
    await book(client, SLOT);
    await asRole(client, "authenticated", adminId, async () => {
      const r = await client.query("select id from public.bookings");
      expect(r.rows).toHaveLength(1);
      const u = await client.query("update public.business_settings set hero_subtitle = 'ok' returning id");
      expect(u.rows).toHaveLength(1);
    });
  });
});

describe("RGPD", () => {
  it("anonymise un client et ses notes", async () => {
    const b = await book(client, SLOT);
    const adminId = "00000000-0000-0000-0000-0000000000a1";
    const userId = "00000000-0000-0000-0000-0000000000b2";
    await asRole(client, "authenticated", userId, async () => {
      expect(await errorOf(client.query("select public.anonymize_customer($1)", [b.customer_id]))).toBe("forbidden");
    });
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [adminId]);
    await client.query("select public.anonymize_customer($1)", [b.customer_id]);
    await client.query("commit");
    const c = await client.query("select first_name, phone, email, anonymized_at from public.customers");
    expect(c.rows[0].first_name).toBe("Client");
    expect(c.rows[0].phone).toMatch(/^anon-/);
    expect(c.rows[0].anonymized_at).not.toBeNull();
  });

  it("purge les clients inactifs au-delà de la durée de conservation", async () => {
    await client.query(
      `insert into public.customers (first_name, last_name, phone, created_at) values
       ('Ancien', 'Client', '+33699999999', now() - interval '5 years'),
       ('Récent', 'Client', '+33688888888', now())`,
    );
    const r = await client.query("select public.purge_expired_personal_data() as n");
    expect(r.rows[0].n).toBe(1);
    const left = await client.query("select first_name from public.customers where anonymized_at is null");
    expect(left.rows.map((x) => x.first_name)).toEqual(["Récent"]);
  });
});
