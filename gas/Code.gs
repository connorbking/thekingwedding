/**
 * Sheet sync for https://theking.wedding
 * The site reads and writes D1. This web app writes replies back to the sheet.
 *
 * Open this spreadsheet → Extensions → Apps Script → paste this file → Save.
 * After editing, Deploy → Manage deployments → New version
 * (or Deploy → New deployment the first time).
 * Deploy → New deployment → Type: Web app
 *   Execute as: Me
 *   Who has access: Anyone
 * Copy the web app URL, then:
 *   npx wrangler pages secret put GOOGLE_SHEETS_WEBAPP_URL --project-name=thekingwedding
 *
 * Sheet ↔ site database:
 * Project settings → Script properties → SYNC_SECRET (same value as the Pages secret).
 * Reload the sheet, then Guest list → Install automatic sync.
 * Edits in this sheet push to the site database. Replies saved on the site
 * are written back here. A Site ID column is added the first time this runs;
 * leave those values in place so renamed guests stay matched.
 */
const SPREADSHEET_ID = "1VyFole7kJOnJjGnI07sDxjmlgYa2HUtrk9mxH46o7gE";
const SHEET_GID = 338671760;
const SHEET_NAME = "SeedData";

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

const SYNC_URL = "https://theking.wedding/api/sync";

const ALIASES = {
  party: "party",
  "site id": "site id",
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
  "invite shower": "invite bridal",
  "rsvp whippany": "rsvp whippany",
  "rsvp jersey": "rsvp whippany",
  "rsvp como": "rsvp como",
  "rsvp bridal": "rsvp bridal",
  "rsvp bridal shower": "rsvp bridal",
};

function sheet_(options) {
  const opts = options || {};
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const named = ss.getSheetByName(SHEET_NAME);
  const byId = ss.getSheets().filter(function (tab) {
    return tab.getSheetId() === SHEET_GID;
  })[0];
  const sheet = named || byId || ss.getSheets()[0];
  ensureHeaders_(sheet);
  ensureSiteId_(sheet);
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

function ensureSiteId_(sheet) {
  const info = headerIndex_(sheet);
  if (info.map["site id"] !== undefined) return;
  const col = Math.max(sheet.getLastColumn(), 1) + 1;
  sheet.getRange(1, col).setValue("Site ID");
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
    const raw = String(name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    const key = ALIASES[raw] || raw;
    if (!key) return;
    if (map[key] === undefined || raw === key) {
      map[key] = index;
    }
  });
  return { map: map, width: existing.length, headers: existing };
}

function isYes_(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value === "0") return false;
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

function parseId_(id) {
  const parts = String(id || "").split("|");
  return {
    first: parts[0] || "",
    last: parts[1] || "",
    email: parts[2] || "",
    index: Number(parts[3]),
  };
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
  if (!lock.tryLock(10000)) {
    return json_({ error: "The guest list is busy. Please try again." });
  }
  try {
    const data = parse_(e);
    if (data.action !== "contact") return json_({ error: "Unknown request." });
    return json_(updateContacts_(sheet_(), data));
  } catch (error) {
    return json_({ error: error.message || "The guest list could not be updated." });
  } finally {
    lock.releaseLock();
  }
}

function hasAddress_(data) {
  const source = data || {};
  return Boolean(
    String(source.street || source.street1 || "").trim() ||
      String(source.city || "").trim() ||
      String(source.region || source.state || "").trim() ||
      String(source.postal || source.zip || "").trim()
  );
}

function groupCodesFor_(values, map) {
  let code = "";
  let party = "";
  return values.map(function (row) {
    const currentParty = String(cell_(row, map, "party") || "").trim().toLowerCase();
    const current = formatCode_(cell_(row, map, "group code"));
    const named = String(cell_(row, map, "first name") || "").trim() || String(cell_(row, map, "last name") || "").trim();
    if (currentParty && party && currentParty !== party && !current) code = "";
    if (currentParty) party = currentParty;
    if (current) code = current;
    if (current) return current;
    if (code && named) return code;
    return "";
  });
}

