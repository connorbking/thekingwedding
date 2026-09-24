import { formatGuest, formatGroupCode } from "./format.js";
import { markSheetMirrored } from "./sync.js";

export const GUEST_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1VyFole7kJOnJjGnI07sDxjmlgYa2HUtrk9mxH46o7gE/edit?gid=338671760#gid=338671760";

const RSVP_COLUMN = {
  jersey: "rsvp_jersey",
  como: "rsvp_como",
  shower: "rsvp_shower",
};

export function sheetConfigured(env) {
  return Boolean(env.DB);
}

export function normalizePersonName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/['’`]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function groupCode(row) {
  return formatGroupCode(row.group_code || row.access_code);
}

function hasName(row) {
  return Boolean(String(row.first_name || row.firstName || "").trim() || String(row.last_name || row.lastName || "").trim());
}

function invitedToEvent(row, key) {
  if (row?.invite && typeof row.invite[key] === "boolean") return row.invite[key];
  if (Array.isArray(row?.events)) return row.events.includes(key);
  if (key === "jersey") return Boolean(row?.jersey);
  if (key === "como") return Boolean(row?.como);
  if (key === "shower") return Boolean(row?.shower);
  return false;
}

function partyRecord(party, event = "") {
  if (!party.length) return { found: false };

  const members = party.filter(hasName);
  const events = ["shower", "como", "jersey"].filter((key) => members.some((row) => invitedToEvent(row, key)));
  if (event && !events.includes(event)) {
    return { found: false };
  }

  const code =
    groupCode(party.find((row) => groupCode(row))) ||
    formatGroupCode(party.find((row) => row.party)?.party) ||
    formatGroupCode(`${party[0].last_name || party[0].lastName || ""}-${party[0].first_name || party[0].firstName || ""}`);

  return {
    found: true,
    code,
    greeting: party.find((row) => row.party)?.party || "",
    maxParty: Math.max(members.length, 1),
    events,
    guests: members,
  };
}

function guestFromRow(row) {
  const events = ["jersey", "como", "shower"].filter((key) => Number(row[`invite_${key}`]));
  const rsvp = {
    jersey: row.rsvp_jersey || "",
    como: row.rsvp_como || "",
    shower: row.rsvp_shower || "",
  };
  return formatGuest({
    id: row.public_id,
    party: row.party || "",
    access_code: row.group_code || "",
    group_code: row.group_code || "",
    first_name: row.first_name || "",
    last_name: row.last_name || "",
    phone: row.phone || "",
    email: row.email || "",
    street: row.street || "",
    apt: row.apt || "",
    city: row.city || "",
    region: row.region || "",
    postal: row.postal || "",
    events,
    event: events[0] || "",
    jersey: events.includes("jersey"),
    como: events.includes("como"),
    shower: events.includes("shower"),
    invite: {
      jersey: events.includes("jersey"),
      como: events.includes("como"),
      shower: events.includes("shower"),
    },
    rsvp,
    rsvp_jersey: rsvp.jersey,
    rsvp_como: rsvp.como,
    rsvp_shower: rsvp.shower,
  });
}

async function guestsByCode(env, code) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM guests WHERE group_code = ? ORDER BY sort_order, rowid",
  ).bind(code).all();
  return (results || []).map(guestFromRow);
}

export async function listGuests(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM guests ORDER BY sort_order, rowid",
  ).all();
  return { submissions: (results || []).map(guestFromRow) };
}

export async function deleteGuest(env, id) {
  const result = await env.DB.prepare("DELETE FROM guests WHERE public_id = ?").bind(id).run();
  return { ok: (result.meta?.changes || 0) > 0 };
}

export async function lookupInvite(env, code, event = "") {
  const wanted = formatGroupCode(code);
  if (!wanted || !env.DB) return { found: false };
  return partyRecord(await guestsByCode(env, wanted), event);
}

