import { formatGuest, formatGroupCode } from "./format.js";

export const GUEST_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1VyFole7kJOnJjGnI07sDxjmlgYa2HUtrk9mxH46o7gE/edit?gid=338671760#gid=338671760";

function webAppUrl(env) {
  return String(env.GOOGLE_SHEETS_WEBAPP_URL || "").trim();
}

async function callSheet(env, { method = "POST", action, body }) {
  const url = webAppUrl(env);
  if (!url) {
    const error = new Error("The Google Sheet connection is not set yet.");
    error.status = 503;
    throw error;
  }

  const target = new URL(url);
  if (method === "GET" && action) target.searchParams.set("action", action);
  if (method === "GET" && body) {
    Object.entries(body).forEach(([key, value]) => {
      if (value != null && value !== "") target.searchParams.set(key, String(value));
    });
  }

  let response;
  try {
    response = await fetch(target.toString(), {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
      headers: method === "GET" ? {} : { "Content-Type": "text/plain;charset=utf-8" },
      body: method === "GET" ? undefined : JSON.stringify({ action, ...body }),
    });
  } catch {
    const error = new Error("The guest list took too long to respond. Please try again.");
    error.status = 504;
    throw error;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const error = new Error(data.error || "The Google Sheet did not accept that request.");
    error.status = response.ok ? 502 : response.status;
    throw error;
  }
  return data;
}

export function sheetConfigured(env) {
  return Boolean(webAppUrl(env));
}

export async function appendGuest(env, submission) {
  const guests = Array.isArray(submission.guests) ? submission.guests : [];
  const extras = guests.length > 1 ? guests.slice(1) : submission.extras || [];
  const isRsvp = submission.kind === "rsvp";
  return callSheet(env, {
    method: "POST",
    body: {
      action: isRsvp && guests.length ? "party" : "upsert",
      kind: submission.kind || (isRsvp ? "rsvp" : "address"),
      event: submission.event,
      rsvp: submission.rsvp,
      party: submission.party,
      greeting: submission.party,
      firstName: submission.firstName,
      lastName: submission.lastName,
      phone: submission.phone,
      email: submission.email,
      street: submission.street,
      apt: submission.apt,
      city: submission.city,
      region: submission.region,
      postal: submission.postal,
      country: submission.country,
      accessCode: submission.accessCode,
      groupCode: submission.accessCode,
      additionalGuests: extras,
      guests: isRsvp ? guests : undefined,
    },
  });
}

function groupCode(row) {
  return formatGroupCode(row.group_code || row.access_code);
}

function hasName(row) {
  return Boolean(String(row.first_name || row.firstName || "").trim() || String(row.last_name || row.lastName || "").trim());
}

function fillDownParty(rows) {
  const list = rows.map((row, index) => ({ ...row, _sheetIndex: index }));
  let code = "";
  let party = "";

  for (const row of list) {
    const currentParty = String(row.party || "").trim().toLowerCase();
    const currentCode = groupCode(row);
    if (currentParty && party && currentParty !== party && !currentCode) {
      code = "";
    }
    if (currentParty) party = currentParty;
    if (currentCode) {
      code = currentCode;
    } else if (code && hasName(row)) {
      row.access_code = code;
      row.group_code = code;
    }
  }

  return list;
}

export async function listGuests(env) {
  const data = await callSheet(env, { method: "GET", action: "list" });
  return {
    ...data,
    submissions: fillDownParty(data.submissions || []).map(formatGuest),
  };
}

export async function deleteGuest(env, id) {
  return callSheet(env, { method: "POST", action: "delete", body: { id } });
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

function namesMatch(row, first, last) {
  return (
    normalizePersonName(row.first_name || row.firstName) === first &&
    normalizePersonName(row.last_name || row.lastName) === last
  );
}

function householdKey(row, index = 0) {
  const code = groupCode(row);
  if (code) return `code:${code}`;
  const party = String(row.party || "").trim().toLowerCase();
  if (party) return `party:${party}`;
  return `solo:${row._sheetIndex ?? index}`;
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
    maxParty: Math.min(12, Math.max(members.length + 4, 2)),
    events,
    guests: members,
  };
}

function partyFromGuests(guests, code, event = "") {
  const wanted = formatGroupCode(code);
  return partyRecord(
    guests.filter((row) => groupCode(row) === wanted && hasName(row)),
    event
  );
}

async function namedGuests(env) {
  const data = await callSheet(env, { method: "GET", action: "list" });
  return fillDownParty(data.submissions || []).map(formatGuest).filter(hasName);
}

export async function lookupInvite(env, code, event = "") {
  return partyFromGuests(await namedGuests(env), code, event);
}

export async function lookupInviteByName(env, firstName, lastName, event = "") {
  const first = normalizePersonName(firstName);
  const last = normalizePersonName(lastName);
  if (!first || !last) return { found: false };

  const guests = await namedGuests(env);
  const hits = guests.filter((row) => namesMatch(row, first, last));
  if (!hits.length) return { found: false };

  const keys = [...new Set(hits.map((row) => householdKey(row)))];
  if (keys.length !== 1) return { found: true, ambiguous: true };

  const key = keys[0];
  const party = guests.filter((row) => householdKey(row) === key);
  return partyRecord(party, event);
}
