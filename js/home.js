import { CONTACT_EMAIL, EVENTS } from "./config.js";
import {
  findGuest,
  findGuestByName,
  rememberGuest,
  eventHref,
  isDualGuest,
} from "./guests.js";

const sealed = document.querySelector("[data-sealed]");
const chooser = document.querySelector("[data-chooser]");
const continuePanel = document.querySelector("[data-continue]");
const form = document.querySelector("[data-code-form]");
const errorNode = document.querySelector("[data-code-error]");

function missingMessage() {
  return `We couldn’t find that invitation. Please check the name on your card, or write us at ${CONTACT_EMAIL}.`;
}

function ambiguousMessage() {
  return `More than one guest matches that name. Please write us at ${CONTACT_EMAIL} and we will send you the right door.`;
}

function doorMarkup(eventKey, code) {
  const event = EVENTS[eventKey];
  if (!event) return "";
  const title = eventKey === "como" ? "Lake Como" : "Whippany";
  const region = eventKey === "como" ? "Italy" : "New Jersey";
  return `
    <a href="${eventHref(eventKey, code)}">
      <p class="eyebrow">${event.display}</p>
      <h2>${title}</h2>
      <p class="place">${region}</p>
    </a>
  `;
}

function showChooser(guest) {
  sealed.hidden = true;
  continuePanel.hidden = true;
  chooser.hidden = false;
  const doors = chooser.querySelector("[data-chooser-doors]");
  if (doors) {
    doors.innerHTML = guest.events.map((key) => doorMarkup(key, guest.code)).join("");
  }
}

function showContinue(guest) {
  sealed.hidden = true;
  chooser.hidden = true;
  continuePanel.hidden = false;
  const link = continuePanel.querySelector("[data-continue-link]");
  if (link) link.href = eventHref(guest.events[0], guest.code);
}

function goToEvent(guest) {
  window.location.assign(eventHref(guest.events[0], guest.code));
}

function admit(guest, { autoNavigate }) {
  rememberGuest(guest);
  if (isDualGuest(guest)) {
    showChooser(guest);
    return;
  }
  if (autoNavigate) {
    goToEvent(guest);
    return;
  }
  showContinue(guest);
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (errorNode) errorNode.textContent = "";
  try {
    const guest = await findGuestByName(form.firstName.value, form.lastName.value);
    if (!guest) {
      if (errorNode) errorNode.textContent = missingMessage();
      return;
    }
    admit(guest, { autoNavigate: true });
  } catch (error) {
    if (errorNode) {
      errorNode.textContent = error.ambiguous ? ambiguousMessage() : missingMessage();
    }
  }
});

const params = new URLSearchParams(window.location.search);
const fromQuery = await findGuest(params.get("code"));

if (fromQuery) {
  if (params.get("gate") === "1") {
    admit(fromQuery, { autoNavigate: false });
  }
} else if (params.get("code") && errorNode) {
  errorNode.textContent = missingMessage();
}
