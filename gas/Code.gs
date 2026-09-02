/**
 * Wedding address collector for Google Sheets
 *
 * Setup:
 * 1. Open the guest Google Sheet.
 * 2. Extensions → Apps Script, paste this file, save.
 * 3. Deploy → New deployment → Web app.
 *    Execute as: Me
 *    Who has access: Anyone
 * 4. Copy the web app URL into js/config.js as GAS_URL.
 *
 * Expected columns on the first sheet (header row):
 * Timestamp | Event | Access Code | First Name | Last Name | Phone | Email |
 * Street | Apt | City | State/Region | Postal | Country | Additional Guests | Party Size
 */
const SHEET_NAME = "Addresses";

function headers_() {
  return [
    "Timestamp",
    "Event",
    "Access Code",
    "First Name",
    "Last Name",
    "Phone",
    "Email",
    "Street",
    "Apt",
    "City",
    "State/Region",
    "Postal",
    "Country",
    "Additional Guests",
    "Party Size",
  ];
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers_());
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function parsePayload_(e) {
  if (e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }
  if (e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }
  return e.parameter || {};
}

function writeRow_(data) {
  const extras = Array.isArray(data.additionalGuests)
    ? data.additionalGuests
        .map(function (guest) {
          return [guest.firstName, guest.lastName].filter(Boolean).join(" ").trim();
        })
        .filter(Boolean)
        .join(", ")
    : data.additionalGuestsText || "";

  sheet_().appendRow([
    data.timestamp || new Date(),
    data.event || "",
    data.accessCode || "",
    data.firstName || "",
    data.lastName || "",
    data.phone || "",
    data.email || "",
    data.street || "",
    data.apt || "",
    data.city || "",
    data.region || "",
    data.postal || "",
    data.country || "",
    extras,
    data.partySize || "",
  ]);
}

function json_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    writeRow_(parsePayload_(e));
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.payload) {
    writeRow_(parsePayload_(e));
  }
  return json_({ ok: true, service: "theking.wedding" });
}
