import { initRouter } from "./router.js";
import { initEnvelope } from "./envelope.js";
import { initCountdown } from "./countdown.js";
import { initAddressForm } from "./form.js";
import { resolveGuest } from "./guests.js";

initRouter({ base: document.body.dataset.base || "/" });
initEnvelope();
initCountdown();

const guest = await resolveGuest(document.body.dataset.event);
initAddressForm({
  event: document.body.dataset.event,
  guest,
});