export async function lookupInviteByName(env, firstName, lastName, event = "") {
  const first = normalizePersonName(firstName);
  const last = normalizePersonName(lastName);
  if (!first || !last || !env.DB) return { found: false };

  const { results } = await env.DB.prepare(
    "SELECT group_code FROM guests WHERE first_key = ? AND last_key = ?",
  ).bind(first, last).all();
  const codes = [...new Set((results || []).map((row) => formatGroupCode(row.group_code)).filter(Boolean))];
  if (!codes.length) return { found: false };
  if (codes.length !== 1) return { found: true, ambiguous: true, byName: true };

  return { ...partyRecord(await guestsByCode(env, codes[0]), event), byName: true };
}

function text(value) {
  return String(value || "").trim();
}

function hasAddress(guest) {
  return Boolean(text(guest.street || guest.street1) || text(guest.city) || text(guest.region || guest.state) || text(guest.postal || guest.zip));
}

export async function appendGuest(env, submission) {
  const guests = Array.isArray(submission.guests) && submission.guests.length
    ? submission.guests
    : [submission];
  const code = formatGroupCode(submission.accessCode || submission.groupCode || submission.code || "");
  const isRsvp = submission.kind === "rsvp";
  const event = text(submission.event).toLowerCase();
  const rsvpColumn = RSVP_COLUMN[event];
  let updated = 0;
  const mirrored = [];

  for (const guest of guests) {
    const id = text(guest.id);
    const first = normalizePersonName(guest.firstName || guest.first_name);
    const last = normalizePersonName(guest.lastName || guest.last_name);
    const row = id
      ? await env.DB.prepare(
        "SELECT public_id, group_code, first_key, last_key FROM guests WHERE public_id = ?",
      ).bind(id).first()
      : await env.DB.prepare(
        "SELECT public_id, group_code, first_key, last_key FROM guests WHERE group_code = ? AND first_key = ? AND last_key = ?",
      ).bind(code, first, last).first();

    if (!row || (code && row.group_code !== code) || row.first_key !== first || row.last_key !== last) {
      const error = new Error("Names on this invitation cannot be changed.");
      error.status = 400;
      throw error;
    }

    const sets = [];
    const values = [];
    const phone = text(guest.phone);
    const email = text(guest.email);
    if (phone) {
      sets.push("phone = ?");
      values.push(phone);
    }
    if (email) {
      sets.push("email = ?");
      values.push(email);
    }
    if (!isRsvp && hasAddress(guest)) {
      sets.push("street = ?", "apt = ?", "city = ?", "region = ?", "postal = ?");
      values.push(
        text(guest.street || guest.street1),
        text(guest.apt || guest.street2),
        text(guest.city),
        text(guest.region || guest.state),
        text(guest.postal || guest.zip),
      );
    }
    if (isRsvp && rsvpColumn && text(guest.rsvp)) {
      sets.push(`${rsvpColumn} = ?`);
      values.push(text(guest.rsvp));
    }
    if (!sets.length) {
      updated += 1;
      continue;
    }
    sets.push("touch = ?", "updated_at = ?");
    values.push("site", new Date().toISOString());
    values.push(row.public_id);
    const result = await env.DB.prepare(
      `UPDATE guests SET ${sets.join(", ")} WHERE public_id = ?`,
    ).bind(...values).run();
    updated += result.meta?.changes || 0;
    mirrored.push({
      id: row.public_id,
      firstName: text(guest.firstName || guest.first_name),
      lastName: text(guest.lastName || guest.last_name),
      phone,
      email,
      street: text(guest.street || guest.street1),
      apt: text(guest.apt || guest.street2),
      city: text(guest.city),
      region: text(guest.region || guest.state),
      postal: text(guest.postal || guest.zip),
      rsvp: text(guest.rsvp),
    });
  }

  if (!updated) {
    const error = new Error("We could not match that guest on the list, so the address was not saved.");
    error.status = 502;
    throw error;
  }
  return { ok: true, updated: true, guests: mirrored };
}

export async function mirrorGuestsToSheet(env, submission, guests) {
  const url = env.GOOGLE_SHEETS_WEBAPP_URL;
  if (!url || !guests?.length) return;
  try {
    const response = await fetch(url, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "contact",
        kind: submission.kind || "",
        event: submission.event || "",
        accessCode: submission.accessCode || "",
        guests,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false || body.error) return;
    await markSheetMirrored(env, guests.map((guest) => guest.id));
  } catch {
    console.error("sheet mirror failed");
  }
}
