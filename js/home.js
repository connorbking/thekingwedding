import { CONTACT_EMAIL, EVENTS, sortEvents } from "./config.js?v=cal1";
import { initHouseholdForm, openDetailsModal, closeDetailsModal } from "./form.js?v=party25";
import { hideKey3d, initKey3d, playKeyUnlock, resetKey3d } from "./key3d.js?v=k6";
import {
  findGuest,
  findGuestByName,
  resolveGuest,
  readStoredGuest,
  rememberGuest,
  markResetHome,
  consumeResetHome,
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

const ART_V = "8";
const artUrl = (file) => `/public/envelopes/${file}?v=${ART_V}`;
const ENVELOPE_ART = {
  como: {
    body: artUrl("olive-env.png"),
    closedFlap: artUrl("olive-env-closed-flap.png"),
    openFlap: artUrl("olive-env-open-flap.png"),
    opened: artUrl("open-olive.png"),
    seal: artUrl("olive-seal.png"),
    sealBroken: artUrl("olive-seal-broken.png"),
    letter: artUrl("letter-insert1.png"),
  },
  jersey: {
    body: artUrl("red-env.png"),
    closedFlap: artUrl("red-env-closed-flap.png"),
    openFlap: artUrl("red-env-open-flap.png"),
    opened: artUrl("open-red.png"),
    seal: artUrl("red-seal.png"),
    sealBroken: artUrl("red-seal-broken.png"),
    letter: artUrl("letter-insert2.png"),
  },
  shower: {
    body: artUrl("cream-env.png"),
    closedFlap: artUrl("cream-env-closed-flap.png"),
    openFlap: artUrl("cream-env-open-flap.png"),
    opened: artUrl("cream-open.png"),
    seal: artUrl("cream-seal.png"),
    sealBroken: artUrl("cream-seal-broken.png"),
    letter: artUrl("letter-insert3.png"),
  },
};

const openedEnvelopes = new Set();
let openTimer = 0;

function doorMarkup(eventKey, guest) {
  const event = EVENTS[eventKey];
  const art = ENVELOPE_ART[eventKey];
  if (!event || !art) return "";
  const invitedMembers = (guest.members || []).filter((member) => memberInvited(member, eventKey));
  if (!invitedMembers.length) return "";
  const region = event.region || event.place;
  return `
    <div class="event-door envelope-link${openedEnvelopes.has(eventKey) ? " is-opened" : ""}" data-envelope data-event="${eventKey}" role="button" tabindex="0" aria-label="Open ${escapeHtml(event.shortTitle)}" aria-expanded="false">
      <span class="envelope envelope--${eventKey}">
        <span class="envelope-stack">
          <img class="envelope-open-flap" src="${art.openFlap}" alt="">
          <span class="envelope-sleeve">
            <span class="envelope-letter">
              <img class="envelope-letter-art" src="${art.letter}" alt="">
            </span>
          </span>
          <span class="envelope-crop">
            <img class="envelope-body" src="${art.body}" alt="">
            <img class="envelope-closed-flap" src="${art.closedFlap}" alt="">
            <img class="envelope-seal" src="${art.seal}" alt="">
            <img class="envelope-seal envelope-seal--broken" src="${art.sealBroken}" alt="">
          </span>
          <span class="envelope-open-scene">
            <button type="button" class="invite-sheet-close" aria-label="Close invitation">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18"></path>
              </svg>
            </button>
            <img class="envelope-opened" src="${art.opened}" alt="">
            <span class="invite-sheet">
              <span class="invite-sheet-head">
                <span class="invite-sheet-script">Save the Date</span>
              </span>
              <span class="invite-sheet-body">
                <span class="invite-sheet-names">Alyssa &amp; Connor</span>
                <span class="invite-sheet-rule"></span>
                <span class="invite-sheet-meta">${escapeHtml(event.weekday)}</span>
                <span class="invite-sheet-meta">${escapeHtml(event.display)}</span>
                <span class="invite-sheet-meta">${escapeHtml(event.place)}</span>
                ${event.calendar ? `<a class="invite-sheet-calendar" href="${escapeHtml(event.calendar)}" download><svg class="invite-sheet-calendar-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="15" rx="1.5"></rect><path d="M8 3.5v4M16 3.5v4M3.5 10.5h17"></path></svg>Add to Calendar</a>` : ""}
              </span>
            </span>
          </span>
        </span>
      </span>
      <span class="envelope-caption">
        <strong>${escapeHtml(event.shortTitle)}</strong>
        <em>${escapeHtml(region)}</em>
      </span>
    </div>
  `;
}

function showMonogramPng(show) {
  const img = document.querySelector(".monogram-key-png");
  if (img) img.hidden = !show;
}

const INVITE_SLIDE_MS = 8000;
const INVITE_ARROWS_ENABLED = false;
const INVITE_BG_MOBILE = window.matchMedia("(max-width: 799px)");
let inviteSlideTimer = 0;
let inviteSlideIndex = 0;
let inviteSlideBusy = false;
let inviteBgUrls = null;
let inviteBgPromise = null;
const preloadedImages = new Map();

function inviteBgSet() {
  return INVITE_BG_MOBILE.matches ? "invite-bg-mobile" : "invite-bg";
}

function preloadImage(url) {
  if (!url) return Promise.resolve();
  if (preloadedImages.has(url)) return preloadedImages.get(url);
  const done = new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    const finish = () => {
      if (typeof img.decode === "function") {
        img.decode().then(() => resolve(url), () => resolve(url));
        return;
      }
      resolve(url);
    };
    img.addEventListener("load", finish);
    img.addEventListener("error", () => resolve(url));
    img.src = url;
  });
  preloadedImages.set(url, done);
  return done;
}

async function listInviteBgFiles(folder) {
  const bust = Date.now();
  const jsonName = folder === "invite-bg-mobile" ? "invite-bg-mobile.json" : "invite-bg.json";
  const variant = folder === "invite-bg-mobile" ? "mobile" : "desktop";
  const endpoints = [`/public/${jsonName}?t=${bust}`, `/api/invite-bg?variant=${variant}&t=${bust}`];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) continue;
      const data = await response.json();
      const files = Array.isArray(data) ? data : data.files;
      const urls = (Array.isArray(files) ? files : [])
        .map((file) => String(file || "").trim())
        .filter(Boolean)
        .map((file) => `/public/${folder}/${file.replace(/^.*\//, "")}`);
      if (urls.length) return urls;
    } catch {
      /* try the next source */
    }
  }
  return [];
}

async function discoverInviteBgs() {
  if (inviteBgUrls) return inviteBgUrls;
  if (!inviteBgPromise) {
    inviteBgPromise = (async () => {
      const folder = inviteBgSet();
      let urls = await listInviteBgFiles(folder);
      if (!urls.length && folder === "invite-bg-mobile") urls = await listInviteBgFiles("invite-bg");
      inviteBgUrls = urls;
      if (urls[0]) preloadImage(urls[0]);
      if (urls[1]) preloadImage(urls[1]);
      return urls;
    })();
  }
  return inviteBgPromise;
}

function resetInviteBgCache() {
  inviteBgUrls = null;
  inviteBgPromise = null;
}

function inviteNav() {
  return document.querySelector("[data-invite-nav]");
}

function setInviteNavVisible(show) {
  const nav = inviteNav();
  if (nav) nav.hidden = !INVITE_ARROWS_ENABLED || !show;
}

function stopInviteTimer() {
  window.clearInterval(inviteSlideTimer);
  inviteSlideTimer = 0;
}

function restartInviteTimer(slides) {
  stopInviteTimer();
  const count = slides?.querySelectorAll(".invite-slide").length || 0;
  if (count < 2 || prefersReducedMotion()) return;
  inviteSlideTimer = window.setInterval(() => {
    showInviteSlide(slides, inviteSlideIndex + 1);
  }, INVITE_SLIDE_MS);
}

function stopInviteSlideshow() {
  stopInviteTimer();
  inviteSlideBusy = false;
  inviteSlideIndex = 0;
  setInviteNavVisible(false);
  const slides = document.querySelector("[data-invite-slides]");
  if (slides) {
    slides.hidden = true;
    slides.replaceChildren();
    delete slides.dataset.urls;
  }
}

function stepInviteSlide(delta) {
  const slides = document.querySelector("[data-invite-slides]");
  if (!slides || slides.hidden) return;
  showInviteSlide(slides, inviteSlideIndex + delta);
  restartInviteTimer(slides);
}

function bindInviteNav() {
  const nav = inviteNav();
  if (!nav || nav.dataset.bound) return;
  nav.dataset.bound = "1";
  nav.querySelector("[data-invite-prev]")?.addEventListener("click", (event) => {
    event.preventDefault();
    stepInviteSlide(-1);
  });
  nav.querySelector("[data-invite-next]")?.addEventListener("click", (event) => {
    event.preventDefault();
    stepInviteSlide(1);
  });
}

function slideReady(img) {
  return Boolean(img?.complete && img.naturalWidth);
}

function preloadSlide(frame) {
  if (frame?.dataset.src) frame.src = frame.dataset.src;
}

function whenSlideReady(img) {
  return new Promise((resolve) => {
    if (slideReady(img)) {
      resolve(true);
      return;
    }
    if (!img) {
      resolve(false);
      return;
    }
    const done = () => {
      img.removeEventListener("load", done);
      img.removeEventListener("error", done);
      resolve(slideReady(img));
    };
    img.addEventListener("load", done);
    img.addEventListener("error", done);
  });
}

async function showInviteSlide(slides, index) {
  const frames = [...slides.querySelectorAll(".invite-slide")];
  if (!frames.length || inviteSlideBusy) return;
  const target = ((index % frames.length) + frames.length) % frames.length;
  const current = frames[target];
  preloadSlide(current);
  preloadSlide(frames[(target + 1) % frames.length]);
  preloadSlide(frames[(target - 1 + frames.length) % frames.length]);
  inviteSlideBusy = true;
  const ready = await whenSlideReady(current);
  inviteSlideBusy = false;
  if (!ready) {
    if (frames.length > 1) showInviteSlide(slides, target + 1);
    return;
  }
  inviteSlideIndex = target;
  frames.forEach((frame, i) => {
    frame.classList.toggle("is-active", i === inviteSlideIndex);
  });
}

async function startInviteSlideshow() {
  const slides = document.querySelector("[data-invite-slides]");
  if (!slides) return;
  stopInviteTimer();
  const urls = await discoverInviteBgs();
  if (!urls.length) {
    slides.hidden = true;
    slides.replaceChildren();
    delete slides.dataset.urls;
    return;
  }
  await preloadImage(urls[0]);
  const signature = urls.join("|");
  if (slides.dataset.urls !== signature) {
    slides.replaceChildren(
      ...urls.map((url, index) => {
        const img = document.createElement("img");
        img.className = "invite-slide";
        img.alt = "";
        img.dataset.src = url;
        if (index <= 1) img.src = url;
        if (index === 0) img.classList.add("is-active");
        return img;
      }),
    );
    slides.dataset.urls = signature;
  }
  const first = slides.querySelector(".invite-slide");
  if (first) {
    preloadSlide(first);
    await whenSlideReady(first);
  }
  slides.hidden = false;
  inviteSlideIndex = 0;
  setInviteNavVisible(urls.length > 1);
  bindInviteNav();
  if (document.body.classList.contains("is-open")) restartInviteTimer(slides);
}

INVITE_BG_MOBILE.addEventListener("change", () => {
  resetInviteBgCache();
  if (document.body.classList.contains("is-open")) startInviteSlideshow();
});

async function showHousehold(guest) {
  hideKey3d();
  showMonogramPng(true);
  rememberGuest(guest);
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
  shown.forEach((key) => {
    const src = ENVELOPE_ART[key]?.opened;
    if (!src) return;
    const preload = new Image();
    preload.src = src;
  });
  const count = household.querySelector("[data-household-count]");
  if (count) count.textContent = countLabel(shown.length);
  startEnvelopeWiggle();

  const doors = household.querySelector("[data-event-doors]");
  const nextKey = shown.join("|");
  const envelopeOpen = Boolean(household.querySelector("[data-envelope].is-opening, [data-envelope].is-selected"));
  const alreadyShown = Boolean(doors?.dataset.doors && doors.dataset.doors === nextKey);

  if (doors && !envelopeOpen && !alreadyShown) {
    doors.innerHTML = shown.map((key) => doorMarkup(key, guest)).join("");
    doors.dataset.doors = nextKey;
    setReading(false);
  }

  if (householdForm) {
    initHouseholdForm({ guest, form: householdForm });
  }

  await startInviteSlideshow();
  document.body.classList.add("is-open");
  restartInviteTimer(document.querySelector("[data-invite-slides]"));
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

function preloadInviteAssets(guest) {
  const keys = sortEvents(guest.events)
    .filter((key) => key !== "shower")
    .filter((key) => doorMarkup(key, guest));
  keys.forEach((key) => {
    const art = ENVELOPE_ART[key];
    if (!art) return;
    Object.values(art).forEach((src) => {
      if (typeof src !== "string") return;
      const img = new Image();
      img.src = src;
    });
  });
  discoverInviteBgs();
}

function cancelUnlock() {
  showMonogramPng(false);
  resetKey3d();
  hideIntroVideo();
  document.body.classList.remove("is-unlocking", "is-unlocked", "is-entering", "is-intro", "is-revealing");
}

function hideIntroVideo() {
  const wrap = document.querySelector("[data-intro-video]");
  const video = wrap?.querySelector("video");
  if (video) {
    video.pause();
    video.currentTime = 0;
  }
  if (wrap) wrap.hidden = true;
  document.body.classList.remove("is-intro");
}

function playIntroVideo() {
  const wrap = document.querySelector("[data-intro-video]");
  const video = wrap?.querySelector("video");
  if (!wrap || !video || prefersReducedMotion()) return Promise.resolve();
  wrap.hidden = false;
  document.body.classList.add("is-intro");
  video.muted = false;
  video.currentTime = 0;
  return video
    .play()
    .then(
      () =>
        new Promise((resolve) => {
          const done = () => {
            video.removeEventListener("ended", done);
            video.removeEventListener("error", done);
            resolve();
          };
          video.addEventListener("ended", done);
          video.addEventListener("error", done);
        }),
    )
    .catch(() => {})
    .finally(() => {
      hideIntroVideo();
    });
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
  const intro = playIntroVideo();
  const slides = startInviteSlideshow();
  await intro;
  await slides;
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
    preloadInviteAssets(guest);
    const played = await playUnlockSequence();
    if (!played) return;
    await showHousehold(guest);
    document.body.classList.add("is-revealing");
    document.body.classList.remove("is-unlocking", "is-unlocked", "is-entering");
    if (!prefersReducedMotion()) await wait(1500);
    document.body.classList.remove("is-revealing");
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
discoverInviteBgs();

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
  window.clearTimeout(openTimer);
  openTimer = 0;
  household?.querySelectorAll("[data-envelope]").forEach((link) => {
    link.classList.remove("is-opening", "is-selected", "is-away");
    link.setAttribute("aria-expanded", "false");
    link.style.removeProperty("--focus-x");
    link.style.removeProperty("--focus-y");
  });
  setReading(false);
  if (allEnvelopesOpened()) nudgeDetailsButton();
}

function openViewportReserve() {
  return window.innerWidth < 640
    ? Math.min(96, window.innerHeight * 0.1)
    : Math.min(48, window.innerHeight * 0.06);
}

function readFocus(link, name) {
  return Number.parseFloat(link.style.getPropertyValue(name)) || 0;
}

function openSceneBox(link) {
  const scene = link.querySelector(".envelope-open-scene");
  if (!scene) return null;
  const previous = {
    animation: scene.style.animation,
    transform: scene.style.transform,
    opacity: scene.style.opacity,
  };
  scene.style.animation = "none";
  scene.style.opacity = "1";
  scene.style.transform = `translateX(-50%) scale(${getComputedStyle(scene).getPropertyValue("--open-letter-scale").trim() || 1})`;
  void scene.offsetWidth;
  const box = scene.getBoundingClientRect();
  scene.style.animation = previous.animation;
  scene.style.transform = previous.transform;
  scene.style.opacity = previous.opacity;
  return box.width && box.height ? box : null;
}

function viewportCenter() {
  const reserve = openViewportReserve();
  return {
    x: window.innerWidth / 2,
    y: (window.innerHeight - reserve) / 2,
  };
}

function centerClosedEnvelope(link) {
  const crop = link.querySelector(".envelope-crop");
  const box = crop?.getBoundingClientRect();
  if (!box?.width || !box.height) return;
  const target = viewportCenter();
  link.style.setProperty("--focus-x", `${readFocus(link, "--focus-x") + (target.x - (box.left + box.width / 2))}px`);
  link.style.setProperty("--focus-y", `${readFocus(link, "--focus-y") + (target.y - (box.top + box.height / 2))}px`);
}

function centerOpenLetter(link) {
  const box = openSceneBox(link);
  if (!box) return;
  const target = viewportCenter();
  const deltaX = target.x - (box.left + box.width / 2);
  const deltaY = target.y - (box.top + box.height / 2);
  if (link.classList.contains("is-opening") || link.classList.contains("is-selected")) {
    link.style.setProperty("--focus-x", `${readFocus(link, "--focus-x") + deltaX}px`);
    link.style.setProperty("--focus-y", `${readFocus(link, "--focus-y") + deltaY}px`);
    return;
  }
  link.style.setProperty("--focus-x", `${deltaX}px`);
  link.style.setProperty("--focus-y", `${deltaY}px`);
}

function beginOpen(link) {
  if (!link.classList.contains("is-selected")) return;
  link.classList.add("is-opening", "is-opened");
  if (link.dataset.event) openedEnvelopes.add(link.dataset.event);
  requestAnimationFrame(() => centerOpenLetter(link));
}

household?.addEventListener("keydown", (event) => {
  if (event.target.closest(".invite-sheet-calendar")) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  const link = event.target.closest("[data-envelope]");
  if (!link || event.target !== link) return;
  event.preventDefault();
  link.click();
});

household?.addEventListener("click", (event) => {
  if (event.button !== 0) return;
  if (event.target.closest(".invite-sheet-calendar")) return;
  if (event.target.closest(".invite-sheet-close, [data-close-letter]")) {
    event.preventDefault();
    event.stopPropagation();
    closeEnvelopes();
    return;
  }
  const link = event.target.closest("[data-envelope]");
  if (!link) return;
  if (link.classList.contains("is-opening") || link.classList.contains("is-selected")) {
    if (event.target.closest(".envelope-letter, .envelope-open-scene")) return;
    closeEnvelopes();
    return;
  }
  household.querySelectorAll("[data-envelope]").forEach((other) => {
    other.classList.toggle("is-selected", other === link);
    other.classList.toggle("is-away", other !== link);
    other.setAttribute("aria-expanded", other === link ? "true" : "false");
  });
  setReading(true);
  if (prefersReducedMotion()) {
    beginOpen(link);
    return;
  }
  requestAnimationFrame(() => {
    centerClosedEnvelope(link);
    window.clearTimeout(openTimer);
    openTimer = window.setTimeout(() => beginOpen(link), 780);
  });
});

document.addEventListener("click", (event) => {
  if (event.button !== 0) return;
  if (!household?.classList.contains("is-reading")) return;
  if (detailsModal && !detailsModal.hidden) return;
  if (event.target.closest("[data-not-you]")) return;
  if (event.target.closest(".envelope-letter, .envelope-open-scene, .household-mail, [data-details-modal], [data-envelope]")) return;
  closeEnvelopes();
});

window.addEventListener("pagehide", closeEnvelopes);
window.addEventListener("pageshow", (event) => {
  if (event.persisted) closeEnvelopes();
});
window.addEventListener("resize", () => {
  const selected = household?.querySelector(".envelope-link.is-selected");
  if (!selected) return;
  if (selected.classList.contains("is-opening")) centerOpenLetter(selected);
  else centerClosedEnvelope(selected);
});

document.querySelectorAll("[data-open-details]").forEach((el) => {
  el.addEventListener("click", () => openDetailsModal(detailsModal));
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
  if (household?.querySelector(".is-opening, .is-selected")) closeEnvelopes();
});

function resetToLock() {
  openedEnvelopes.clear();
  detailsConfirmed = false;
  markResetHome();
  document.documentElement.classList.remove("invite-returning");
  closeEnvelopes();
  closeDetailsModal(detailsModal);
  stopInviteSlideshow();
  window.clearInterval(wiggleTimer);
  wiggleTimer = 0;
  if (household) household.hidden = true;
  if (sealed) sealed.hidden = false;
  document.body.classList.remove(
    "is-open",
    "is-revealing",
    "is-unlocking",
    "is-unlocked",
    "is-entering",
    "is-intro",
    "details-open",
  );
  hideIntroVideo();
  showMonogramPng(false);
  const home = new URL("/", window.location.origin);
  if (
    window.location.pathname === home.pathname &&
    window.location.search === "" &&
    window.location.hash === ""
  ) {
    window.location.reload();
    return;
  }
  window.location.replace(home.href);
}

document.querySelectorAll("[data-not-you]").forEach((el) => {
  el.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    resetToLock();
  });
});

const params = new URLSearchParams(window.location.search);
if (consumeResetHome()) {
  document.documentElement.classList.remove("invite-returning");
}
const stored = readStoredGuest();
if (params.get("code") || params.get("gate") || stored) {
  hideKey3d();
  if (stored) await showHousehold(stored);
  const returning = await resolveGuest();
  if (returning) await showHousehold(returning);
  else if (!stored && params.get("code") && errorNode) errorNode.textContent = missingMessage();
  document.documentElement.classList.remove("invite-returning");
} else {
  initKey3d();
}
