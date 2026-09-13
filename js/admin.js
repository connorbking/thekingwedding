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
const logoutBtn = document.querySelector("[data-logout]");
const submissionsBody = document.querySelector("[data-submissions]");
const invitesBody = document.querySelector("[data-invites]");
const errorNode = document.querySelector("[data-login-error]");

let submissions = [];
let invites = [];
let firebaseAuth = null;

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

function showDesk(visible, email = "") {
  loginCard.hidden = visible;
  desk.hidden = !visible;
  who.hidden = !visible;
  document.querySelector("[data-admin-email]").textContent = email;
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function guestText(row) {
  try {
    const extras = JSON.parse(row.additional_guests || "[]");
    return extras.map((guest) => `${guest.firstName} ${guest.lastName}`.trim()).filter(Boolean).join(", ");
  } catch {
    return row.additional_guests || "";
  }
}

function renderSubmissions() {
  const event = document.querySelector("[data-filter-event]").value;
  const query = document.querySelector("[data-filter-query]").value.trim().toLowerCase();
  const rows = submissions.filter((row) => {
    if (event && row.event !== event) return false;
    if (!query) return true;
    return [
      row.first_name,
      row.last_name,
      row.email,
      row.phone,
      row.city,
      row.access_code,
      row.additional_guests,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  document.querySelector("[data-stat-total]").textContent = submissions.length;
  document.querySelector("[data-stat-como]").textContent = submissions.filter((row) => row.event === "como").length;
  document.querySelector("[data-stat-jersey]").textContent = submissions.filter((row) => row.event === "jersey").length;

  submissionsBody.innerHTML = rows
    .map((row) => {
      const extras = guestText(row);
      return `<tr>
        <td>${formatDate(row.created_at)}</td>
        <td>${row.event === "como" ? "Como" : "Whippany"}</td>
        <td>${row.first_name} ${row.last_name}${row.access_code ? `<div class="row-detail">${row.access_code}</div>` : ""}</td>
        <td>${row.email}<div class="row-detail">${row.phone}</div></td>
        <td>${row.street}${row.apt ? `, ${row.apt}` : ""}<div class="row-detail">${row.city}, ${row.region} ${row.postal}<br>${row.country}</div></td>
        <td>${row.party_size}${extras ? `<div class="row-detail">${extras}</div>` : ""}</td>
        <td><button class="danger" data-delete-submission="${row.id}">Remove</button></td>
      </tr>`;
    })
    .join("");
}

function renderInvites() {
  invitesBody.innerHTML = invites
    .map(
      (invite) => `<tr>
        <td>${invite.code}</td>
        <td>${invite.greeting}</td>
        <td>${invite.max_party}</td>
        <td>${invite.events}</td>
        <td>${invite.notes || ""}</td>
        <td><button class="danger" data-delete-invite="${invite.code}">Remove</button></td>
      </tr>`
    )
    .join("");
}

async function loadDesk() {
  const [submissionData, inviteData] = await Promise.all([
    api("/api/admin/submissions"),
    api("/api/admin/invites"),
  ]);
  submissions = submissionData.submissions || [];
  invites = inviteData.invites || [];
  renderSubmissions();
  renderInvites();
}

async function loadFirebase() {
  const config = await api("/api/firebase-config");
  if (!config.configured || !config.firebase) {
    throw new Error("Google sign-in is not connected yet.");
  }
  firebaseAuth = getAuth(initializeApp(config.firebase));
}

document.querySelector("[data-google-login]").addEventListener("click", async () => {
  errorNode.textContent = "";
  try {
    if (!firebaseAuth) await loadFirebase();
    const result = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
    const idToken = await result.user.getIdToken();
    const session = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
    showDesk(true, session.email);
    await loadDesk();
  } catch (error) {
    const code = error.code || "";
    if (code === "auth/configuration-not-found" || /configuration-not-found/i.test(error.message)) {
      errorNode.innerHTML = `Firebase Authentication is not enabled yet. Open <a href="https://console.firebase.google.com/project/kingwedding-73f8f/authentication/providers" target="_blank" rel="noopener">Authentication → Sign-in method</a>, click Get started, enable <strong>Google</strong>, then add <code>theking.wedding</code> under Authorized domains.`;
    } else if (code === "auth/unauthorized-domain") {
      errorNode.innerHTML = `Add <code>theking.wedding</code> and <code>thekingwedding.pages.dev</code> under Firebase <a href="https://console.firebase.google.com/project/kingwedding-73f8f/authentication/settings" target="_blank" rel="noopener">Authorized domains</a>.`;
    } else if (code === "auth/popup-blocked") {
      errorNode.textContent = "The Google window was blocked. Allow popups for this site and try again.";
    } else {
      errorNode.textContent = error.message;
    }
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    if (firebaseAuth) await signOut(firebaseAuth);
  } catch {
    // Cookie clear still logs the host out of this site.
  }
  await api("/api/admin/logout", { method: "POST", body: "{}" });
  showDesk(false);
});

document.querySelector("[data-filter-event]").addEventListener("change", renderSubmissions);
document.querySelector("[data-filter-query]").addEventListener("input", renderSubmissions);

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("is-active", item === button));
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== button.dataset.tab;
    });
  });
});

submissionsBody.addEventListener("click", async (event) => {
  const id = event.target.closest("[data-delete-submission]")?.dataset.deleteSubmission;
  if (!id || !window.confirm("Remove this reply?")) return;
  await api(`/api/admin/submissions/${id}`, { method: "DELETE" });
  await loadDesk();
});

invitesBody.addEventListener("click", async (event) => {
  const code = event.target.closest("[data-delete-invite]")?.dataset.deleteInvite;
  if (!code || !window.confirm(`Remove invite code ${code}?`)) return;
  await api(`/api/admin/invites/${code}`, { method: "DELETE" });
  await loadDesk();
});

document.querySelector("[data-invite-form]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const inviteError = document.querySelector("[data-invite-error]");
  inviteError.textContent = "";
  const form = event.target;
  try {
    await api("/api/admin/invites", {
      method: "POST",
      body: JSON.stringify({
        code: form.code.value,
        greeting: form.greeting.value,
        maxParty: Number(form.maxParty.value),
        events: form.events.value,
        notes: form.notes.value,
      }),
    });
    form.reset();
    form.maxParty.value = 2;
    await loadDesk();
  } catch (error) {
    inviteError.textContent = error.message;
  }
});

document.querySelector("[data-export]").addEventListener("click", () => {
  const header = [
    "created_at",
    "event",
    "access_code",
    "first_name",
    "last_name",
    "phone",
    "email",
    "street",
    "apt",
    "city",
    "region",
    "postal",
    "country",
    "additional_guests",
    "party_size",
  ];
  const lines = [
    header.join(","),
    ...submissions.map((row) =>
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
  showDesk(true, session.email);
  await loadDesk();
} catch {
  showDesk(false);
  try {
    await loadFirebase();
  } catch (error) {
    errorNode.textContent = error.message;
  }
}
