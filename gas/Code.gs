/**
 * Guest list for https://theking.wedding
 *
 * Open this spreadsheet → Extensions → Apps Script → paste this file → Save.
 * Deploy → New deployment → Type: Web app
 *   Execute as: Me
 *   Who has access: Anyone
 * Copy the web app URL, then:
 *   npx wrangler pages secret put GOOGLE_SHEETS_WEBAPP_URL --project-name=thekingwedding
 */
const SPREADSHEET_ID = "1VyFole7kJOnJjGnI07sDxjmlgYa2HUtrk9mxH46o7gE";
const SHEET_GID = 338671760;

const HEADERS = [
  "Party",
  "Group Code",
  "Last Name",
  "First Name",
  "Phone",
  "Email",
  "Street Address 1",
  "Street Address 2",
  "City",
  "State/Province",
  "Zip/Postal Code",
  "Invite Whippany",
  "Invite Como",
  "Invite Bridal",
  "RSVP Whippany",
  "RSVP Como",
  "RSVP Bridal",
];

const RSVP_CHOICES = ["Yes", "No"];

const ALIASES = {
  party: "party",
  "group code": "group code",
  code: "group code",
  "invite code": "group code",
  "access code": "group code",
  "last name": "last name",
  last: "last name",
  "first name": "first name",
  first: "first name",
  phone: "phone",
  email: "email",
  "street address 1": "street address 1",
  street: "street address 1",
  address: "street address 1",
  "street address 2": "street address 2",
  apt: "street address 2",
  city: "city",
  "state/province": "state/province",
  "state/region": "state/province",
  state: "state/province",
  "zip/postal code": "zip/postal code",
  postal: "zip/postal code",
  zip: "zip/postal code",
  "invite whippany": "invite whippany",
  "wedding whippany": "invite whippany",
  "invite como": "invite como",
  "como wedding": "invite como",
  "invite bridal": "invite bridal",
  "invite bridal shower": "invite bridal",
  "bridal shower": "invite bridal",
  "rsvp whippany": "rsvp whippany",
  "rsvp jersey": "rsvp whippany",
  "rsvp como": "rsvp como",
  "rsvp bridal": "rsvp bridal",
  "rsvp bridal shower": "rsvp bridal",
};

function sheet_(options) {
  const opts = options || {};
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const byId = ss.getSheets().filter(function (tab) {
    return tab.getSheetId() === SHEET_GID;
  })[0];
  const sheet = byId || ss.getSheets()[0];
  ensureHeaders_(sheet);
  if (!opts.readOnly) {
    try {
      ensureRsvpValidation_(sheet);
    } catch (error) {
      // Listing guests should still work if dropdowns cannot be applied.
    }
  }
  return sheet;
}

function ensureHeaders_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), HEADERS.length);
  const existing = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const blank = existing.every(function (cell) {
    return String(cell || "").trim() === "";
  });
  if (blank) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    return;
  }

  const hasGroupCode = existing.some(function (name) {
    return normalizeHeader_(name) === "group code";
  });
  if (hasGroupCode) return;

  let insertAt = existing.length + 1;
  existing.forEach(function (name, index) {
    if (normalizeHeader_(name) === "party") insertAt = index + 2;
  });
  sheet.insertColumnAfter(insertAt - 1);
  sheet.getRange(1, insertAt).setValue("Group Code");
}

function ensureRsvpValidation_(sheet) {
  const info = headerIndex_(sheet);
  const lastRow = Math.max(sheet.getMaxRows(), 2);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(RSVP_CHOICES, true)
    .setAllowInvalid(false)
    .setHelpText("Yes or No")
    .build();
  ["rsvp whippany", "rsvp como", "rsvp bridal"].forEach(function (name) {
    const index = info.map[name];
    if (index === undefined) return;
    sheet.getRange(2, index + 1, lastRow - 1).setDataValidation(rule);
  });
}

function normalizeHeader_(name) {
  const key = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return ALIASES[key] || key;
}

function headerIndex_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const existing = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const map = {};
  existing.forEach(function (name, index) {
    const key = normalizeHeader_(name);
    if (key && map[key] === undefined) map[key] = index;
  });
  return { map: map, width: existing.length, headers: existing };
}

