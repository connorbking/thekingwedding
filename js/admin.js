import { formatCount, formatGuest, formatGroupCode, formatPhone, formatPostal, sheetText } from "./format.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const loginCard = document.querySelector("[data-login]");
const desk = document.querySelector("[data-desk]");
const who = document.querySelector("[data-who]");
const headerLogin = document.querySelector("[data-header-login]");
const logoutBtn = document.querySelector("[data-logout]");
const emailNode = document.querySelector("[data-admin-email]");
const submissionsBody = document.querySelector("[data-submissions]");
const errorNode = document.querySelector("[data-login-error]");
const deskError = document.querySelector("[data-desk-error]");
const searchInput = document.querySelector("[data-filter-query]");
const listCaptionNode = document.querySelector("[data-list-caption]");

const EVENT_KEYS = ["shower", "como", "jersey"];
const RSVP_KEYS = ["Yes", "No"];

let submissions = [];
let firebaseAuth = null;
let listFilter = { event: "", rsvp: "" };

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

function setSession(email = "") {
  const signedIn = Boolean(email);
  if (loginCard) loginCard.hidden = signedIn;
  if (desk) desk.hidden = !signedIn;
  if (who) who.hidden = !signedIn;
  if (logoutBtn) logoutBtn.hidden = !signedIn;
  if (headerLogin) headerLogin.hidden = signedIn;
  if (emailNode) emailNode.textContent = email;
}

