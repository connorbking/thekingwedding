import { CONTACT_EMAIL, EVENTS, sortEvents } from "./config.js?v=cal1";
import { initHouseholdForm, openDetailsModal, closeDetailsModal } from "./form.js?v=party31";
import { hideKey3d, initKey3d, playKeyUnlock, resetKey3d } from "./key3d.js?v=k7";
import {
  findGuest,
  findGuestByName,
  resolveGuest,
  readStoredGuest,
  rememberGuest,
  markResetHome,
  consumeResetHome,
  eventHref,
} from "./guests.js?v=fresh1";

const sealed = document.querySelector("[data-sealed]");
const chooser = document.querySelector("[data-chooser]");
const continuePanel = document.querySelector("[data-continue]");
const household = document.querySelector("[data-household]");
const form = document.querySelector("[data-code-form]");
const householdForm = document.querySelector("[data-household-form]");
const detailsModal = document.querySelector("[data-details-modal]");
const errorNode = document.querySelector("[data-code-error]");

let nameAdvanceTimer = 0;

function focusNextEmptyName(from) {
  const fields = [form.firstName, form.lastName];
  const next = fields.slice(fields.indexOf(from) + 1).find((field) => !field.value.trim());
  if (next) next.focus();
}

function queueNameAdvance(from) {
  window.clearTimeout(nameAdvanceTimer);
  nameAdvanceTimer = window.setTimeout(() => {
    if (form.dataset.unlocking === "true") return;
    focusNextEmptyName(from);
  }, 0);
}

[form.firstName, form.lastName].forEach((field) => {
  field.addEventListener("input", (event) => {
    const bulk =
      event.inputType === "insertReplacementText" ||
      event.inputType === "insertFromAutocomplete" ||
      event.inputType === "insertFromPaste" ||
      event.inputType === "insertFromDrop" ||
      (event.data || "").length > 1;
    if (bulk) queueNameAdvance(field);
  });
  field.addEventListener("animationstart", (event) => {
    if (event.animationName === "name-autofill") queueNameAdvance(field);
  });
});

function nameFieldMessage() {
  const first = form.firstName.value.trim();
  const last = form.lastName.value.trim();
  form.firstName.classList.toggle("is-invalid", !first);
  form.lastName.classList.toggle("is-invalid", !last);
  if (!first && !last) return "Please enter your first and last name.";
  if (!first) return "Please enter your first name.";
  if (!last) return "Please enter your last name.";
  return "";
}

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

const ART_V = "10";
const artUrl = (file) => `/public/envelopes/${file}?v=${ART_V}`;
const ENVELOPE_ART = {
  como: {
    closed: artUrl("env-closed-olive.png"),
    saveTheDate: artUrl("letter-olive-save-the-date-env.png"),
    invite: artUrl("letter-olive-youre-invited-env.png"),
    seal: artUrl("olive-seal.png"),
    sealBroken: artUrl("olive-seal-broken.png"),
  },
  jersey: {
    closed: artUrl("env-closed-red.png"),
    saveTheDate: artUrl("letter-red-save-the-date-env.png"),
    invite: artUrl("letter-red-youre-invited-env.png"),
    seal: artUrl("red-seal.png"),
    sealBroken: artUrl("red-seal-broken.png"),
  },
  shower: {
    closed: artUrl("env-closed-cream.png"),
    saveTheDate: artUrl("letter-cream-save-the-date-env.png"),
    invite: artUrl("letter-cream-youre-invited-env.png"),
    seal: artUrl("cream-seal.png"),
    sealBroken: artUrl("cream-seal-broken.png"),
  },
};

const EVENT_SETTING_KEYS = ["shower", "como", "jersey"];

function defaultEventSettings() {
  return Object.fromEntries(EVENT_SETTING_KEYS.map((key) => [key, { visible: true, invite: false }]));
}

let eventSettings = defaultEventSettings();