function extrasList_(data) {
  if (!data.additionalGuests) return [];
  if (typeof data.additionalGuests === "string") return [];
  return data.additionalGuests
    .map(function (guest) {
      return {
        firstName: String((guest && guest.firstName) || (guest && guest.first_name) || "").trim(),
        lastName: String((guest && guest.lastName) || (guest && guest.last_name) || "").trim(),
      };
    })
    .filter(function (guest) {
      return guest.firstName || guest.lastName;
    });
}

function partyName_(data, existing) {
  const explicit = String(data.party || data.greeting || "").trim();
  if (explicit) return explicit;
  if (existing) return existing;
  return String(data.lastName || data.last_name || "").trim();
}

function isYes_(value) {
  return /^(yes|y|true|x|1|✓|✔)$/i.test(String(value || "").trim());
}

function normalizeRsvp_(value) {
  const key = String(value || "").trim().toLowerCase();
  if (/^(yes|y|true|1)$/.test(key)) return "Yes";
  if (/^(no|n|false|0)$/.test(key)) return "No";
  return "";
}

function eventFlags_(event) {
  const key = String(event || "").toLowerCase();
  return {
    jersey: key === "jersey" || key === "whippany",
    como: key === "como",
    shower: key === "shower" || key === "bridal",
  };
}

function eventsFromRow_(get) {
  const events = [];
  if (isYes_(get("invite whippany"))) events.push("jersey");
  if (isYes_(get("invite como"))) events.push("como");
  if (isYes_(get("invite bridal"))) events.push("shower");
  return events;
}

function rsvpFromRow_(get) {
  return {
    jersey: normalizeRsvp_(get("rsvp whippany")),
    como: normalizeRsvp_(get("rsvp como")),
    shower: normalizeRsvp_(get("rsvp bridal")),
  };
}

function asText_(value) {
  if (value === null || value === undefined || value === "") return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "M/d/yyyy");
  }
  if (typeof value === "number") {
    if (!isFinite(value)) return "";
    if (Math.round(value) === value) return String(Math.round(value));
    return String(value);
  }
  let text = String(value).trim();
  if (/e[+\-]?\d+$/i.test(text)) {
    const number = Number(text);
    if (isFinite(number) && Math.round(number) === number) return String(Math.round(number));
  }
  if (/^-?\d+\.0+$/.test(text)) return text.replace(/\.0+$/, "");
  return text;
}

function formatPhone_(value) {
  const raw = asText_(value);
  if (!raw) return "";
  const plus = raw.charAt(0) === "+";
  let digits = raw.replace(/\D/g, "");
  if (plus && digits && digits.charAt(0) !== "1") return "+" + digits;
  if (digits.length === 11 && digits.charAt(0) === "1") digits = digits.substring(1);
  if (digits.length === 10) {
    return "(" + digits.substring(0, 3) + ") " + digits.substring(3, 6) + "-" + digits.substring(6);
  }
  return raw;
}

function formatPostal_(value) {
  const raw = asText_(value);
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 4) digits = "0" + digits;
  if (digits.length === 9) return digits.substring(0, 5) + "-" + digits.substring(5);
  if (digits.length === 5) return digits;
  return raw;
}

function formatCode_(value) {
  const raw = asText_(value);
  if (!raw) return "";
  return /^\d+$/.test(raw) ? raw : raw.toUpperCase();
}

function cell_(row, map, name) {
  const index = map[name];
  return index === undefined ? "" : asText_(row[index]);
}

function setCell_(row, map, name, value) {
  if (map[name] === undefined) return;
  row[map[name]] = value;
}

