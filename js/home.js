import { CONTACT_EMAIL, EVENTS } from "./config.js";
import { initHouseholdForm } from "./form.js";
import {
  findGuest,
  findGuestByName,
  rememberGuest,
  clearGuest,
  eventHref,
} from "./guests.js";

const sealed = document.querySelector("[data-sealed]");
const chooser = document.querySelector("[data-chooser]");
const continuePanel = document.querySelector("[data-continue]");
const household = document.querySelector("[data-household]");
const form = document.querySelector("[data-code-form]");
const householdForm = document.querySelector("[data-household-form]");
const errorNode = document.querySelector("[data-code-error]");

function missingMessage() {
  return `We couldn’t find that invitation. Please check the name on your card, or write us at ${CONTACT_EMAIL}.`;
}

function ambiguousMessage() {
  return `More than one guest matches that name. Please write us at ${CONTACT_EMAIL} and we will send you the right door.`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function memberName(member) {
  return `${member.first_name || member.firstName || ""} ${member.last_name || member.lastName || ""}`.trim();
}

function doorMarkup(eventKey, guest) {
  const event = EVENTS[eventKey];
  if (!event) return "";
  const people = (guest.members || [])
    .map(memberName)
    .filter(Boolean)
    .map((name) => `<li>${escapeHtml(name)}</li>`)
    .join("");
  return `
    <article>
      <a class="event-door" href="${eventHref(eventKey, guest.code)}">
        <p class="eyebrow">${event.display}</p>
        <h3>${event.shortTitle}</h3>
        <p class="place">${event.place}</p>
        <p class="household-label">Your party</p>
        <ul class="event-party">${people || "<li>Your household</li>"}</ul>
      </a>
    </article>
  `;
}

function showHousehold(guest) {
  rememberGuest(guest);
  document.body.classList.add("is-open");
  sealed.hidden = true;
  if (chooser) chooser.hidden = true;
  if (continuePanel) continuePanel.hidden = true;
  household.hidden = false;

  const greeting = household.querySelector("[data-household-greeting]");
  if (greeting) {
    greeting.textContent = guest.greeting ? `Dear ${guest.greeting}` : "Welcome";
  }

  const doors = household.querySelector("[data-event-doors]");
  if (doors) {
    doors.innerHTML = guest.events.map((key) => doorMarkup(key, guest)).join("");
  }

  if (householdForm) {
    householdForm.hidden = false;
    initHouseholdForm({ guest, form: householdForm });
  }
}

const findInvite = form?.querySelector(".find-invite");

findInvite?.addEventListener("click", () => {
  findInvite.classList.remove("is-striking");
  void findInvite.offsetWidth;
  findInvite.classList.add("is-striking");
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (errorNode) errorNode.textContent = "";
  if (findInvite) {
    findInvite.disabled = true;
    findInvite.setAttribute("aria-busy", "true");
    findInvite.classList.add("is-loading");
  }
  try {
    const guest = await findGuestByName(form.firstName.value, form.lastName.value);
    if (!guest) {
      if (errorNode) errorNode.textContent = missingMessage();
      return;
    }
    showHousehold(guest);
  } catch (error) {
    if (errorNode) {
      errorNode.textContent = error.ambiguous ? ambiguousMessage() : missingMessage();
    }
  } finally {
    if (findInvite) {
      findInvite.disabled = false;
      findInvite.removeAttribute("aria-busy");
      findInvite.classList.remove("is-loading");
    }
  }
});

household?.querySelector("[data-not-you]")?.addEventListener("click", () => {
  clearGuest();
  window.location.assign("/");
});

const params = new URLSearchParams(window.location.search);
const fromQuery = await findGuest(params.get("code"));

if (fromQuery) {
  showHousehold(fromQuery);
} else if (params.get("code") && errorNode) {
  errorNode.textContent = missingMessage();
}
