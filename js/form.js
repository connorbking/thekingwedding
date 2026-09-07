import { GAS_URL } from "./config.js";
import { extraGuestSlots } from "./guests.js";

function rowTemplate(index) {
  return `
    <div class="guest-row" data-guest-row>
      <label>
        <span>First name</span>
        <input type="text" name="guestFirst${index}" autocomplete="off">
      </label>
      <label>
        <span>Last name</span>
        <input type="text" name="guestLast${index}" autocomplete="off">
      </label>
      <button type="button" class="guest-remove" data-remove-guest aria-label="Remove guest">&times;</button>
    </div>
  `;
}

function collectExtras(form) {
  return [...form.querySelectorAll("[data-guest-row]")].map((row) => {
    const inputs = row.querySelectorAll("input");
    return {
      firstName: inputs[0].value.trim(),
      lastName: inputs[1].value.trim(),
    };
  }).filter((guest) => guest.firstName || guest.lastName);
}

function updateCap(form, guest) {
  const cap = form.querySelector("[data-guest-cap]");
  const addBtn = form.querySelector("[data-add-guest]");
  const used = form.querySelectorAll("[data-guest-row]").length;
  const remaining = extraGuestSlots(guest) - used;
  if (cap) {
    cap.textContent = remaining > 0
      ? `You may add ${remaining} more family member${remaining === 1 ? "" : "s"} on this invitation.`
      : extraGuestSlots(guest) === 0
        ? "This invitation is reserved for you."
        : "Your invitation is full.";
  }
  if (addBtn) {
    addBtn.disabled = remaining <= 0;
    addBtn.hidden = extraGuestSlots(guest) === 0;
  }
}

function applyGreeting(guest) {
  document.querySelectorAll("[data-greeting]").forEach((el) => {
    if (guest.personalized && guest.greeting) {
      el.textContent = `Dear ${guest.greeting},`;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  });
}

function serialize(form, eventName, guest) {
  const extras = collectExtras(form);
  return {
    timestamp: new Date().toISOString(),
    event: eventName,
    accessCode: guest.code || "",
    personalized: guest.personalized,
    firstName: form.firstName.value.trim(),
    lastName: form.lastName.value.trim(),
    phone: form.phone.value.trim(),
    email: form.email.value.trim(),
    street: form.street.value.trim(),
    apt: form.apt.value.trim(),
    city: form.city.value.trim(),
    region: form.region.value.trim(),
    postal: form.postal.value.trim(),
    country: form.country.value.trim(),
    additionalGuests: extras,
    additionalGuestsText: extras.map((g) => `${g.firstName} ${g.lastName}`.trim()).join(", "),
    partySize: 1 + extras.length,
  };
}

async function postToSheet(payload) {
  if (!GAS_URL) {
    const error = new Error("The Google Sheet connection has not been configured yet.");
    error.code = "not-configured";
    throw error;
  }

  await fetch(GAS_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
}

export function initAddressForm({ event, guest }) {
  const form = document.querySelector("[data-address-form]");
  if (!form) return;

  applyGreeting(guest);
  updateCap(form, guest);

  form.addEventListener("click", (eventClick) => {
    if (eventClick.target.closest("[data-add-guest]")) {
      const max = extraGuestSlots(guest);
      if (form.querySelectorAll("[data-guest-row]").length >= max) return;
      const list = form.querySelector("[data-guest-list]");
      list.insertAdjacentHTML("beforeend", rowTemplate(list.children.length + 1));
      updateCap(form, guest);
    }
    if (eventClick.target.closest("[data-remove-guest]")) {
      eventClick.target.closest("[data-guest-row]")?.remove();
      updateCap(form, guest);
    }
  });

  form.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    const honeypot = form.querySelector("[name='company']");
    if (honeypot && honeypot.value) {
      form.hidden = true;
      document.querySelector("[data-form-success]")?.removeAttribute("hidden");
      return;
    }

    const extras = collectExtras(form);
    if (extras.length > extraGuestSlots(guest)) {
      form.querySelector("[data-form-error]").textContent = "This invitation cannot include that many additional guests.";
      return;
    }

    const payload = serialize(form, event, guest);
    const button = form.querySelector("[type='submit']");
    const errorNode = form.querySelector("[data-form-error]");
    button.disabled = true;
    button.classList.add("is-loading");
    if (errorNode) errorNode.textContent = "";

    try {
      await postToSheet(payload);
      form.hidden = true;
      document.querySelector("[data-form-success]")?.removeAttribute("hidden");
    } catch (error) {
      if (errorNode) {
        errorNode.textContent = GAS_URL
          ? "Something went wrong sending your address. Please try again, or email us directly."
          : "Address collection is almost ready. Your details were not stored yet — please try again after we connect the guest list, or email us.";
      }
    } finally {
      button.disabled = false;
      button.classList.remove("is-loading");
    }
  });
}
