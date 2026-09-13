import { initRouter } from "./router.js";
import { initEnvelope } from "./envelope.js";
import { initCountdown } from "./countdown.js";
import { initAddressForm } from "./form.js";
import {
  resolveGuest,
  guestCanAccess,
  gateHref,
  withCode,
  clearGuest,
  isDualGuest,
} from "./guests.js";

const eventKey = document.body.dataset.event;
const guest = await resolveGuest(eventKey);

if (!guestCanAccess(guest, eventKey)) {
  window.location.replace("/");
} else {
  document.documentElement.classList.remove("invite-pending");

  document.querySelectorAll("[data-home-link]").forEach((el) => {
    el.href = gateHref(guest.code);
  });

  document.querySelectorAll("a[href^='/como'], a[href^='/jersey']").forEach((el) => {
    el.href = withCode(el.getAttribute("href"), guest.code);
  });

  document.querySelectorAll("[data-not-you]").forEach((el) => {
    el.addEventListener("click", (clickEvent) => {
      clickEvent.preventDefault();
      clearGuest();
      window.location.assign("/");
    });
  });

  if (!isDualGuest(guest)) {
    document.querySelectorAll("[data-dual-only]").forEach((el) => el.remove());
  }

  initRouter({ base: document.body.dataset.base || "/" });
  initEnvelope();
  initCountdown();
  initAddressForm({
    event: eventKey,
    guest,
  });
}