async function loadEventSettings() {
  const next = defaultEventSettings();
  try {
    const response = await fetch("/api/event-settings", { cache: "no-store" });
    const data = await response.json();
    EVENT_SETTING_KEYS.forEach((key) => {
      const row = data.events?.[key];
      if (!row) return;
      next[key] = {
        visible: row.visible !== false,
        invite: row.invite === true,
      };
    });
  } catch {
    // Keep the save-the-date envelopes visible if the switches cannot be read.
  }
  eventSettings = next;
}

function envelopeShown(eventKey) {
  return eventSettings[eventKey]?.visible !== false;
}

function inviteMode(eventKey) {
  return eventSettings[eventKey]?.invite === true;
}

function letterSrc(eventKey) {
  const art = ENVELOPE_ART[eventKey];
  if (!art) return "";
  return inviteMode(eventKey) ? art.invite : art.saveTheDate;
}

const openedEnvelopes = new Set();
let openTimer = 0;

function sheetActions(eventKey, guest, event) {
  if (inviteMode(eventKey)) {
    return `<a class="invite-sheet-calendar invite-sheet-open" href="${escapeHtml(eventHref(eventKey, guest.code))}">Open Event</a>`;
  }
  const calendar = event.calendar
    ? `<a class="invite-sheet-calendar" href="${escapeHtml(event.calendar)}" download><svg class="invite-sheet-calendar-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="15" rx="1.5"></rect><path d="M8 3.5v4M16 3.5v4M3.5 10.5h17"></path></svg>Add to Calendar</a>`
    : "";
  return `${calendar}<span class="invite-sheet-soon">Check back soon for more details!</span>`;
}

