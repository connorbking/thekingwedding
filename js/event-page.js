import { initRouter } from "./router.js";
import { initEnvelope } from "./envelope.js";
import { initCountdown } from "./countdown.js";
import { initAddressForm } from "./form.js";
import { resolveGuest } from "./guests.js";

const guest = resolveGuest();

initRouter({ base: document.body.dataset.base || "/" });
initEnvelope();
initCountdown();
initAddressForm({
  event: document.body.dataset.event,
  guest,
});
