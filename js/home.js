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

const ART_V = "6";
const artUrl = (file) => `/public/envelopes/${file}?v=${ART_V}`;
const ENVELOPE_ART = {
  como: {
    body: artUrl("olive-env.png"),
    closedFlap: artUrl("olive-env-closed-flap.png"),
    openFlap: artUrl("olive-env-open-flap.png"),
    seal: artUrl("olive-seal.png"),
    sealBroken: artUrl("olive-seal-broken.png"),
    letter: artUrl("letter-insert1.png"),
  },
  jersey: {
    body: artUrl("red-env.png"),
    closedFlap: artUrl("red-env-closed-flap.png"),
    openFlap: artUrl("red-env-open-flap.png"),
    seal: artUrl("red-seal.png"),
    sealBroken: artUrl("red-seal-broken.png"),
    letter: artUrl("letter-insert2.png"),
  },
  shower: {
    body: artUrl("cream-env.png"),
    closedFlap: artUrl("cream-env-closed-flap.png"),
    openFlap: artUrl("cream-env-open-flap.png"),
    seal: artUrl("cream-seal.png"),
    sealBroken: artUrl("cream-seal-broken.png"),
    letter: artUrl("letter-insert3.png"),
  },
};

function doorMarkup(eventKey, guest) {
  const event = EVENTS[eventKey];
  const art = ENVELOPE_ART[eventKey];
  if (!event || !art) return "";
  const invitedMembers = (guest.members || []).filter((member) => memberInvited(member, eventKey));
  if (!invitedMembers.length) return "";
  const region = event.region || event.place;
  return `
    <button type="button" class="event-door envelope-link" data-envelope aria-label="Open ${escapeHtml(event.shortTitle)}" aria-expanded="false">
      <span class="envelope envelope--${eventKey}" aria-hidden="true">
        <img class="envelope-open-flap" src="${art.openFlap}" alt="">
        <span class="envelope-sleeve">
          <span class="envelope-letter">
            <img class="envelope-letter-art" src="${art.letter}" alt="">
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
        <span class="envelope-crop">
          <img class="envelope-body" src="${art.body}" alt="">
          <img class="envelope-closed-flap" src="${art.closedFlap}" alt="">
          <img class="envelope-seal" src="${art.seal}" alt="">
          <img class="envelope-seal envelope-seal--broken" src="${art.sealBroken}" alt="">
        </span>
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
  const nextKey = shown.join("|");
  const envelopeOpen = Boolean(household.querySelector("[data-envelope].is-opening"));
  const alreadyShown = Boolean(doors?.dataset.doors && doors.dataset.doors === nextKey);

  if (doors && !envelopeOpen && !alreadyShown) {
    doors.innerHTML = shown.map((key) => doorMarkup(key, guest)).join("");
    doors.dataset.doors = nextKey;
    setReading(false);
  }

  if (householdForm) {
    initHouseholdForm({ guest, form: householdForm });
  }
}

const findInvite = form?.querySelector(".find-invite");
const unlockKey = document.querySelector("[data-unlock-key]");

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function unlockPoints() {
  const fleur = document.querySelector(".monogram-rule");
  const lockEl = document.querySelector(".lock");
  if (!unlockKey || !fleur || !lockEl) return null;
  const from = fleur.getBoundingClientRect();
  const to = lockEl.getBoundingClientRect();
  return {
    startX: from.left + from.width / 2,
    startY: from.top + from.height / 2,
    holeX: to.left + to.width / 2,
    holeY: to.top + to.height * 0.42,
    lockX: to.left + to.width / 2,
    lockY: to.top + to.height / 2,
  };
}

async function beginUnlockWait() {
  const points = unlockPoints();
  if (!points || prefersReducedMotion()) return;
  document.body.style.setProperty("--lock-ox", `${(points.lockX / window.innerWidth) * 100}%`);
  document.body.style.setProperty("--lock-oy", `${(points.lockY / window.innerHeight) * 100}%`);
  unlockKey.hidden = false;
  unlockKey.style.left = `${points.startX}px`;
  unlockKey.style.top = `${points.startY}px`;
  document.body.classList.add("is-unlocking", "is-unlocking-wait");
  try {
    await unlockKey.animate(
      [
        { transform: "scale(1) rotate(0deg)" },
        { transform: "translateY(-24px) scale(1.35) rotate(-8deg)" },
      ],
      { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
    ).finished;
  } catch {
    /* animation canceled */
  }
}

function cancelUnlockWait() {
  if (unlockKey) unlockKey.hidden = true;
  document.body.classList.remove("is-unlocking", "is-unlocking-wait", "is-unlocked", "is-entering");
}

async function finishUnlockSequence() {
  const points = unlockPoints();
  if (!points || prefersReducedMotion()) return;
  document.body.classList.remove("is-unlocking-wait");
  const travelX = points.holeX - points.startX;
  const travelY = points.holeY - points.startY;
  try {
    await unlockKey.animate(
      [
        { transform: "translateY(-24px) scale(1.35) rotate(-8deg)", offset: 0 },
        {
          transform: `translate(${travelX}px, ${travelY * 0.72}px) scale(1.2) rotate(18deg)`,
          offset: 0.62,
        },
        {
          transform: `translate(${travelX}px, ${travelY}px) scale(1.05) rotate(90deg)`,
          offset: 1,
        },
      ],
      { duration: 1100, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
    ).finished;
  } catch {
    /* animation canceled */
  }
  document.body.classList.add("is-unlocked");
  await wait(240);
  document.body.classList.add("is-entering");
  await wait(900);
  unlockKey.hidden = true;
}

findInvite?.addEventListener("click", () => {
  findInvite.classList.remove("is-striking");
  void findInvite.offsetWidth;
  findInvite.classList.add("is-striking");
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (form.dataset.unlocking === "true") return;
  if (errorNode) errorNode.textContent = "";
  if (findInvite) {
    findInvite.disabled = true;
    findInvite.setAttribute("aria-busy", "true");
    findInvite.classList.add("is-loading");
  }
  form.dataset.unlocking = "true";
  const waiting = beginUnlockWait();
  try {
    const guest = await findGuestByName(form.firstName.value, form.lastName.value);
    await waiting;
    if (!guest) {
      cancelUnlockWait();
      if (errorNode) errorNode.textContent = missingMessage();
      return;
    }
    await finishUnlockSequence();
    showHousehold(guest);
    document.body.classList.add("is-revealing");
    document.body.classList.remove("is-unlocking", "is-unlocking-wait", "is-unlocked", "is-entering");
  } catch (error) {
    cancelUnlockWait();
    if (errorNode) {
      errorNode.textContent = error.ambiguous
        ? ambiguousMessage()
        : error.lookupError
          ? error.message
          : missingMessage();
    }
  } finally {
    form.dataset.unlocking = "false";
    if (findInvite && !document.body.classList.contains("is-open")) {
      findInvite.disabled = false;
      findInvite.removeAttribute("aria-busy");
      findInvite.classList.remove("is-loading");
    }
  }
});

fetch("/api/invite?warm=1").catch(() => {});

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
  const lift = Math.min(150, window.innerHeight * 0.18);
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
window.addEventListener("pageshow", (event) => {
  if (event.persisted) closeEnvelopes();
});
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
