import { formatGroupCode } from "./format.js";

function personKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/['’`]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function text(value) {
  return String(value ?? "").trim();
}

function flag(value) {
  if (value === true || value === 1) return 1;
  if (value === false || value === 0) return 0;
  return /^(yes|y|true|x|1)$/i.test(text(value)) ? 1 : 0;
}

function guestFields(guest) {
  const firstName = text(guest.firstName || guest.first_name);
  const lastName = text(guest.lastName || guest.last_name);
  return {
    siteId: text(guest.siteId || guest.site_id || guest.id),
    row: Number(guest.row) || 0,
    party: text(guest.party),
    groupCode: formatGroupCode(guest.groupCode || guest.group_code || guest.accessCode),
    firstName,
    lastName,
    firstKey: personKey(firstName),
    lastKey: personKey(lastName),
    phone: text(guest.phone),
    email: text(guest.email),
    street: text(guest.street || guest.street1),
    apt: text(guest.apt || guest.street2),
    city: text(guest.city),
    region: text(guest.region || guest.state),
    postal: text(guest.postal || guest.zip),
    jersey: flag(guest.jersey ?? guest.inviteJersey),
    como: flag(guest.como ?? guest.inviteComo),
    shower: flag(guest.shower ?? guest.inviteShower),
    rsvpJersey: text(guest.rsvpJersey || guest.rsvp_jersey),
    rsvpComo: text(guest.rsvpComo || guest.rsvp_como),
    rsvpShower: text(guest.rsvpShower || guest.rsvp_shower),
  };
}

function nameKey(groupCode, firstKey, lastKey) {
  return `${groupCode}|${firstKey}|${lastKey}`;
}

