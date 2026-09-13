import { API } from "./config.js";
import { extraGuestSlots } from "./guests.js";

function eventPlace(eventName) {
  if (eventName === "como") return "Lake Como";
  if (eventName === "jersey") return "Whippany";
  return "the celebration";
}

function extraRowTemplate(index) {
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

function memberRsvp(member, eventName) {
  if (member.rsvp && typeof member.rsvp === "object") return member.rsvp[eventName] || "";
  return member.rsvp || member[`rsvp_${eventName}`] || "";
}

function memberName(member) {
  return `${member.first_name || member.firstName || ""} ${member.last_name || member.lastName || ""}`.trim();
}

function memberTemplate(index, member, eventName, showRsvp = false) {
  const first = member.first_name || member.firstName || "";
  const last = member.last_name || member.lastName || "";
  const fields = `
    <label>First name <input name="memberFirst${index}" value="${escapeAttr(first)}" required autocomplete="given-name"></label>
    <label>Last name <input name="memberLast${index}" value="${escapeAttr(last)}" required autocomplete="family-name"></label>
    <label>Phone <input name="memberPhone${index}" type="tel" value="${escapeAttr(member.phone || "")}" autocomplete="tel"></label>
    <label>Email <input name="memberEmail${index}" type="email" value="${escapeAttr(member.email || "")}" autocomplete="email"></label>
  `;

  if (!showRsvp) {
    return `
      <div class="party-member" data-party-member data-member-id="${escapeAttr(member.id || "")}">
        ${fields}
      </div>
    `;
  }

  const rsvp = memberRsvp(member, eventName);
  const checked = (value) => (rsvp === value ? "checked" : "");
  return `
    <div class="party-member party-member--rsvp" data-party-member data-member-id="${escapeAttr(member.id || "")}">
      <p class="party-member-name" data-member-name>${escapeAttr(memberName(member) || "Guest")}</p>
      <button type="button" class="party-edit-toggle" data-edit-member aria-expanded="false" aria-label="Edit ${escapeAttr(memberName(member) || "guest")}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 3.5l4 4L8 20H4v-4L16.5 3.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
      </button>
      <fieldset class="rsvp-choices rsvp-choices--inline">
        <legend>Reply</legend>
        <label><input type="radio" name="memberRsvp${index}" value="Yes" ${checked("Yes")} required> Yes</label>
        <label><input type="radio" name="memberRsvp${index}" value="No" ${checked("No")} required> No</label>
      </fieldset>
      <div class="party-edit" data-member-edit hidden>${fields}</div>
    </div>
  `;
}

function escapeAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

function collectMembers(form) {
  return [...form.querySelectorAll("[data-party-member]")].map((card) => {
    const first = card.querySelector("input[name^='memberFirst']")?.value.trim() || "";
    const last = card.querySelector("input[name^='memberLast']")?.value.trim() || "";
    return {
      id: card.dataset.memberId || "",
      firstName: first,
      lastName: last,
      phone: card.querySelector("input[name^='memberPhone']")?.value.trim() || "",
      email: card.querySelector("input[name^='memberEmail']")?.value.trim() || "",
      rsvp: card.querySelector("input[name^='memberRsvp']:checked")?.value || "",
    };
  }).filter((guest) => guest.firstName || guest.lastName);
}

function successNode(form) {
  return form.closest("section")?.querySelector("[data-form-success]") || document.querySelector("[data-form-success]");
}

function partyCount(form, guest) {
  if (guest.personalized || form.querySelector("[data-party-list]")) {
    return 1 + form.querySelectorAll("[data-party-member]").length;
  }
  return 1 + form.querySelectorAll("[data-guest-row]").length;
}

function updateCap(form, guest) {
  const cap = form.querySelector("[data-guest-cap]");
  const addBtn = form.querySelector("[data-add-guest]");
  if (form.classList.contains("is-party")) {
    if (cap) cap.hidden = true;
    if (addBtn) addBtn.remove();
    return;
  }
  const used = partyCount(form, guest);
  const remaining = guest.maxParty - used;
  if (cap) {
    cap.textContent = remaining > 0
      ? "You may add one additional guest."
      : extraGuestSlots(guest) === 0
        ? "This invitation is reserved for you."
        : "A +1 has been added. Personalized links allow a larger family party.";
  }
  if (addBtn) addBtn.disabled = remaining <= 0;
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

function ensureRsvpField(form, eventName) {
  if (form.querySelector("[name='rsvp']")) return;
  const required = form.dataset.formKind === "rsvp" ? "required" : "";
  const field = document.createElement("fieldset");
  field.className = "rsvp-choices";
  field.innerHTML = `
    <legend>Will you join us in ${eventPlace(eventName)}?</legend>
    <label><input type="radio" name="rsvp" value="Yes" ${required}> Yes</label>
    <label><input type="radio" name="rsvp" value="No" ${required}> No</label>
  `;
  form.querySelector(".form-grid")?.after(field);
}

function fillInput(form, name, value) {
  if (!form[name] || value == null || value === "") return;
  form[name].value = value;
}

function hidePrimaryFields(form) {
  ["firstName", "lastName", "phone", "email"].forEach((name) => {
    const input = form.querySelector(`[name='${name}']`);
    if (!input) return;
    input.required = false;
  });
  const nameGrid = form.querySelector(".form-grid");
  if (nameGrid) {
    nameGrid.classList.add("is-hidden-primary");
    nameGrid.hidden = true;
  }
}

function hideAddressFields(form) {
  form.classList.add("is-rsvp");
  ["street", "apt", "city", "region", "postal", "country"].forEach((name) => {
    const input = form.querySelector(`[name='${name}']`);
    if (!input) return;
    input.required = false;
    input.closest("label")?.setAttribute("hidden", "");
  });
  form.querySelectorAll(".form-grid").forEach((grid) => {
    const labels = [...grid.querySelectorAll(":scope > label")];
    if (labels.length && labels.every((label) => label.hidden || grid.classList.contains("is-hidden-primary"))) {
      grid.hidden = true;
    }
  });
  form.querySelector("[data-address-cap]")?.remove();
}

function partyList(form) {
  let list = form.querySelector("[data-party-list]");
  if (!list) {
    list = document.createElement("div");
    list.className = "party-list";
    list.setAttribute("data-party-list", "");
    const honeypot = form.querySelector(".hp");
    if (honeypot) honeypot.after(list);
    else form.prepend(list);
  }
  return list;
}

function householdAddress(members) {
  return members.find((row) => row.street) || members[0] || {};
}

function namedMember(member) {
  return Boolean(String(member.first_name || member.firstName || "").trim() || String(member.last_name || member.lastName || "").trim());
}

function renderParty(form, guest, eventName) {
  const members = (guest.members || []).filter(namedMember).map((member) => ({ ...member }));
  const address = householdAddress(members);

  if (form.dataset.formKind !== "rsvp") form.dataset.formKind = "address";
  form.classList.add("is-party");
  hidePrimaryFields(form);

  const showRsvp = form.dataset.formKind === "rsvp";
  if (showRsvp) {
    hideAddressFields(form);
  } else {
    form.querySelectorAll(".rsvp-choices").forEach((node) => node.remove());
    fillInput(form, "street", address.street);
    fillInput(form, "apt", address.apt);
    fillInput(form, "city", address.city);
    fillInput(form, "region", address.region);
    fillInput(form, "postal", address.postal);
    if (!form.querySelector("[data-address-cap]")) {
      const cap = document.createElement("p");
      cap.className = "guest-cap";
      cap.setAttribute("data-address-cap", "");
      cap.textContent = "Mailing address";
      form.querySelector("[name='street']")?.closest("label")?.before(cap);
    }
  }

  partyList(form).innerHTML = members.length
    ? `
    <p class="guest-cap">Your party</p>
    ${members.map((member, index) => memberTemplate(index, member, eventName, showRsvp)).join("")}
  `
    : "";

  const extras = form.querySelector("[data-guest-list]");
  if (extras) extras.hidden = true;
}

function serializeParty(form, eventName, guest) {
  const guests = collectMembers(form);
  const primary = guests[0] || {};
  return {
    timestamp: new Date().toISOString(),
    event: eventName,
    accessCode: guest.code || "",
    party: guest.greeting || "",
    greeting: guest.greeting || "",
    personalized: true,
    firstName: primary.firstName || "",
    lastName: primary.lastName || "",
    phone: primary.phone || "",
    email: primary.email || "",
    rsvp: primary.rsvp || "",
    kind: form.dataset.formKind || "address",
    street: form.street?.value.trim() || "",
    apt: form.apt?.value.trim() || "",
    city: form.city?.value.trim() || "",
    region: form.region?.value.trim() || "",
    postal: form.postal?.value.trim() || "",
    country: form.country?.value.trim() || "",
    guests,
    partySize: guests.length,
  };
}

function serialize(form, eventName, guest) {
  const extras = collectExtras(form);
  const rsvp = form.querySelector("[name='rsvp']:checked")?.value || "";
  return {
    timestamp: new Date().toISOString(),
    event: eventName,
    rsvp,
    accessCode: guest.code || "",
    party: guest.greeting || "",
    greeting: guest.greeting || "",
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

async function postSubmission(payload) {
  const response = await fetch(API.submissions, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Something went wrong sending your address.");
  }
}

function bindForm(form, eventName, guest) {
  const partyMode = Boolean(guest.code && (guest.personalized || guest.members?.length));
  if (partyMode) {
    renderParty(form, guest, eventName);
    const submit = form.querySelector("[type='submit']");
    if (submit && form.dataset.formKind === "rsvp") submit.textContent = "Send RSVP";
    else if (submit) submit.textContent = "Save our details";
  } else if (form.dataset.formKind === "rsvp") {
    hideAddressFields(form);
    ensureRsvpField(form, eventName);
  }
  updateCap(form, guest);

  form.addEventListener("click", (eventClick) => {
    if (eventClick.target.closest("[data-add-guest]")) {
      if (partyMode) return;
      const max = extraGuestSlots(guest);
      if (form.querySelectorAll("[data-guest-row]").length >= max) return;
      const list = form.querySelector("[data-guest-list]");
      list.insertAdjacentHTML("beforeend", extraRowTemplate(list.children.length + 1));
      updateCap(form, guest);
    }
    if (eventClick.target.closest("[data-remove-guest]")) {
      eventClick.target.closest("[data-guest-row]")?.remove();
      updateCap(form, guest);
    }
    const editBtn = eventClick.target.closest("[data-edit-member]");
    if (editBtn) {
      const card = editBtn.closest("[data-party-member]");
      const open = card.classList.toggle("is-editing");
      const panel = card.querySelector("[data-member-edit]");
      if (panel) panel.hidden = !open;
      editBtn.setAttribute("aria-expanded", open ? "true" : "false");
      editBtn.setAttribute("aria-label", open ? "Done editing guest" : "Edit guest");
      if (open) card.querySelector("input[name^='memberFirst']")?.focus();
    }
  });

  form.addEventListener("input", (inputEvent) => {
    const card = inputEvent.target.closest("[data-party-member]");
    const name = card?.querySelector("[data-member-name]");
    if (!name) return;
    const first = card.querySelector("input[name^='memberFirst']")?.value.trim() || "";
    const last = card.querySelector("input[name^='memberLast']")?.value.trim() || "";
    name.textContent = `${first} ${last}`.trim() || "Guest";
  });

  form.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    const honeypot = form.querySelector("[name='company']");
    if (honeypot && honeypot.value) {
      form.hidden = true;
      successNode(form)?.removeAttribute("hidden");
      return;
    }

    const payload = partyMode ? serializeParty(form, eventName, guest) : serialize(form, eventName, guest);
    if (!partyMode && collectExtras(form).length > extraGuestSlots(guest)) {
      form.querySelector("[data-form-error]").textContent = "This invitation cannot include that many additional guests.";
      return;
    }
    if (partyMode && payload.guests.length > guest.maxParty) {
      form.querySelector("[data-form-error]").textContent = "This invitation cannot include that many guests.";
      return;
    }

    const button = form.querySelector("[type='submit']");
    const errorNode = form.querySelector("[data-form-error]");
    button.disabled = true;
    button.classList.add("is-loading");
    if (errorNode) errorNode.textContent = "";

    try {
      await postSubmission(payload);
      form.hidden = true;
      successNode(form)?.removeAttribute("hidden");
    } catch (error) {
      if (errorNode) {
        errorNode.textContent = error.message || "Something went wrong sending your address. Please try again.";
      }
    } finally {
      button.disabled = false;
      button.classList.remove("is-loading");
    }
  });
}

function mountRsvpForm(guest) {
  const card = document.querySelector("[data-view='rsvp'] .rsvp-card");
  if (!card) return;

  const hasParty = Boolean(guest.personalized || guest.members?.length);
  card.querySelectorAll("[data-generic-rsvp], [data-generic-rsvp-cta]").forEach((el) => {
    el.hidden = hasParty;
  });
  const intro = card.querySelector("[data-rsvp-intro]");
  if (intro) intro.hidden = !hasParty;
  if (!hasParty) return;

  if (card.querySelector("[data-address-form]")) return;
  const source = document.querySelector("[data-address-form]");
  if (!source) return;

  const host = card.querySelector("[data-rsvp-form-host]") || card;
  const clone = source.cloneNode(true);
  clone.dataset.formKind = "rsvp";
  host.appendChild(clone);
  if (!card.querySelector("[data-form-success]")) {
    const done = document.createElement("p");
    done.className = "form-success";
    done.hidden = true;
    done.setAttribute("data-form-success", "");
    done.textContent = "Thank you. We have your party’s reply.";
    card.appendChild(done);
  }
}

export function initAddressForm({ event, guest }) {
  applyGreeting(guest);
  mountRsvpForm(guest);
  document.querySelectorAll("[data-address-form]").forEach((form) => bindForm(form, event, guest));
}