function findById_(values, map, guest) {
  if (!guest || !guest.id) return -1;
  const parsed = parseId_(guest.id);
  if (!Number.isInteger(parsed.index) || !values[parsed.index]) return -1;
  const row = values[parsed.index];
  if (
    parsed.first &&
    parsed.last &&
    sameText_(cell_(row, map, "first name"), parsed.first) &&
    sameText_(cell_(row, map, "last name"), parsed.last)
  ) {
    return parsed.index;
  }
  const first = guest.firstName || guest.first_name || "";
  const last = guest.lastName || guest.last_name || "";
  if (
    first &&
    last &&
    sameText_(cell_(row, map, "first name"), first) &&
    sameText_(cell_(row, map, "last name"), last)
  ) {
    return parsed.index;
  }
  return -1;
}

function findGuestRow_(values, map, codes, groupCode, guest) {
  const byId = findById_(values, map, guest);
  if (byId !== -1) return byId;

  const first = guest.firstName || guest.first_name || "";
  const last = guest.lastName || guest.last_name || "";
  const email = guest.email || "";
  if (groupCode && first && last) {
    for (let i = 0; i < values.length; i += 1) {
      if (
        codes[i] === groupCode &&
        sameText_(cell_(values[i], map, "first name"), first) &&
        sameText_(cell_(values[i], map, "last name"), last)
      ) {
        return i;
      }
    }
  }
  return findRow_(values, map, {
    firstName: first,
    lastName: last,
    email: email,
  });
}

function doGet() {
  return json_({ ok: true, service: "theking.wedding" });
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Guest list")
    .addItem("Push sheet to site", "pushSheetToD1")
    .addItem("Pull replies from site", "pullRepliesFromD1")
    .addItem("Install automatic sync", "installD1Sync")
    .addToUi();
}

function installD1Sync() {
  if (!syncSecret_()) {
    throw new Error("Add script property SYNC_SECRET first. Project settings, then Script properties.");
  }
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    const handler = trigger.getHandlerFunction();
    if (handler === "syncSheetEdit" || handler === "syncSheetChange" || handler === "pullRepliesFromD1") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger("syncSheetEdit").forSpreadsheet(SPREADSHEET_ID).onEdit().create();
  ScriptApp.newTrigger("syncSheetChange").forSpreadsheet(SPREADSHEET_ID).onChange().create();
  ScriptApp.newTrigger("pullRepliesFromD1").timeBased().everyMinutes(10).create();
  SpreadsheetApp.getActive().toast("Automatic sync is on.");
}

function syncSheetEdit(event) {
  if (isQuiet_()) return;
  const range = event && event.range;
  if (!range || !isGuestSheet_(range.getSheet())) return;
  if (range.getRow() === 1 && range.getNumRows() === 1) return;
  pushRows_(range.getSheet(), range.getRow(), range.getNumRows(), "sheet");
}

function syncSheetChange(event) {
  if (isQuiet_()) return;
  const type = String((event && event.changeType) || "");
  if (type !== "REMOVE_ROW" && type !== "INSERT_ROW") return;
  const sheet = event.source.getActiveSheet();
  if (!isGuestSheet_(sheet)) return;
  pushAll_("keep-site");
}

function pushSheetToD1() {
  const result = pushAll_("sheet");
  SpreadsheetApp.getActive().toast("Sent " + result.count + " guests to the site.");
  return result;
}

function pullRepliesFromD1() {
  const props = PropertiesService.getScriptProperties();
  const result = syncFetch_({ action: "pull", since: props.getProperty("D1_CONTACT_SINCE") || "" });
  withQuiet_(function () {
    applyContacts_(result.guests || []);
  });
  if (result.now) props.setProperty("D1_CONTACT_SINCE", result.now);
  return result;
}

function isGuestSheet_(sheet) {
  return sheet.getName() === SHEET_NAME || sheet.getSheetId() === SHEET_GID;
}

function isQuiet_() {
  return PropertiesService.getScriptProperties().getProperty("SYNC_QUIET") === "1";
}

function withQuiet_(fn) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty("SYNC_QUIET", "1");
  try {
    return fn();
  } finally {
    props.deleteProperty("SYNC_QUIET");
  }
}

function syncSecret_() {
  return PropertiesService.getScriptProperties().getProperty("SYNC_SECRET") || "";
}