export function syncAuthorized(request, env) {
  const expected = String(env.SYNC_SECRET || "");
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!expected || token.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function pushSheetGuests(env, guests, { replace = false, keepSiteContact = false } = {}) {
  const incoming = (Array.isArray(guests) ? guests : []).map(guestFields).filter((guest) => guest.firstKey || guest.lastKey);
  if (replace && !incoming.length) {
    const error = new Error("Refusing to replace the guest list with an empty sheet.");
    error.status = 400;
    throw error;
  }

  const existing = await env.DB.prepare(
    "SELECT public_id, group_code, first_key, last_key, touch FROM guests",
  ).all();
  const byId = new Map();
  const byName = new Map();
  for (const row of existing.results || []) {
    byId.set(row.public_id, row);
    const key = nameKey(row.group_code, row.first_key, row.last_key);
    byName.set(key, byName.has(key) ? "" : row.public_id);
  }

  const now = new Date().toISOString();
  const kept = new Set();
  const ids = [];
  const statements = [];

  for (const guest of incoming) {
    let id = guest.siteId;
    const known = id && byId.has(id);
    if (!known) {
      const match = byName.get(nameKey(guest.groupCode, guest.firstKey, guest.lastKey));
      if (match) id = match;
      else if (!id) id = crypto.randomUUID();
    }
    kept.add(id);
    ids.push({ siteId: id, row: guest.row });
    const preserveContact = keepSiteContact && byId.get(id)?.touch === "site" ? 1 : 0;
    statements.push(
      env.DB.prepare(
        `INSERT INTO guests (
          public_id, sort_order, party, group_code, first_name, last_name, first_key, last_key,
          phone, email, street, apt, city, region, postal,
          invite_jersey, invite_como, invite_shower,
          rsvp_jersey, rsvp_como, rsvp_shower, updated_at, touch
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sheet')
        ON CONFLICT(public_id) DO UPDATE SET
          sort_order = excluded.sort_order,
          party = excluded.party,
          group_code = excluded.group_code,
          first_name = excluded.first_name,
          last_name = excluded.last_name,
          first_key = excluded.first_key,
          last_key = excluded.last_key,
          invite_jersey = excluded.invite_jersey,
          invite_como = excluded.invite_como,
          invite_shower = excluded.invite_shower,
          phone = CASE WHEN ? = 1 THEN guests.phone ELSE excluded.phone END,
          email = CASE WHEN ? = 1 THEN guests.email ELSE excluded.email END,
          street = CASE WHEN ? = 1 THEN guests.street ELSE excluded.street END,
          apt = CASE WHEN ? = 1 THEN guests.apt ELSE excluded.apt END,
          city = CASE WHEN ? = 1 THEN guests.city ELSE excluded.city END,
          region = CASE WHEN ? = 1 THEN guests.region ELSE excluded.region END,
          postal = CASE WHEN ? = 1 THEN guests.postal ELSE excluded.postal END,
          rsvp_jersey = CASE WHEN ? = 1 THEN guests.rsvp_jersey ELSE excluded.rsvp_jersey END,
          rsvp_como = CASE WHEN ? = 1 THEN guests.rsvp_como ELSE excluded.rsvp_como END,
          rsvp_shower = CASE WHEN ? = 1 THEN guests.rsvp_shower ELSE excluded.rsvp_shower END,
          updated_at = CASE WHEN ? = 1 THEN guests.updated_at ELSE excluded.updated_at END,
          touch = CASE WHEN ? = 1 THEN guests.touch ELSE 'sheet' END`,
      ).bind(
        id,
        guest.row,
        guest.party,
        guest.groupCode,
        guest.firstName,
        guest.lastName,
        guest.firstKey,
        guest.lastKey,
        guest.phone,
        guest.email,
        guest.street,
        guest.apt,
        guest.city,
        guest.region,
        guest.postal,
        guest.jersey,
        guest.como,
        guest.shower,
        guest.rsvpJersey,
        guest.rsvpComo,
        guest.rsvpShower,
        now,
        preserveContact,
        preserveContact,
        preserveContact,
        preserveContact,
        preserveContact,
        preserveContact,
        preserveContact,
        preserveContact,
        preserveContact,
        preserveContact,
        preserveContact,
        preserveContact,
      ),
    );
  }

  let removed = 0;
  if (replace) {
    for (const id of byId.keys()) {
      if (kept.has(id)) continue;
      removed += 1;
      statements.push(env.DB.prepare("DELETE FROM guests WHERE public_id = ?").bind(id));
    }
  }

  if (statements.length) await env.DB.batch(statements);
  return { ok: true, count: kept.size, removed, ids };
}

export async function pullSiteContacts(env, since) {
  const cutoff = text(since);
  const rows = await env.DB.prepare(
    `SELECT public_id, group_code, first_name, last_name, phone, email, street, apt, city, region, postal,
            rsvp_jersey, rsvp_como, rsvp_shower, updated_at
     FROM guests
     WHERE touch = 'site' AND updated_at > ?
     ORDER BY updated_at`,
  ).bind(cutoff).all();

  return {
    ok: true,
    now: new Date().toISOString(),
    guests: (rows.results || []).map((row) => ({
      id: row.public_id,
      groupCode: row.group_code || "",
      firstName: row.first_name || "",
      lastName: row.last_name || "",
      phone: row.phone || "",
      email: row.email || "",
      street: row.street || "",
      apt: row.apt || "",
      city: row.city || "",
      region: row.region || "",
      postal: row.postal || "",
      rsvpJersey: row.rsvp_jersey || "",
      rsvpComo: row.rsvp_como || "",
      rsvpShower: row.rsvp_shower || "",
    })),
  };
}

export async function markSheetMirrored(env, ids) {
  const unique = [...new Set((ids || []).map((id) => text(id)).filter(Boolean))];
  if (!unique.length) return;
  const placeholders = unique.map(() => "?").join(", ");
  await env.DB.prepare(
    `UPDATE guests SET touch = 'sheet' WHERE touch = 'site' AND public_id IN (${placeholders})`,
  ).bind(...unique).run();
}
