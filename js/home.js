import { CONTACT_EMAIL, EVENTS, sortEvents } from "./config.js";
import { initHouseholdForm, openDetailsModal, closeDetailsModal } from "./form.js?v=party3";
import { hideKey3d, initKey3d, playKeyUnlock, resetKey3d } from "./key3d.js?v=k6";
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
  if (count === 1) return "have sent you an invitation.";
  return `have sent you ${count} invitations.`;
}

const ART_V = "7";
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

const openedEnvelopes = new Set();

function doorMarkup(eventKey, guest) {
  const event = EVENTS[eventKey];
  const art = ENVELOPE_ART[eventKey];
  if (!event || !art) return "";
  const invitedMembers = (guest.members || []).filter((member) => memberInvited(member, eventKey));
  if (!invitedMembers.length) return "";
  const region = event.region || event.place;
  return `
    <button type="button" class="event-door envelope-link${openedEnvelopes.has(eventKey) ? " is-opened" : ""}" data-envelope data-event="${eventKey}" aria-label="Open ${escapeHtml(event.shortTitle)}" aria-expanded="false">
      <span class="envelope envelope--${eventKey}" aria-hidden="true">
        <span class="envelope-stack">
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
                <span class="invite-sheet-soon">(Check back soon for more details!)</span>
                <span class="invite-sheet-close">Close Invite</span>
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
      </span>
      <span class="envelope-caption">
        <strong>${escapeHtml(event.shortTitle)}</strong>
        <em>${escapeHtml(region)}</em>
      </span>
    </button>
  `;
}

function showMonogramPng(show) {
  const img = document.querySelector(".monogram-key-png");
  if (img) img.hidden = !show;
}