function fillGuest_(row, map, data, options) {
  const opts = options || {};
  const first = data.firstName || data.first_name || "";
  const last = data.lastName || data.last_name || "";
  const phone = data.phone || "";
  const email = data.email || "";
  const street = data.street || data.street1 || "";
  const apt = data.apt || data.street2 || "";
  const city = data.city || "";
  const region = data.region || data.state || "";
  const postal = data.postal || data.zip || "";
  const party = String(data.party || "").trim();
  const groupCode = String(data.groupCode || data.accessCode || data.code || "")
    .trim()
    .toUpperCase();

  if (first) setCell_(row, map, "first name", first);
  if (last) setCell_(row, map, "last name", last);
  if (opts.contact) {
    if (phone) setCell_(row, map, "phone", phone);
    if (email) setCell_(row, map, "email", email);
  }
  if (street) setCell_(row, map, "street address 1", street);
  if (apt) setCell_(row, map, "street address 2", apt);
  if (city) setCell_(row, map, "city", city);
  if (region) setCell_(row, map, "state/province", region);
  if (postal) setCell_(row, map, "zip/postal code", postal);
  if (party && !String(cell_(row, map, "party") || "").trim()) {
    setCell_(row, map, "party", party);
  }
  if (groupCode && !String(cell_(row, map, "group code") || "").trim()) {
    setCell_(row, map, "group code", groupCode);
  }

  const rsvp = normalizeRsvp_(data.rsvp);
  const flags = eventFlags_(data.event);
  if (rsvp) {
    if (flags.jersey) setCell_(row, map, "rsvp whippany", rsvp);
    if (flags.como) setCell_(row, map, "rsvp como", rsvp);
    if (flags.shower) setCell_(row, map, "rsvp bridal", rsvp);
  }
}

function sameText_(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function findRow_(values, map, data, options) {
  const opts = options || {};
  const email = data.email || "";
  const first = data.firstName || data.first_name || "";
  const last = data.lastName || data.last_name || "";

  if (email && !opts.nameOnly) {
    for (let i = 0; i < values.length; i += 1) {
      if (sameText_(cell_(values[i], map, "email"), email)) {
        const rowFirst = cell_(values[i], map, "first name");
        const rowLast = cell_(values[i], map, "last name");
        if ((!first && !last) || (sameText_(rowFirst, first) && sameText_(rowLast, last))) {
          return i;
        }
      }
    }
    for (let i = 0; i < values.length; i += 1) {
      if (sameText_(cell_(values[i], map, "email"), email)) return i;
    }
  }

  if (first && last) {
    for (let i = 0; i < values.length; i += 1) {
      if (
        sameText_(cell_(values[i], map, "first name"), first) &&
        sameText_(cell_(values[i], map, "last name"), last)
      ) {
        return i;
      }
    }
  }

  if (opts.party && first && !last) {
    for (let i = 0; i < values.length; i += 1) {
      if (
        sameText_(cell_(values[i], map, "party"), opts.party) &&
        sameText_(cell_(values[i], map, "first name"), first)
      ) {
        return i;
      }
    }
  }

  return -1;
}

function writeRow_(sheet, values, map, width, index, data, options) {
  if (index === -1) {
    const row = new Array(width).fill("");
    fillGuest_(row, map, data, options);
    sheet.appendRow(row);
    values.push(row);
    return values.length - 1;
  }
  fillGuest_(values[index], map, data, options);
  sheet.getRange(index + 2, 1, 1, width).setValues([values[index]]);
  return index;
}

function rowId_(first, last, email, index) {
  return [first, last, email, index].join("|");
}

function parseId_(id) {
  const parts = String(id || "").split("|");
  return {
    first: parts[0] || "",
    last: parts[1] || "",
    email: parts[2] || "",
    index: Number(parts[3]),
  };
}

function list_(sheet) {
  const info = headerIndex_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, info.width).getValues();
  const guests = values
    .map(function (row, index) {
      function get(name) {
        return cell_(row, info.map, name);
      }
      const first = asText_(get("first name"));
      const last = asText_(get("last name"));
      const email = asText_(get("email"));
      const party = asText_(get("party"));
      const groupCode = formatCode_(get("group code"));
      if (!first && !last && !email && !party && !groupCode) return null;
      const events = eventsFromRow_(get);
      const rsvp = rsvpFromRow_(get);
      return {
        id: rowId_(first, last, email, index),
        party: party,
        access_code: groupCode,
        group_code: groupCode,
        first_name: first,
        last_name: last,
        phone: formatPhone_(get("phone")),
        email: email,
        street: asText_(get("street address 1")),
        apt: asText_(get("street address 2")),
        city: asText_(get("city")),
        region: asText_(get("state/province")),
        postal: formatPostal_(get("zip/postal code")),
        events: events,
        event: events[0] || "",
        jersey: events.indexOf("jersey") !== -1,
        como: events.indexOf("como") !== -1,
        shower: events.indexOf("shower") !== -1,
        invite: {
          jersey: events.indexOf("jersey") !== -1,
          como: events.indexOf("como") !== -1,
          shower: events.indexOf("shower") !== -1,
        },
        rsvp: rsvp,
        rsvp_jersey: rsvp.jersey,
        rsvp_como: rsvp.como,
        rsvp_shower: rsvp.shower,
      };
    })
    .filter(Boolean);

  return fillDownGroupCodes_(guests);
}

