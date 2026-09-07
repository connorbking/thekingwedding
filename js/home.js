import { CONTACT_EMAIL, EVENTS } from "./config.js";
import {
  lookupGuest,
  rememberGuest,
  eventHref,
  isDualGuest,
} from "./guests.js";

const sealed = document.querySelector("[data-sealed]");
const chooser = document.querySelector("[data-chooser]");
const continuePanel = document.querySelector("[data-continue]");
const form = document.querySelector("[data-code-form]");
const errorNode = document.querySelector("[data-code-error]");

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

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const guest = lookupGuest(form.code.value);
  if (!guest) {
    if (errorNode) {
      errorNode.textContent = `We couldn’t find that invitation. Please check the name on your card, or write us at ${CONTACT_EMAIL}.`;
    }
    return;
  }
  if (errorNode) errorNode.textContent = "";
  admit(guest, { autoNavigate: true });
});

const params = new URLSearchParams(window.location.search);
const fromQuery = lookupGuest(params.get("code"));

if (fromQuery) {
  form.code.value = fromQuery.code;
} else if (params.get("code") && errorNode) {
  form.code.value = params.get("code");
  errorNode.textContent = `We couldn’t find that invitation. Please check the name on your card, or write us at ${CONTACT_EMAIL}.`;
}