function syncFetch_(payload) {
  const secret = syncSecret_();
  if (!secret) throw new Error("Add script property SYNC_SECRET first.");
  const response = UrlFetchApp.fetch(SYNC_URL, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const body = JSON.parse(response.getContentText() || "{}");
  if (response.getResponseCode() >= 400) {
    throw new Error(body.error || "The site database could not be updated.");
  }
  return body;
}

function pushAll_(contact) {
  const sheet = sheet_();
  const lastRow = sheet.getLastRow();
  return pushRows_(sheet, 2, Math.max(lastRow - 1, 0), contact, true);
}

function pushRows_(sheet, startRow, rowCount, contact, replace) {
  withQuiet_(function () {
    ensureSiteId_(sheet);
  });
  const packed = guestsForSync_(sheet, startRow, rowCount);
  const result = syncFetch_({
    action: "push",
    replace: Boolean(replace),
    contact: contact || "sheet",
    guests: packed.guests,
  });
  withQuiet_(function () {
    writeSiteIds_(sheet, packed.info, result.ids || []);
  });
  return result;
}

function guestsForSync_(sheet, startRow, rowCount) {
  const info = headerIndex_(sheet);
  const lastRow = sheet.getLastRow();
  const first = Math.max(2, startRow || 2);
  const end = Math.min(lastRow, (startRow || 2) + Math.max(rowCount, 0) - 1);
  if (lastRow < 2 || end < first) return { info: info, guests: [] };
  const values = sheet.getRange(2, 1, end - 1, info.width).getValues();
  let code = "";
  let party = "";
  const guests = [];
  values.forEach(function (row, index) {
    const sheetRow = index + 2;
    function get(name) {
      return cell_(row, info.map, name);
    }
    const firstName = asText_(get("first name"));
    const lastName = asText_(get("last name"));
    const currentParty = asText_(get("party"));
    const currentCode = formatCode_(get("group code"));
    if (currentParty && party && currentParty.toLowerCase() !== party && !currentCode) code = "";
    if (currentParty) party = currentParty.toLowerCase();
    if (currentCode) code = currentCode;
    if (sheetRow < first) return;
    if (!firstName && !lastName) return;
    const events = eventsFromRow_(get);
    const rsvp = rsvpFromRow_(get);
    guests.push({
      siteId: asText_(get("site id")),
      row: sheetRow,
      party: currentParty,
      groupCode: currentCode || code,
      firstName: firstName,
      lastName: lastName,
      phone: formatPhone_(get("phone")),
      email: asText_(get("email")),
      street: asText_(get("street address 1")),
      apt: asText_(get("street address 2")),
      city: asText_(get("city")),
      region: asText_(get("state/province")),
      postal: formatPostal_(get("zip/postal code")),
      jersey: events.indexOf("jersey") !== -1,
      como: events.indexOf("como") !== -1,
      shower: events.indexOf("shower") !== -1,
      rsvpJersey: rsvp.jersey,
      rsvpComo: rsvp.como,
      rsvpShower: rsvp.shower,
    });
  });
  return { info: info, guests: guests };
}

function writeSiteIds_(sheet, info, ids) {
  const col = info.map["site id"];
  if (col === undefined || !ids || !ids.length) return;
  ids.forEach(function (item) {
    if (!item || !item.siteId || !item.row) return;
    const cell = sheet.getRange(item.row, col + 1);
    if (!asText_(cell.getValue())) cell.setValue(item.siteId);
  });
}

function updateContacts_(sheet, data) {
  const info = headerIndex_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: false, error: "The guest list is empty." };
  const values = sheet.getRange(2, 1, lastRow - 1, info.width).getValues();
  const codes = groupCodesFor_(values, info.map);
  const guests = Array.isArray(data.guests) && data.guests.length ? data.guests : [data];
  const isAddress = String(data.kind || "").toLowerCase() !== "rsvp";
  const requested = formatCode_(data.groupCode || data.accessCode || data.code);
  let updated = 0;

  guests.forEach(function (guest) {
    const match = findContactRow_(values, info.map, codes, requested, guest);
    if (match === -1) return;
    const row = values[match];
    function set(name, value) {
      const index = info.map[name];
      if (index === undefined || value === undefined || value === null || value === "") return;
      row[index] = value;
    }
    set("phone", guest.phone);
    set("email", guest.email);
    if (isAddress && hasAddress_(guest)) {
      set("street address 1", guest.street || guest.street1 || "");
      set("street address 2", guest.apt || guest.street2 || "");
      set("city", guest.city || "");
      set("state/province", guest.region || guest.state || "");
      set("zip/postal code", guest.postal || guest.zip || "");
    }
    const rsvp = normalizeRsvp_(guest.rsvp);
    if (String(data.kind || "").toLowerCase() === "rsvp" && rsvp) {
      const flags = eventFlags_(data.event);
      if (flags.jersey) set("rsvp whippany", rsvp);
      if (flags.como) set("rsvp como", rsvp);
      if (flags.shower) set("rsvp bridal", rsvp);
    }
    const siteIndex = info.map["site id"];
    if (siteIndex !== undefined && !asText_(row[siteIndex]) && guest.id) row[siteIndex] = guest.id;
    sheet.getRange(match + 2, 1, 1, info.width).setValues([row]);
    values[match] = row;
    updated += 1;
  });

  return { ok: updated > 0, updated: updated > 0 };
}