function showDeskError(message = "") {
  if (!deskError) return;
  deskError.textContent = message;
  deskError.hidden = !message;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function guestEvents(row) {
  if (Array.isArray(row.events) && row.events.length) return row.events;
  const flags = [];
  if (row.shower || row.invite?.shower) flags.push("shower");
  if (row.como || row.invite?.como) flags.push("como");
  if (row.jersey || row.invite?.jersey) flags.push("jersey");
  if (!flags.length && row.event) flags.push(row.event);
  return flags;
}

function eventLabel(key) {
  if (key === "como") return "Como";
  if (key === "jersey") return "Whippany";
  if (key === "shower") return "Bridal Shower";
  return key;
}

function guestRsvp(row, key) {
  if (row.rsvp && typeof row.rsvp === "object") return row.rsvp[key] || "";
  return row[`rsvp_${key}`] || "";
}

function rsvpLine(row) {
  return EVENT_KEYS
    .filter((key) => guestEvents(row).includes(key) || guestRsvp(row, key))
    .map((key) => `${eventLabel(key)} ${guestRsvp(row, key) || "—"}`)
    .join("<br>") || "—";
}

function invitedTo(row, event) {
  return guestEvents(row).includes(event);
}

function textValue(value) {
  return sheetText(value);
}

function groupCodeOf(row) {
  return formatGroupCode(row.group_code || row.access_code);
}

function inviteLinksHtml(row) {
  const code = groupCodeOf(row);
  if (!code) return "";
  const slug = encodeURIComponent(code);
  const links = [];
  if (invitedTo(row, "shower")) {
    links.push(`<a href="/shower/save-the-date?${slug}">Shower date</a>`);
    links.push(`<a href="/shower/rsvp?${slug}">Shower RSVP</a>`);
  }
  if (invitedTo(row, "como")) {
    links.push(`<a href="/como/save-the-date?${slug}">Como date</a>`);
    links.push(`<a href="/como/rsvp?${slug}">Como RSVP</a>`);
  }
  if (invitedTo(row, "jersey")) {
    links.push(`<a href="/jersey/save-the-date?${slug}">Whippany date</a>`);
    links.push(`<a href="/jersey/rsvp?${slug}">Whippany RSVP</a>`);
  }
  return links.length ? `<div class="row-detail row-links">${links.join("")}</div>` : "";
}

function addressKey(row) {
  const street = textValue(row.street).toLowerCase();
  const postal = textValue(row.postal).toLowerCase();
  return street ? `${street}|${postal}` : "";
}

function clusterHouseholds(rows) {
  const list = rows.map((row, index) => ({ ...row, _sheetIndex: index }));
  let code = "";

  for (const row of list) {
    const currentCode = groupCodeOf(row);
    if (currentCode) {
      code = currentCode;
    } else if (code) {
      row.access_code = code;
      row.group_code = code;
    }
  }

  return list;
}

function groupKey(row) {
  const code = groupCodeOf(row);
  if (code) return `code:${code}`;
  const party = textValue(row.party).toLowerCase();
  if (party) return `party:${party}`;
  const address = addressKey(row);
  if (address) return `addr:${address}`;
  return `solo:${row.id || row._sheetIndex}`;
}

function groupSortName(row) {
  return groupCodeOf(row) || textValue(row.last_name);
}

function compareGuests(a, b) {
  const groupName = groupSortName(a).localeCompare(groupSortName(b), undefined, { sensitivity: "base" });
  if (groupName) return groupName;
  const group = groupKey(a).localeCompare(groupKey(b));
  if (group) return group;
  const last = textValue(a.last_name).localeCompare(textValue(b.last_name), undefined, { sensitivity: "base" });
  if (last) return last;
  const first = textValue(a.first_name).localeCompare(textValue(b.first_name), undefined, { sensitivity: "base" });
  if (first) return first;
  return (a._sheetIndex || 0) - (b._sheetIndex || 0);
}

function searchHaystack(row) {
  return [
    row.party,
    row.access_code,
    row.group_code,
    row.first_name,
    row.last_name,
    row.email,
    row.phone,
    row.city,
    row.region,
    row.postal,
  ]
    .join(" ")
    .toLowerCase();
}

function rowMatchesQuery(row, query) {
  return !query || searchHaystack(row).includes(query);
}

function matchesListFilter(row) {
  if (!listFilter.event) return true;
  if (listFilter.rsvp) {
    return invitedTo(row, listFilter.event) && guestRsvp(row, listFilter.event) === listFilter.rsvp;
  }
  return invitedTo(row, listFilter.event);
}

function listCaption() {
  if (!listFilter.event) return "All guests";
  const name = eventLabel(listFilter.event);
  if (!listFilter.rsvp) return `${name} invitees`;
  return `${name} · ${listFilter.rsvp}`;
}

function renderEventCards() {
  EVENT_KEYS.forEach((event) => {
    const invited = submissions.filter((row) => invitedTo(row, event));
    const total = document.querySelector(`[data-stat-invite="${event}"]`);
    if (total) total.textContent = formatCount(invited.length);
    RSVP_KEYS.forEach((answer) => {
      const node = document.querySelector(`[data-stat-rsvp="${event}-${answer}"]`);
      if (node) node.textContent = formatCount(invited.filter((row) => guestRsvp(row, event) === answer).length);
    });
  });

  document.querySelectorAll("[data-event-card]").forEach((card) => {
    card.classList.toggle("is-active", card.dataset.eventCard === listFilter.event);
  });
  document.querySelectorAll("[data-filter-list]").forEach((button) => {
    const active = button.dataset.filterList === listFilter.event && button.dataset.filterRsvp === listFilter.rsvp;
    button.classList.toggle("is-active", active);
  });
}

function renderSubmissions() {
  const query = (searchInput?.value || "").trim().toLowerCase();
  const clustered = clusterHouseholds(submissions);
  const matchingKeys = new Set(
    clustered
      .filter((row) => matchesListFilter(row) && rowMatchesQuery(row, query))
      .map(groupKey)
  );
  const rows = clustered.filter((row) => matchingKeys.has(groupKey(row))).sort(compareGuests);

  renderEventCards();
  if (listCaptionNode) listCaptionNode.textContent = `${listCaption()} · ${formatCount(rows.length)}`;
  if (!submissionsBody) return;

  submissionsBody.innerHTML = rows
    .map((row, index) => {
      const invited = guestEvents(row).map(eventLabel).join(" · ") || "—";
      const address = [row.city, row.region, formatPostal(row.postal)].filter(Boolean).join(", ");
      const firstInGroup = index === 0 || groupKey(row) !== groupKey(rows[index - 1]);
      const outsideFilter = Boolean(listFilter.event) && !matchesListFilter(row);
      const classes = [
        firstInGroup ? "is-group-start" : "is-group-cont",
        outsideFilter ? "is-outside-filter" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<tr class="${classes}">
        <td>${escapeHtml(groupCodeOf(row))}${inviteLinksHtml(row)}</td>
        <td>${escapeHtml(`${row.first_name || ""} ${row.last_name || ""}`.trim())}</td>
        <td>${escapeHtml(row.email)}${row.phone ? `<div class="row-detail">${escapeHtml(formatPhone(row.phone))}</div>` : ""}</td>
        <td>${escapeHtml(row.street || "")}${row.apt ? `, ${escapeHtml(row.apt)}` : ""}${address ? `<div class="row-detail">${escapeHtml(address)}</div>` : ""}</td>
        <td>${escapeHtml(invited)}</td>
        <td>${rsvpLine(row)}</td>
        <td><button class="danger" data-delete-submission="${encodeURIComponent(row.id || "")}">Remove</button></td>
      </tr>`;
    })
    .join("") || `<tr class="empty-row"><td colspan="7">No guests in this list.</td></tr>`;
}

function applyEventSettings(events = {}) {
  EVENT_KEYS.forEach((key) => {
    const row = events[key] || {};
    const visible = document.querySelector(`[data-event-visible="${key}"]`);
    const invite = document.querySelector(`[data-event-invite="${key}"]`);
    if (visible) visible.checked = row.visible !== false;
    if (invite) invite.checked = row.invite === true;
  });
}

function readEventSettings() {
  const events = {};
  EVENT_KEYS.forEach((key) => {
    events[key] = {
      visible: Boolean(document.querySelector(`[data-event-visible="${key}"]`)?.checked),
      invite: Boolean(document.querySelector(`[data-event-invite="${key}"]`)?.checked),
    };
  });
  return events;
}

function setEventSwitchesDisabled(disabled) {
  document.querySelectorAll("[data-event-visible], [data-event-invite]").forEach((input) => {
    input.disabled = disabled;
  });
}

let settingsSave = Promise.resolve();

function saveEventSettings() {
  const events = readEventSettings();
  settingsSave = settingsSave
    .catch(() => {})
    .then(async () => {
      setEventSwitchesDisabled(true);
      try {
        const data = await api("/api/admin/event-settings", {
          method: "PUT",
          body: JSON.stringify({ events }),
        });
        applyEventSettings(data.events);
        showDeskError("");
      } catch (error) {
        const current = await api("/api/admin/event-settings");
        applyEventSettings(current.events);
        showDeskError(error.message || "The event switches could not be saved.");
      } finally {
        setEventSwitchesDisabled(false);
      }
    });
  return settingsSave;
}

async function loadDesk() {
  showDeskError("");
  const [submissionData, settings] = await Promise.all([
    api("/api/admin/submissions"),
    api("/api/admin/event-settings"),
  ]);
  submissions = (submissionData.submissions || []).map(formatGuest);
  applyEventSettings(settings.events);
  renderSubmissions();
  if (!submissions.length && submissionData.error) {
    showDeskError(submissionData.error);
  }
}

async function loadFirebase() {
  const config = await api("/api/firebase-config");
  if (!config.configured || !config.firebase) {
    throw new Error("Google sign-in is not connected yet.");
  }
  firebaseAuth = getAuth(initializeApp(config.firebase));
}

function explainAuthError(error) {
  const code = error.code || "";
  if (code === "auth/configuration-not-found" || /configuration-not-found/i.test(error.message)) {
    return `Firebase Authentication is not enabled yet. Open <a href="https://console.firebase.google.com/project/kingwedding-73f8f/authentication/providers" target="_blank" rel="noopener">Authentication → Sign-in method</a>, enable <strong>Google</strong>, then add <code>theking.wedding</code> under Authorized domains.`;
  }
  if (code === "auth/unauthorized-domain") {
    return `Add <code>theking.wedding</code> and <code>thekingwedding.pages.dev</code> under Firebase <a href="https://console.firebase.google.com/project/kingwedding-73f8f/authentication/settings" target="_blank" rel="noopener">Authorized domains</a>.`;
  }
  if (code === "auth/popup-blocked") {
    return "The Google window was blocked. Allow popups for this site and try again.";
  }
  return escapeHtml(error.message || "Sign-in failed.");
}

document.querySelector("[data-google-login]")?.addEventListener("click", async () => {
  if (errorNode) errorNode.textContent = "";
  try {
    if (!firebaseAuth) await loadFirebase();
    const result = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
    const idToken = await result.user.getIdToken();
    const session = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
    setSession(session.email);
    try {
      await loadDesk();
    } catch (error) {
      showDeskError(error.message || "The guest list could not be loaded.");
    }
  } catch (error) {
    setSession("");
    if (errorNode) errorNode.innerHTML = explainAuthError(error);
  }
});

logoutBtn?.addEventListener("click", async () => {
  try {
    if (firebaseAuth) await signOut(firebaseAuth);
  } catch {
    // Cookie clear still logs the host out of this site.
  }
  await api("/api/admin/logout", { method: "POST", body: "{}" });
  setSession("");
});

headerLogin?.addEventListener("click", () => {
  document.querySelector("[data-google-login]")?.click();
});

searchInput?.addEventListener("input", renderSubmissions);

desk?.addEventListener("change", (event) => {
  if (!event.target.closest("[data-event-visible], [data-event-invite]")) return;
  saveEventSettings();
});

desk?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter-list]");
  if (!button) return;
  const next = { event: button.dataset.filterList, rsvp: button.dataset.filterRsvp || "" };
  const same = listFilter.event === next.event && listFilter.rsvp === next.rsvp;
  listFilter = same ? { event: "", rsvp: "" } : next;
  renderSubmissions();
  submissionsBody?.closest(".table-wrap")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

submissionsBody?.addEventListener("click", async (event) => {
  const id = event.target.closest("[data-delete-submission]")?.dataset.deleteSubmission;
  if (!id || !window.confirm("Remove this guest from the sheet?")) return;
  await api(`/api/admin/submissions/${id}`, { method: "DELETE" });
  await loadDesk();
});

document.querySelector("[data-export]")?.addEventListener("click", () => {
  const header = [
    "party",
    "access_code",
    "last_name",
    "first_name",
    "phone",
    "email",
    "street",
    "apt",
    "city",
    "region",
    "postal",
    "shower",
    "como",
    "jersey",
    "rsvp_shower",
    "rsvp_como",
    "rsvp_jersey",
  ];
  const lines = [
    header.join(","),
    ...clusterHouseholds(submissions)
      .sort(compareGuests)
      .map((row) =>
      header
        .map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`)
        .join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "king-wedding-addresses.csv";
  link.click();
});

try {
  const session = await api("/api/admin/session");
  if (session.email) {
    setSession(session.email);
    try {
      await loadDesk();
    } catch (error) {
      showDeskError(error.message || "The guest list could not be loaded.");
    }
  } else {
    setSession("");
  }
} catch {
  setSession("");
  try {
    await loadFirebase();
  } catch (error) {
    if (errorNode) errorNode.textContent = error.message;
  }
}