function fillDownGroupCodes_(guests) {
  let code = "";
  return guests.map(function (row) {
    const current = String(row.group_code || row.access_code || "").trim().toUpperCase();
    const named = String(row.first_name || "").trim() || String(row.last_name || "").trim();
    if (current) {
      code = current;
    } else if (code && named) {
      row.group_code = code;
      row.access_code = code;
    }
    return row;
  });
}

function upsert_(sheet, data) {
  const info = headerIndex_(sheet);
  const lastRow = sheet.getLastRow();
  const values =
    lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, info.width).getValues();
  const match = findRow_(values, info.map, data);
  const existingParty = match === -1 ? "" : String(cell_(values[match], info.map, "party") || "").trim();
  const party = partyName_(data, existingParty);
  const existingCode =
    match === -1 ? "" : String(cell_(values[match], info.map, "group code") || "").trim();
  const groupCode = String(data.groupCode || data.accessCode || data.code || existingCode)
    .trim()
    .toUpperCase();
  const household = {
    event: data.event,
    party: party,
    groupCode: groupCode,
    rsvp: data.rsvp || "",
    street: data.street || data.street1 || "",
    apt: data.apt || data.street2 || "",
    city: data.city || "",
    region: data.region || data.state || "",
    postal: data.postal || data.zip || "",
  };

  const primaryIndex = writeRow_(
    sheet,
    values,
    info.map,
    info.width,
    match,
    Object.assign({}, data, household),
    { contact: true }
  );

  extrasList_(data).forEach(function (guest) {
    const extraMatch = findRow_(values, info.map, guest, { nameOnly: true, party: party });
    writeRow_(
      sheet,
      values,
      info.map,
      info.width,
      extraMatch,
      Object.assign({}, household, guest),
      { contact: false }
    );
  });

  return { ok: true, updated: primaryIndex !== -1 && match !== -1, party: party };
}

function deleteById_(sheet, id) {
  const parsed = parseId_(id);
  const info = headerIndex_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  const values = sheet.getRange(2, 1, lastRow - 1, info.width).getValues();

  let match = -1;
  if (Number.isInteger(parsed.index) && values[parsed.index]) {
    const row = values[parsed.index];
    if (
      sameText_(cell_(row, info.map, "first name"), parsed.first) &&
      sameText_(cell_(row, info.map, "last name"), parsed.last) &&
      sameText_(cell_(row, info.map, "email"), parsed.email)
    ) {
      match = parsed.index;
    }
  }

  if (match === -1) {
    match = findRow_(values, info.map, {
      firstName: parsed.first,
      lastName: parsed.last,
      email: parsed.email,
    });
  }

  if (match === -1) return false;
  sheet.deleteRow(match + 2);
  return true;
}

function json_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function parse_(e) {
  if (e && e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }
  return (e && e.parameter) || {};
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = parse_(e);
    const sheet = sheet_();
    if (data.action === "delete") {
      return json_({ ok: deleteById_(sheet, data.id) });
    }
    if (data.action === "list") {
      return json_({ submissions: list_(sheet) });
    }
    if (data.action === "party" || (data.guests && data.guests.length)) {
      return json_(updateParty_(sheet, data));
    }
    return json_(upsert_(sheet, data));
  } finally {
    lock.releaseLock();
  }
}

