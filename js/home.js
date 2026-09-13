import { CONTACT_EMAIL, EVENTS, sortEvents } from "./config.js";
import { initHouseholdForm, openDetailsModal, closeDetailsModal } from "./form.js";
import {
  findGuest,
  findGuestByName,
  resolveGuest,
  readStoredGuest,
  rememberGuest,
  clearGuest,
} from "./guests.js";

const sealed = document.querySelector("[data-sealed]");
const chooser = document.querySelector("[data-chooser]");
const continuePanel = document.querySelector("[data-continue]");
const household = document.querySelector("[data-household]");
const form = document.querySelector("[data-code-form]");
const householdForm = document.querySelector("[data-household-form]");
const detailsModal = document.querySelector("[data-details-modal]");
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

function memberInvited(member, eventKey) {
  if (Array.isArray(member.events) && member.events.length) return member.events.includes(eventKey);
  if (member.invite && typeof member.invite === "object") return Boolean(member.invite[eventKey]);
  if (eventKey === "jersey") return Boolean(member.jersey);
  if (eventKey === "como") return Boolean(member.como);
  if (eventKey === "shower") return Boolean(member.shower);
  return true;
}

function countLabel(count) {
  if (count === 1) return "Have left you an invitation";
  if (count === 2) return "Have left you two invitations";
  if (count === 3) return "Have left you three invitations";
  return `Have left you ${count} invitations`;
}

const ENVELOPE_ART = {
  como: "/public/olive-envelope.png",
  jersey: "/public/red-envelope.png",
  shower: "/public/cream-envelope.png",
};

function doorMarkup(eventKey, guest) {
  const event = EVENTS[eventKey];
  if (!event) return "";
  const invitedMembers = (guest.members || []).filter((member) => memberInvited(member, eventKey));
  if (!invitedMembers.length) return "";
  const region = event.region || event.place;
  return `
    <button type="button" class="event-door envelope-link" data-envelope aria-label="Open ${escapeHtml(event.shortTitle)}" aria-expanded="false">
      <span class="envelope envelope--${eventKey}" aria-hidden="true">
        <span class="envelope-sleeve">
          <span class="envelope-card">
            <span class="invite-sheet">
              <span class="invite-sheet-script">Save the Date</span>
              <span class="invite-sheet-names">Alyssa &amp; Connor</span>
              <span class="invite-sheet-rule"></span>
              <span class="invite-sheet-meta">${escapeHtml(event.weekday)}</span>
              <span class="invite-sheet-meta">${escapeHtml(event.display)}</span>
              <span class="invite-sheet-meta">${escapeHtml(event.place)}</span>
            </span>
          </span>
        </span>
        <img class="envelope-art" src="${ENVELOPE_ART[eventKey]}" alt="">
      </span>
      <span class="envelope-caption">
        <strong>${escapeHtml(event.shortTitle)}</strong>
        <em>${escapeHtml(region)}</em>
      </span>
    </button>
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
    greeting.textContent = guest.greeting ? `Dear ${guest.greeting}` : "";
    greeting.hidden = !guest.greeting;
  }

  const shown = sortEvents(guest.events)
    .filter((key) => key !== "shower")
    .filter((key) => doorMarkup(key, guest));
  const count = household.querySelector("[data-household-count]");
  if (count) count.textContent = countLabel(shown.length);

  const doors = household.querySelector("[data-event-doors]");
  if (doors) {
    doors.innerHTML = shown.map((key) => doorMarkup(key, guest)).join("");
  }
  setReading(false);

  if (householdForm) {
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
      errorNode.textContent = error.ambiguous
        ? ambiguousMessage()
        : error.lookupError
          ? error.message
          : missingMessage();
    }
  } finally {
    if (findInvite) {
      findInvite.disabled = false;
      findInvite.removeAttribute("aria-busy");
      findInvite.classList.remove("is-loading");
    }
  }
});

function setReading(open) {
  household?.classList.toggle("is-reading", open);
  const hint = household?.querySelector("[data-household-hint]");
  const back = household?.querySelector("[data-back-envelopes]");
  if (hint) hint.hidden = open;
  if (back) back.hidden = !open;
}

function closeEnvelopes() {
  household?.querySelectorAll("[data-envelope]").forEach((link) => {
    link.classList.remove("is-opening", "is-selected", "is-away");
    link.setAttribute("aria-expanded", "false");
    link.style.removeProperty("--focus-x");
    link.style.removeProperty("--focus-y");
  });
  setReading(false);
}

function centerEnvelope(link) {
  const card = link.querySelector(".envelope") || link;
  const box = card.getBoundingClientRect();
  const lift = Math.min(140, window.innerHeight * 0.16);
  link.style.setProperty("--focus-x", `${window.innerWidth / 2 - (box.left + box.width / 2)}px`);
  link.style.setProperty("--focus-y", `${window.innerHeight / 2 - (box.top + box.height / 2) + lift}px`);
}

household?.addEventListener("click", (event) => {
  const link = event.target.closest("[data-envelope]");
  if (!link || event.button !== 0) return;
  if (link.classList.contains("is-opening")) {
    closeEnvelopes();
    return;
  }
  household.querySelectorAll("[data-envelope]").forEach((other) => {
    other.classList.toggle("is-selected", other === link);
    other.classList.toggle("is-away", other !== link);
    other.setAttribute("aria-expanded", other === link ? "true" : "false");
  });
  setReading(true);
  centerEnvelope(link);
  link.classList.add("is-opening");
});

household?.querySelector("[data-back-envelopes]")?.addEventListener("click", closeEnvelopes);

window.addEventListener("pagehide", closeEnvelopes);
window.addEventListener("pageshow", closeEnvelopes);
window.addEventListener("resize", () => {
  const open = household?.querySelector(".envelope-link.is-opening");
  if (open) centerEnvelope(open);
});

household?.querySelector("[data-open-details]")?.addEventListener("click", () => {
  openDetailsModal(detailsModal);
});

detailsModal?.querySelectorAll("[data-close-details]").forEach((el) => {
  el.addEventListener("click", () => closeDetailsModal(detailsModal));
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (detailsModal && !detailsModal.hidden) {
    closeDetailsModal(detailsModal);
    return;
  }
  if (household?.querySelector(".is-opening")) closeEnvelopes();
});

household?.querySelector("[data-not-you]")?.addEventListener("click", () => {
  clearGuest();
  window.location.assign("/");
});

const params = new URLSearchParams(window.location.search);
const stored = readStoredGuest();
if (params.get("code") || params.get("gate") || stored) {
  if (stored) showHousehold(stored);
  const returning = await resolveGuest();
  if (returning) showHousehold(returning);
  else if (!stored && params.get("code") && errorNode) errorNode.textContent = missingMessage();
  document.documentElement.classList.remove("invite-returning");
}