function findContactRow_(values, map, codes, groupCode, guest) {
  const siteId = asText_(guest.id || guest.siteId);
  const siteIndex = map["site id"];
  if (siteId && siteIndex !== undefined) {
    for (let i = 0; i < values.length; i += 1) {
      if (asText_(values[i][siteIndex]) === siteId) return i;
    }
  }
  const parsed = parseId_(siteId);
  if (Number.isInteger(parsed.index) && values[parsed.index]) {
    const row = values[parsed.index];
    if (
      sameText_(cell_(row, map, "first name"), parsed.first) &&
      sameText_(cell_(row, map, "last name"), parsed.last)
    ) {
      return parsed.index;
    }
  }
  return findGuestRow_(values, map, codes, groupCode, guest);
}

function applyContacts_(guests) {
  if (!guests.length) return;
  const sheet = sheet_();
  const info = headerIndex_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const values = sheet.getRange(2, 1, lastRow - 1, info.width).getValues();
  let code = "";
  let party = "";
  const codes = values.map(function (row) {
    const currentParty = asText_(cell_(row, info.map, "party"));
    const current = formatCode_(cell_(row, info.map, "group code"));
    if (currentParty && party && currentParty.toLowerCase() !== party && !current) code = "";
    if (currentParty) party = currentParty.toLowerCase();
    if (current) code = current;
    return current || code;
  });

  guests.forEach(function (guest) {
    let match = -1;
    const siteIndex = info.map["site id"];
    if (siteIndex !== undefined && guest.id) {
      for (let i = 0; i < values.length; i += 1) {
        if (asText_(values[i][siteIndex]) === guest.id) match = i;
      }
    }
    if (match === -1) {
      const hits = [];
      values.forEach(function (row, index) {
        if (
          sameText_(cell_(row, info.map, "first name"), guest.firstName) &&
          sameText_(cell_(row, info.map, "last name"), guest.lastName) &&
          (!guest.groupCode || codes[index] === formatCode_(guest.groupCode))
        ) {
          hits.push(index);
        }
      });
      if (hits.length === 1) match = hits[0];
    }
    if (match === -1) return;
    const row = values[match];
    function set(name, value) {
      const index = info.map[name];
      if (index === undefined || !asText_(value)) return;
      row[index] = value;
    }
    set("phone", guest.phone);
    set("email", guest.email);
    set("street address 1", guest.street);
    set("street address 2", guest.apt);
    set("city", guest.city);
    set("state/province", guest.region);
    set("zip/postal code", guest.postal);
    set("rsvp whippany", guest.rsvpJersey);
    set("rsvp como", guest.rsvpComo);
    set("rsvp bridal", guest.rsvpShower);
    if (siteIndex !== undefined && !asText_(row[siteIndex]) && guest.id) row[siteIndex] = guest.id;
    sheet.getRange(match + 2, 1, 1, info.width).setValues([row]);
    values[match] = row;
  });
}