function doorMarkup(eventKey, guest) {
  const event = EVENTS[eventKey];
  const art = ENVELOPE_ART[eventKey];
  if (!event || !art || !envelopeShown(eventKey)) return "";
  const invitedMembers = (guest.members || []).filter((member) => memberInvited(member, eventKey));
  if (!invitedMembers.length) return "";
  const region = event.region || event.place;
  return `
    <div class="event-door envelope-link${openedEnvelopes.has(eventKey) ? " is-opened" : ""}" data-envelope data-event="${eventKey}" role="button" tabindex="0" aria-label="Open ${escapeHtml(event.shortTitle)}" aria-expanded="false">
      <span class="envelope envelope--${eventKey}">
        <span class="envelope-stack">
          <span class="envelope-crop">
            <img class="envelope-body" src="${art.closed}" alt="">
            <img class="envelope-seal" src="${art.seal}" alt="">
            <img class="envelope-seal envelope-seal--broken" src="${art.sealBroken}" alt="">
          </span>
          <span class="envelope-open-scene">
            <span class="letter-frame">
            <img class="envelope-opened" src="${letterSrc(eventKey)}" alt="">
            <span class="invite-sheet">
              <button type="button" class="invite-sheet-back" data-close-letter aria-label="Close">&times;</button>
              <span class="invite-sheet-actions">
                ${sheetActions(eventKey, guest, event)}
              </span>
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
  const jsonName = folder === "invite-bg-mobile" ? "invite-bg-mobile.json" : "invite-bg.json";
  const variant = folder === "invite-bg-mobile" ? "mobile" : "desktop";
  const endpoints = [`/public/${jsonName}`, `/api/invite-bg?variant=${variant}`];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
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

let inviteAdvanceTimer = 0;

function stopInviteTimer() {
  window.clearInterval(inviteSlideTimer);
  inviteSlideTimer = 0;
  window.clearTimeout(inviteAdvanceTimer);
  inviteAdvanceTimer = 0;
}

function armInviteAdvance(openedAt) {
  const slides = document.querySelector("[data-invite-slides]");
  const delay = Math.max(0, INVITE_SLIDE_MS - (performance.now() - openedAt));
  window.clearTimeout(inviteAdvanceTimer);
  inviteAdvanceTimer = window.setTimeout(() => {
    inviteAdvanceTimer = 0;
    if (!document.body.classList.contains("is-open") || !slides || slides.hidden) return;
    showInviteSlide(slides, inviteSlideIndex + 1);
    restartInviteTimer(slides);
  }, delay);
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

async function showHousehold(guest, { arrive = false } = {}) {
  await loadEventSettings();
  hideKey3d();
  const staging = arrive && !prefersReducedMotion();
  document.body.classList.toggle("is-arriving", staging);
  showMonogramPng(!staging);
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
    .filter((key) => doorMarkup(key, guest));
  shown.forEach((key) => {
    const src = letterSrc(key);
    if (!src) return;
    const preload = new Image();
    preload.src = src;
  });
  const count = household.querySelector("[data-household-count]");
  if (count) count.textContent = countLabel(shown.length);
  startEnvelopeWiggle();

  const doors = household.querySelector("[data-event-doors]");
  const nextKey = shown.map((key) => `${key}:${inviteMode(key) ? "invite" : "date"}`).join("|");
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
  if (!document.body.classList.contains("is-arriving")) {
    restartInviteTimer(document.querySelector("[data-invite-slides]"));
  }
}

function wipeLine(el) {
  if (!el || el.hidden || !el.textContent.trim()) return false;
  el.classList.add("is-written");
  return true;
}

async function playArrival() {
  showMonogramPng(true);
  document.querySelector(".monogram")?.classList.add("is-written");
  await wait(700);
  await wait(220);
  if (wipeLine(document.querySelector("[data-household-greeting]"))) await wait(700);
  await wait(220);
  if (wipeLine(document.querySelector(".names-invited"))) await wait(700);
  document.body.classList.remove("is-revealing");
  document.body.classList.add("is-arrived-doors");
  await wait(900);
  document.body.classList.add("is-arrived-mail");
  await wait(700);
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
    .filter((key) => doorMarkup(key, guest));
  keys.forEach((key) => {
    const art = ENVELOPE_ART[key];
    if (!art) return;
    [art.closed, art.seal, art.sealBroken, letterSrc(key)].forEach((src) => {
      if (typeof src !== "string") return;
      const img = new Image();
      img.src = src;
    });
  });
}

function cancelUnlock() {
  showMonogramPng(false);
  resetKey3d();
  hideIntroVideo();
  stopSong();
  document.body.classList.remove("is-unlocking", "is-unlocked", "is-entering", "is-intro", "is-revealing");
}

const song = document.querySelector("[data-song]");
const songToggle = document.querySelector("[data-song-toggle]");

function setSongMuted(muted) {
  if (!song || !songToggle) return;
  song.muted = muted;
  songToggle.classList.toggle("is-muted", muted);
  songToggle.setAttribute("aria-pressed", muted ? "true" : "false");
  songToggle.setAttribute("aria-label", muted ? "Unmute music" : "Mute music");
}

function hideSongToggle() {
  if (songToggle) songToggle.hidden = true;
}

function stopSong() {
  if (!song) return;
  song.pause();
  song.currentTime = 0;
  hideSongToggle();
}

function songSource() {
  if (!song) return "";
  return (INVITE_BG_MOBILE.matches && song.dataset.srcMobile) || song.dataset.src || "";
}

function songUses(src) {
  if (!song || !src) return false;
  const current = song.getAttribute("src") || song.src;
  if (!current) return false;
  try {
    return new URL(current, location.href).pathname === new URL(src, location.href).pathname;
  } catch {
    return current === src;
  }
}

function assignSongSource() {
  const src = songSource();
  if (!src || songUses(src)) return;
  song.src = src;
}

function playSong() {
  if (!song || prefersReducedMotion()) return;
  assignSongSource();
  setSongMuted(false);
  if (songToggle) songToggle.hidden = false;
  const pending = song.play();
  if (pending) {
    pending.catch(() => {
      if (songToggle) songToggle.hidden = false;
    });
  }
}

function startSong() {
  if (!song || prefersReducedMotion()) return;
  if (!song.paused && songUses(songSource())) {
    setSongMuted(false);
    if (songToggle) songToggle.hidden = false;
    return;
  }
  playSong();
}

song?.addEventListener("ended", hideSongToggle);
songToggle?.addEventListener("click", () => {
  if (!song) return;
  if (song.paused) {
    startSong();
    return;
  }
  setSongMuted(!song.muted);
});

function hideIntroVideo() {
  const wrap = document.querySelector("[data-intro-video]");
  const video = wrap?.querySelector("video");
  if (video) {
    video.pause();
    try {
      if (video.readyState >= 1) video.currentTime = 0;
    } catch {
      /* Some phones reject a seek before the first frame exists. */
    }
  }
  if (wrap) wrap.hidden = true;
  document.body.classList.remove("is-intro");
}

let introVideoReady = null;

function primeIntroFrame() {
  const frame = document.querySelector(".intro-video-frame");
  if (!frame || frame.getAttribute("src")) return;
  const src = (INVITE_BG_MOBILE.matches && frame.dataset.srcMobile) || frame.dataset.src;
  if (src) frame.src = src;
}

function primeIntroVideo() {
  const video = document.querySelector("[data-intro-video] video");
  if (!video) return Promise.resolve(false);
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.preload = "auto";
  if (introVideoReady) return introVideoReady;
  const src = video.dataset.introSrc || video.getAttribute("src");
  if (!src) return Promise.resolve(false);
  introVideoReady = fetch(src)
    .then((response) => {
      if (!response.ok) throw new Error("intro video");
      return response.blob();
    })
    .then(async (blob) => {
      const file = blob.type ? blob : new Blob([blob], { type: "video/mp4" });
      const url = URL.createObjectURL(file);
      video.src = url;
      video.load();
      const ready = await waitForVideo(video, 12000);
      if (!ready) throw new Error("intro video decode");
      primeIntroFrame();
      return true;
    })
    .catch(() => {
      if (video.src && video.src.startsWith("blob:")) URL.revokeObjectURL(video.src);
      video.src = src;
      video.load();
      return waitForVideo(video, 8000).finally(() => primeIntroFrame());
    });
  return introVideoReady;
}

function waitForVideo(video, timeoutMs) {
  if (video.readyState >= 3) return Promise.resolve(true);
  return new Promise((resolve) => {
    const finish = (ok) => {
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("error", onError);
      window.clearTimeout(timer);
      resolve(ok);
    };
    const onReady = () => finish(true);
    const onError = () => finish(false);
    video.addEventListener("canplay", onReady);
    video.addEventListener("error", onError);
    const timer = window.setTimeout(() => finish(video.readyState >= 2), timeoutMs);
  });
}

async function startIntroPlayback(video) {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) video.load();
  const ready = await waitForVideo(video, 8000);
  if (!ready && video.error) return false;
  try {
    if (video.readyState >= 1 && video.currentTime > 0.05) video.currentTime = 0;
  } catch {
    /* Keep the frame the phone already decoded. */
  }
  try {
    await video.play();
    return true;
  } catch {
    const again = await waitForVideo(video, 4000);
    if (!again) return false;
    try {
      await video.play();
      return true;
    } catch {
      return false;
    }
  }
}

function playIntroVideo() {
  const wrap = document.querySelector("[data-intro-video]");
  const video = wrap?.querySelector("video");
  if (!wrap || !video || prefersReducedMotion()) return Promise.resolve();
  return primeIntroVideo().then(() => {
    wrap.hidden = false;
    document.body.classList.add("is-intro");
    if (!song || song.paused) startSong();
    return startIntroPlayback(video).then((playing) => {
      if (!playing) return;
      const seconds = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 12;
      return new Promise((resolve) => {
        const done = () => {
          video.removeEventListener("ended", done);
          video.removeEventListener("error", done);
          window.clearTimeout(timer);
          resolve();
        };
        video.addEventListener("ended", done);
        video.addEventListener("error", done);
        const timer = window.setTimeout(done, seconds * 1000 + 2500);
      });
    }).finally(() => {
      hideIntroVideo();
    });
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
  primeIntroVideo();
  const played = await playKeyUnlock(() => startSong());
  if (!played) {
    stopSong();
    return false;
  }
  document.body.classList.add("is-unlocked");
  await wait(220);
  hideKey3d();
  document.body.classList.add("is-entering");
  await wait(900);
  await primeIntroVideo();
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

form?.addEventListener("input", () => {
  const message = nameFieldMessage();
  if (!errorNode) return;
  if (message) errorNode.textContent = message;
  else if (errorNode.textContent.startsWith("Please enter your first")) errorNode.textContent = "";
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (form.dataset.unlocking === "true") return;
  const nameMessage = nameFieldMessage();
  if (nameMessage) {
    if (errorNode) errorNode.textContent = nameMessage;
    (form.firstName.classList.contains("is-invalid") ? form.firstName : form.lastName).focus();
    return;
  }
  if (errorNode) errorNode.textContent = "";
  playSong();
  if (findInvite) {
    findInvite.disabled = true;
    findInvite.setAttribute("aria-busy", "true");
    findInvite.classList.add("is-loading");
  }
  form.dataset.unlocking = "true";
  document.activeElement?.blur();
  try {
    const [guest] = await Promise.all([
      findGuestByName(form.firstName.value, form.lastName.value),
      wait(500),
    ]);
    if (!guest) {
      if (errorNode) errorNode.textContent = missingMessage();
      return;
    }
    await loadEventSettings();
    preloadInviteAssets(guest);
    const played = await playUnlockSequence();
    if (!played) return;
    const arrive = !prefersReducedMotion();
    await showHousehold(guest, { arrive });
    document.body.classList.add("is-revealing");
    document.body.classList.remove("is-unlocking", "is-unlocked", "is-entering");
    if (arrive) {
      const openedAt = performance.now();
      await playArrival();
      document.body.classList.remove("is-revealing", "is-arriving", "is-arrived-doors", "is-arrived-mail");
      armInviteAdvance(openedAt);
    } else {
      document.body.classList.remove("is-revealing");
    }
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

if (!prefersReducedMotion()) primeIntroVideo();

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

function syncLetterFit() {
  const mail = document.querySelector(".household-desk.is-reading .household-mail");
  const mailSpace = mail ? Math.max(72, window.innerHeight - mail.getBoundingClientRect().top + 12) : 88;
  const top = 10;
  const height = Math.max(220, window.innerHeight - mailSpace - top);
  const width = Math.max(180, window.innerWidth - 20);
  document.documentElement.style.setProperty("--letter-max-h", `${Math.floor(height)}px`);
  document.documentElement.style.setProperty("--letter-max-w", `${Math.floor(width)}px`);
}

function viewportCenter() {
  const mail = document.querySelector(".household-desk.is-reading .household-mail");
  const bottom = mail ? mail.getBoundingClientRect().top - 8 : window.innerHeight - 12;
  return {
    x: window.innerWidth / 2,
    y: Math.max(80, bottom) / 2,
  };
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
  syncLetterFit();
  requestAnimationFrame(() => {
    syncLetterFit();
    centerOpenLetter(link);
  });
}

household?.addEventListener("keydown", (event) => {
  if (event.target.closest(".invite-sheet-calendar, .invite-sheet-back")) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  const link = event.target.closest("[data-envelope]");
  if (!link || event.target !== link) return;
  event.preventDefault();
  link.click();
});

function openLetterBox() {
  const img = household?.querySelector(".envelope-link.is-opening .letter-frame, .envelope-link.is-selected .letter-frame");
  if (!img) return null;
  const box = img.getBoundingClientRect();
  return box.width && box.height ? box : null;
}

function eventHitsOpenLetter(event) {
  const box = openLetterBox();
  if (!box) return false;
  return event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
}

household?.addEventListener("click", (event) => {
  if (event.button !== 0) return;
  if (event.target.closest(".invite-sheet-calendar")) return;
  if (event.target.closest(".invite-sheet-back, [data-close-letter]")) {
    event.preventDefault();
    event.stopPropagation();
    closeEnvelopes();
    return;
  }
  const link = event.target.closest("[data-envelope]");
  if (link && (link.classList.contains("is-opening") || link.classList.contains("is-selected"))) {
    if (guestEditInProgress()) return;
    if (eventHitsOpenLetter(event)) return;
    event.stopPropagation();
    closeEnvelopes();
    return;
  }
  if (!link) return;
  event.stopPropagation();
  household.querySelectorAll("[data-envelope]").forEach((other) => {
    other.classList.toggle("is-selected", other === link);
    other.classList.toggle("is-away", other !== link);
    other.setAttribute("aria-expanded", other === link ? "true" : "false");
  });
  setReading(true);
  syncLetterFit();
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

function guestEditInProgress() {
  return Boolean(document.querySelector("[data-party-member].is-editing"));
}

document.addEventListener("click", (event) => {
  if (event.button !== 0) return;
  if (!household?.classList.contains("is-reading")) return;
  if (detailsModal && !detailsModal.hidden) return;
  if (guestEditInProgress()) return;
  if (event.target.closest("[data-not-you], [data-song-toggle], .household-mail, .invite-sheet-calendar, .invite-sheet-back")) return;
  if (eventHitsOpenLetter(event)) return;
  closeEnvelopes();
});

window.addEventListener("pagehide", closeEnvelopes);
window.addEventListener("pageshow", (event) => {
  if (event.persisted) closeEnvelopes();
});
function fitSealedGate() {
  const gate = document.querySelector("[data-gate-stage]");
  if (!gate) return;
  const busy =
    document.body.classList.contains("is-open") ||
    document.body.classList.contains("is-entering") ||
    document.body.classList.contains("is-unlocking") ||
    document.body.classList.contains("is-intro") ||
    document.documentElement.classList.contains("invite-returning");
  if (busy) {
    gate.style.removeProperty("--gate-fit");
    return;
  }
  if (document.activeElement?.closest(".name-form")) return;
  gate.style.setProperty("--gate-fit", "1");
  const available = window.innerHeight;
  let needed = 0;
  for (const child of gate.children) {
    if (child.hidden) continue;
    const style = getComputedStyle(child);
    if (style.display === "none" || style.visibility === "hidden") continue;
    needed += child.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
  }
  const gateStyle = getComputedStyle(gate);
  needed += parseFloat(gateStyle.paddingTop) + parseFloat(gateStyle.paddingBottom);
  const fit = needed > 8 ? Math.min(1, (available - 6) / needed) : 1;
  gate.style.setProperty("--gate-fit", String(Math.max(0.58, fit)));
}

window.addEventListener("resize", () => {
  fitSealedGate();
  if (household?.classList.contains("is-reading")) syncLetterFit();
  const selected = household?.querySelector(".envelope-link.is-selected");
  if (!selected) return;
  if (selected.classList.contains("is-opening")) centerOpenLetter(selected);
  else centerClosedEnvelope(selected);
});

fitSealedGate();
document.fonts?.ready.then(() => fitSealedGate());
window.visualViewport?.addEventListener("resize", () => fitSealedGate());

document.querySelectorAll("[data-open-details]").forEach((el) => {
  el.addEventListener("click", () => openDetailsModal(detailsModal));
});

detailsModal?.querySelectorAll("[data-close-details]").forEach((el) => {
  el.addEventListener("click", () => {
    if (el.classList.contains("details-modal-backdrop") && guestEditInProgress()) return;
    closeDetailsModal(detailsModal);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (detailsModal && !detailsModal.hidden) {
    if (guestEditInProgress()) return;
    closeDetailsModal(detailsModal);
    return;
  }
  if (guestEditInProgress()) return;
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
  stopSong();
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
  const returning = await resolveGuest();
  if (returning) await showHousehold(returning);
  else if ((params.get("code") || stored) && errorNode) errorNode.textContent = missingMessage();
  document.documentElement.classList.remove("invite-returning");
} else {
  initKey3d();
}