function showHousehold(guest) {
  hideKey3d();
  showMonogramPng(true);
  rememberGuest(guest);
  document.body.classList.add("is-open");
  sealed.hidden = true;
  if (chooser) chooser.hidden = true;
  if (continuePanel) continuePanel.hidden = true;
  household.hidden = false;

  const greeting = document.querySelector("[data-household-greeting]");
  if (greeting) {
    greeting.textContent = guest.greeting ? `Dear ${guest.greeting},` : "";
    greeting.hidden = !guest.greeting;
  }

  const shown = sortEvents(guest.events)
    .filter((key) => key !== "shower")
    .filter((key) => doorMarkup(key, guest));
  const count = household.querySelector("[data-household-count]");
  if (count) count.textContent = countLabel(shown.length);
  startEnvelopeWiggle();

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

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function lockCenter() {
  const lockEl = document.querySelector(".lock");
  if (!lockEl) return null;
  const to = lockEl.getBoundingClientRect();
  return {
    lockX: to.left + to.width / 2,
    lockY: to.top + to.height / 2,
  };
}

function cancelUnlock() {
  showMonogramPng(false);
  resetKey3d();
  document.body.classList.remove("is-unlocking", "is-unlocked", "is-entering");
}

async function playUnlockSequence() {
  const center = lockCenter();
  if (prefersReducedMotion()) return true;
  if (center) {
    document.body.style.setProperty("--lock-ox", `${(center.lockX / window.innerWidth) * 100}%`);
    document.body.style.setProperty("--lock-oy", `${(center.lockY / window.innerHeight) * 100}%`);
  }
  document.body.classList.add("is-unlocking");
  const played = await playKeyUnlock();
  if (!played) return false;
  document.body.classList.add("is-unlocked");
  await wait(220);
  hideKey3d();
  document.body.classList.add("is-entering");
  await wait(900);
  return true;
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
  try {
    const guest = await findGuestByName(form.firstName.value, form.lastName.value);
    if (!guest) {
      if (errorNode) errorNode.textContent = missingMessage();
      return;
    }
    const played = await playUnlockSequence();
    if (!played) return;
    showHousehold(guest);
    document.body.classList.add("is-revealing");
    document.body.classList.remove("is-unlocking", "is-unlocked", "is-entering");
  } catch (error) {
    cancelUnlock();
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
}

let wiggleTimer = 0;

function nudgeClosedEnvelopes() {
  if (prefersReducedMotion()) return;
  if (household?.classList.contains("is-reading")) return;
  const closed = [...(household?.querySelectorAll("[data-envelope]:not(.is-opening):not(.is-selected):not(.is-opened)") || [])];
  closed.forEach((link, index) => {
    window.setTimeout(() => {
      if (household?.classList.contains("is-reading")) return;
      if (link.classList.contains("is-opening") || link.classList.contains("is-selected") || link.classList.contains("is-opened")) return;
      const env = link.querySelector(".envelope");
      if (!env) return;
      env.classList.remove("is-wiggling");
      void env.offsetWidth;
      env.classList.add("is-wiggling");
    }, index * 1000);
  });
}

let detailsConfirmed = sessionStorage.getItem("king.detailsConfirmed") === "1";

function markDetailsConfirmed() {
  detailsConfirmed = true;
  sessionStorage.setItem("king.detailsConfirmed", "1");
  household?.querySelector("[data-open-details]")?.classList.remove("is-wiggling");
}

document.addEventListener("king:details-saved", markDetailsConfirmed);

function allEnvelopesOpened() {
  const doors = [...(household?.querySelectorAll("[data-envelope]") || [])];
  return doors.length > 0 && doors.every((door) => door.classList.contains("is-opened"));
}

function nudgeDetailsButton() {
  if (prefersReducedMotion()) return;
  if (detailsConfirmed) return;
  if (!allEnvelopesOpened()) return;
  if (document.body.classList.contains("details-open")) return;
  const btn = household?.querySelector("[data-open-details]");
  if (!btn) return;
  btn.classList.remove("is-wiggling");
  void btn.offsetWidth;
  btn.classList.add("is-wiggling");
}

function runWiggleHints() {
  nudgeClosedEnvelopes();
  nudgeDetailsButton();
}

function startEnvelopeWiggle() {
  if (wiggleTimer) return;
  wiggleTimer = window.setInterval(runWiggleHints, 5000);
}

function closeEnvelopes() {
  household?.querySelectorAll("[data-envelope]").forEach((link) => {
    link.classList.remove("is-opening", "is-selected", "is-away");
    link.setAttribute("aria-expanded", "false");
    link.style.removeProperty("--focus-x");
    link.style.removeProperty("--focus-y");
    link.querySelector(".envelope")?.style.removeProperty("--letter-out-scale");
  });
  setReading(false);
  if (allEnvelopesOpened()) nudgeDetailsButton();
}

function letterViewportReserve() {
  return window.innerWidth < 640
    ? Math.min(220, window.innerHeight * 0.28)
    : Math.min(160, window.innerHeight * 0.2);
}

function fitLetterToViewport(link) {
  const envelope = link.querySelector(".envelope");
  const letter = link.querySelector(".envelope-letter");
  const art = link.querySelector(".envelope-letter-art") || letter;
  if (!envelope || !letter || !art) return;

  if (window.innerWidth >= 640) {
    envelope.style.removeProperty("--letter-out-scale");
    return;
  }

  envelope.style.setProperty("--letter-out-scale", "1");
  const previous = {
    animation: letter.style.animation,
    transform: letter.style.transform,
    opacity: letter.style.opacity,
  };
  letter.style.animation = "none";
  letter.style.opacity = "1";
  letter.style.transform = "translateY(var(--letter-out-y)) scale(1)";
  void letter.offsetWidth;
  const box = art.getBoundingClientRect();
  letter.style.animation = previous.animation;
  letter.style.transform = previous.transform;
  letter.style.opacity = previous.opacity;
  if (!box.width || !box.height) return;

  const scale = Math.min(
    (window.innerWidth - 28) / box.width,
    (window.innerHeight - letterViewportReserve()) / box.height,
    2.325
  );
  envelope.style.setProperty("--letter-out-scale", String(Math.max(scale, 0.4)));
}

function letterFocusDelta(link) {
  const letter = link.querySelector(".envelope-letter");
  const art = link.querySelector(".envelope-letter-art") || letter;
  if (!letter || !art) return null;
  const box = art.getBoundingClientRect();
  if (!box.width || !box.height) return null;
  const reserve = letterViewportReserve();
  const targetX = window.innerWidth / 2;
  const targetY = (window.innerHeight - reserve) / 2;
  return {
    x: targetX - (box.left + box.width / 2),
    y: targetY - (box.top + box.height / 2),
  };
}

function readFocus(link, name) {
  return Number.parseFloat(link.style.getPropertyValue(name)) || 0;
}

function centerOpenLetter(link) {
  const letter = link.querySelector(".envelope-letter");
  if (!letter) return;
  fitLetterToViewport(link);

  if (link.classList.contains("is-opening")) {
    const delta = letterFocusDelta(link);
    if (!delta) return;
    link.style.setProperty("--focus-x", `${readFocus(link, "--focus-x") + delta.x}px`);
    link.style.setProperty("--focus-y", `${readFocus(link, "--focus-y") + delta.y}px`);
    return;
  }

  const previous = {
    animation: letter.style.animation,
    transform: letter.style.transform,
    opacity: letter.style.opacity,
  };
  letter.style.animation = "none";
  letter.style.opacity = "1";
  letter.style.transform = "translateY(var(--letter-out-y)) scale(var(--letter-out-scale))";
  void letter.offsetWidth;
  const delta = letterFocusDelta(link);
  letter.style.animation = previous.animation;
  letter.style.transform = previous.transform;
  letter.style.opacity = previous.opacity;
  if (!delta) return;
  link.style.setProperty("--focus-x", `${delta.x}px`);
  link.style.setProperty("--focus-y", `${delta.y}px`);
}

household?.addEventListener("click", (event) => {
  if (event.button !== 0) return;
  if (event.target.closest(".invite-sheet-close")) {
    event.preventDefault();
    closeEnvelopes();
    return;
  }
  const link = event.target.closest("[data-envelope]");
  if (!link) return;
  if (link.classList.contains("is-opening")) {
    if (event.target.closest(".envelope-letter")) return;
    closeEnvelopes();
    return;
  }
  household.querySelectorAll("[data-envelope]").forEach((other) => {
    other.classList.toggle("is-selected", other === link);
    other.classList.toggle("is-away", other !== link);
    other.setAttribute("aria-expanded", other === link ? "true" : "false");
  });
  setReading(true);
  centerOpenLetter(link);
  link.classList.add("is-opening", "is-opened");
  if (link.dataset.event) openedEnvelopes.add(link.dataset.event);
});

document.addEventListener("click", (event) => {
  if (event.button !== 0) return;
  if (!household?.classList.contains("is-reading")) return;
  if (detailsModal && !detailsModal.hidden) return;
  if (event.target.closest(".envelope-letter, .household-mail, [data-details-modal], [data-envelope]")) return;
  closeEnvelopes();
});

window.addEventListener("pagehide", closeEnvelopes);
window.addEventListener("pageshow", (event) => {
  if (event.persisted) closeEnvelopes();
});
window.addEventListener("resize", () => {
  const open = household?.querySelector(".envelope-link.is-opening");
  if (open) centerOpenLetter(open);
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
  openedEnvelopes.clear();
  detailsConfirmed = false;
  sessionStorage.removeItem("king.detailsConfirmed");
  clearGuest();
  window.location.assign("/");
});

const params = new URLSearchParams(window.location.search);
const stored = readStoredGuest();
if (params.get("code") || params.get("gate") || stored) {
  hideKey3d();
  if (stored) showHousehold(stored);
  const returning = await resolveGuest();
  if (returning) showHousehold(returning);
  else if (!stored && params.get("code") && errorNode) errorNode.textContent = missingMessage();
  document.documentElement.classList.remove("invite-returning");
} else {
  initKey3d();
}