function copyInvites_(fromRow, toRow, map) {
  ["invite whippany", "invite como", "invite bridal"].forEach(function (name) {
    if (map[name] === undefined) return;
    if (String(cell_(toRow, map, name) || "").trim()) return;
    setCell_(toRow, map, name, cell_(fromRow, map, name));
  });
}

function groupCodesFor_(values, map) {
  let code = "";
  return values.map(function (row) {
    const current = formatCode_(cell_(row, map, "group code"));
    if (current) code = current;
    return code;
  });
}

function findInGroup_(values, map, codes, groupCode, guest) {
  if (guest && guest.id) {
    const parsed = parseId_(guest.id);
    if (Number.isInteger(parsed.index) && values[parsed.index] && codes[parsed.index] === groupCode) {
      return parsed.index;
    }
  }

  const first = guest.firstName || guest.first_name || "";
  const last = guest.lastName || guest.last_name || "";
  if (!first || !last) return -1;

  for (let i = 0; i < values.length; i += 1) {
    if (
      codes[i] === groupCode &&
      sameText_(cell_(values[i], map, "first name"), first) &&
      sameText_(cell_(values[i], map, "last name"), last)
    ) {
      return i;
    }
  }
  return -1;
}

function updateParty_(sheet, data) {
  const info = headerIndex_(sheet);
  const lastRow = sheet.getLastRow();
  const values =
    lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, info.width).getValues();
  const codes = groupCodesFor_(values, info.map);
  const groupCode = formatCode_(data.groupCode || data.accessCode || data.code);
  if (!groupCode) return { ok: false, error: "Missing group code." };

  let template = null;
  let existingParty = "";
  for (let i = 0; i < values.length; i += 1) {
    if (codes[i] !== groupCode) continue;
    if (!template) template = values[i];
    if (!existingParty) existingParty = String(cell_(values[i], info.map, "party") || "").trim();
  }

  const party = partyName_(data, existingParty);
  const household = {
    event: data.event,
    party: party,
    groupCode: groupCode,
    street: data.street || data.street1 || "",
    apt: data.apt || data.street2 || "",
    city: data.city || "",
    region: data.region || data.state || "",
    postal: data.postal || data.zip || "",
  };

  (data.guests || []).forEach(function (guest) {
    const index = findInGroup_(values, info.map, codes, groupCode, guest);
    const next = Object.assign({}, household, guest, {
      firstName: guest.firstName || guest.first_name || "",
      lastName: guest.lastName || guest.last_name || "",
      phone: guest.phone || "",
      email: guest.email || "",
      rsvp: guest.rsvp || "",
    });
    if (index === -1 && template) {
      const row = new Array(info.width).fill("");
      fillGuest_(row, info.map, next, { contact: true });
      copyInvites_(template, row, info.map);
      sheet.appendRow(row);
      values.push(row);
      codes.push(groupCode);
    } else {
      writeRow_(sheet, values, info.map, info.width, index, next, { contact: true });
      if (index !== -1) codes[index] = groupCode;
    }
  });

  return { ok: true, party: party, groupCode: groupCode };
}

function lookupInvite_(sheet, code, event) {
  const wanted = String(code || "").trim().toUpperCase();
  if (!wanted) return { found: false };

  const guests = list_(sheet).filter(function (row) {
    return row.group_code === wanted;
  });
  if (!guests.length) return { found: false };

  const events = [];
  guests.forEach(function (row) {
    (row.events || []).forEach(function (key) {
      if (events.indexOf(key) === -1) events.push(key);
    });
  });
  const party = guests
    .map(function (row) {
      return row.party;
    })
    .filter(Boolean)[0] || "";

  return {
    found: true,
    code: wanted,
    greeting: party,
    maxParty: Math.min(12, Math.max(guests.length + 4, 2)),
    events: events,
    guests: guests,
  };
}

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action;
    const sheet = sheet_({ readOnly: true });
    if (action === "list") {
      return json_({ submissions: list_(sheet) });
    }
    if (action === "invite") {
      return json_(lookupInvite_(sheet, params.code, String(params.event || "").toLowerCase()));
    }
    return json_({ ok: true, service: "theking.wedding" });
  } catch (error) {
    return json_({ error: String(error && error.message ? error.message : error), submissions: [] });
  }
}
