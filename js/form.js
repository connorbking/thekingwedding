import { API } from "./config.js";
import { extraGuestSlots } from "./guests.js";

function eventPlace(eventName) {
  if (eventName === "como") return "Lake Como";
  if (eventName === "jersey") return "Whippany";
  if (eventName === "shower") return "the bridal shower";
  return "the celebration";
}

function extraRowTemplate(index) {
  return `
    <div class="guest-row" data-guest-row>
      <label>
        <span>First Name</span>
        <input type="text" name="guestFirst${index}" autocomplete="off">
      </label>
      <label>
        <span>Last Name</span>
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

function phoneDigits(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

function formatPhone(value) {
  const digits = phoneDigits(value);
  if (!digits) return "";
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function applyPhoneMask(input) {
  const caretDigits = phoneDigits(input.value.slice(0, input.selectionStart ?? input.value.length)).length;
  const formatted = formatPhone(input.value);
  input.value = formatted;
  let seen = 0;
  let pos = formatted.length;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i])) {
      seen += 1;
      if (seen >= caretDigits) {
        pos = i + 1;
        break;
      }
    }
  }
  input.setSelectionRange(pos, pos);
}

function cityStateZip({ city, region, postal } = {}) {
  const cityState = [city, region].map((value) => String(value || "").trim()).filter(Boolean).join(", ");
  return [cityState, String(postal || "").trim()].filter(Boolean).join(" ");
}

function addressRecord(source = {}) {
  if (source?.querySelector) {
    const fields = addressInputs(source);
    return {
      street: fields.street?.value.trim() || "",
      apt: fields.apt?.value.trim() || "",
      city: fields.city?.value.trim() || "",
      region: fields.region?.value.trim() || "",
      postal: fields.postal?.value.trim() || "",
      country: fields.country?.value.trim() || "",
    };
  }
  return {
    street: source.street || "",
    apt: source.apt || "",
    city: source.city || "",
    region: source.region || "",
    postal: source.postal || "",
    country: source.country || "",
  };
}

function memberContactLine(phone, email, address = {}) {
  const street = String(address.street || "").trim();
  const apt = String(address.apt || "").trim();
  const locale = cityStateZip(address);
  const mail = street || apt || locale
    ? `<span class="party-member-mail" data-member-mail>${
        street ? `<span class="party-member-street">${escapeAttr(street)}</span>` : ""
      }${apt ? `<span class="party-member-apt">${escapeAttr(apt)}</span>` : ""}${
        locale ? `<span class="party-member-cityline">${escapeAttr(locale)}</span>` : ""
      }</span>`
    : `<button type="button" class="party-add-email" data-edit-member>Add address →</button>`;
  const reach = [];
  if (phone) reach.push(`<span class="party-member-phone" data-member-phone>${escapeAttr(phone)}</span>`);
  if (email) reach.push(`<span class="party-member-email" data-member-email>${escapeAttr(email)}</span>`);
  else reach.push(`<button type="button" class="party-add-email" data-edit-member>Add email →</button>`);
  return `${mail}<div class="party-member-reach">${reach.join("")}</div>`;
}

function guestCountLabel(count) {
  return count === 1 ? "1 guest" : `${count} guests`;
}

function partyCrease() {
  return `<img class="party-crease" src="/public/crease.png" alt="" aria-hidden="true">`;
}

function equalizeLetterPanels(form) {
  const root = form?.closest("[data-letter-folds]") || form;
  if (!root || root.getClientRects().length === 0) return;
  const panels = [...root.querySelectorAll("[data-letter-panel]")];
  const guests = panels.filter((panel) => panel.classList.contains("party-member"));
  panels.forEach((panel) => {
    if (!panel.classList.contains("party-member")) panel.style.height = "";
  });
  if (!guests.length) return;
  guests.forEach((panel) => {
    panel.style.height = "";
  });
  const height = Math.ceil(
    guests.reduce((max, panel) => {
      if (panel.classList.contains("is-editing")) return max;
      return Math.max(max, panel.getBoundingClientRect().height);
    }, 0)
  );
  if (height < 8) return;
  guests.forEach((panel) => {
    if (panel.classList.contains("is-editing")) {
      panel.style.height = "";
      return;
    }
    panel.style.height = `${height}px`;
  });
}

let letterFoldResizeBound = false;
function watchLetterFolds(form) {
  if (letterFoldResizeBound) return;
  letterFoldResizeBound = true;
  let timer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => equalizeLetterPanels(form), 80);
  });
}

const EDIT_ICON = `<svg class="party-icon-edit" viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 3.5l4 4L8 20H4v-4L16.5 3.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const SAVE_ICON = `<svg class="party-icon-save" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h11l4 4v14H5V3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 3.2V8h8V3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 21v-7h8v7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 16.4h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;

function formatAddressLine({ street, apt, city, region, postal, country } = {}, { includeCountry = false } = {}) {
  const line1 = [street, apt].map((value) => String(value || "").trim()).filter(Boolean).join(", ");
  const cityState = [city, region].map((value) => String(value || "").trim()).filter(Boolean).join(", ");
  const line2 = [cityState, String(postal || "").trim()].filter(Boolean).join(" ");
  const parts = [line1, line2];
  if (includeCountry) parts.push(String(country || "").trim());
  return parts.filter(Boolean).join(", ");
}

function memberAddressFields(index, member) {
  const street = member.street || "";
  const apt = member.apt || "";
  const city = member.city || "";
  const region = member.region || "";
  const postal = member.postal || "";
  const country = member.country || "United States";
  const search = formatAddressLine({ street, apt, city, region, postal, country }, { includeCountry: false });
  return `
    <div class="party-member-address">
      <label class="address-lookup">Street address
        <input name="memberAddress${index}" type="text" autocomplete="off" placeholder="Start typing your address..." required aria-required="true" aria-autocomplete="list" aria-controls="address-suggestions-${index}" value="${escapeAttr(search)}">
      </label>
      <ul class="address-suggestions" id="address-suggestions-${index}" data-address-suggestions hidden></ul>
      <label>Apartment / unit (optional) <input name="memberApt${index}" autocomplete="address-line2" placeholder="Apartment or unit" value="${escapeAttr(apt)}"></label>
      <input type="hidden" name="memberStreet${index}" value="${escapeAttr(street)}">
      <input type="hidden" name="memberCity${index}" value="${escapeAttr(city)}">
      <input type="hidden" name="memberRegion${index}" value="${escapeAttr(region)}">
      <input type="hidden" name="memberPostal${index}" value="${escapeAttr(postal)}">
      <input type="hidden" name="memberCountry${index}" value="${escapeAttr(country)}">
    </div>
  `;
}

function memberTemplate(index, member, eventName, showRsvp = false) {
  const first = member.first_name || member.firstName || "";
  const last = member.last_name || member.lastName || "";
  const fields = `
    <label>First Name <input name="memberFirst${index}" value="${escapeAttr(first)}" required autocomplete="given-name" placeholder="First Name"></label>
    <label>Last Name <input name="memberLast${index}" value="${escapeAttr(last)}" required autocomplete="family-name" placeholder="Last Name"></label>
    <label>Phone <input name="memberPhone${index}" type="tel" inputmode="numeric" autocomplete="tel" placeholder="(201) 555-0100" value="${escapeAttr(formatPhone(member.phone || ""))}"></label>
    <label>Email <input name="memberEmail${index}" type="email" value="${escapeAttr(member.email || "")}" autocomplete="email" placeholder="Email"></label>
    ${showRsvp ? "" : memberAddressFields(index, member)}
  `;

  if (!showRsvp) {
    return `
      <div class="party-member party-member--note" data-party-member data-letter-panel data-member-id="${escapeAttr(member.id || "")}">
        <div class="party-member-bar">
          <span class="party-member-index">Guest ${index + 1}</span>
          <button type="button" class="party-edit-toggle" data-edit-member aria-expanded="false" aria-label="Edit ${escapeAttr(memberName(member) || "guest")}">
            <span data-edit-label>Edit</span>
            ${EDIT_ICON}${SAVE_ICON}
          </button>
        </div>
        <div class="party-member-summary">
          <p class="party-member-name" data-member-name>${escapeAttr(memberName(member) || "Guest")}</p>
          <div class="party-member-contact" data-member-contact>${memberContactLine(formatPhone(member.phone || ""), String(member.email || "").trim(), member)}</div>
        </div>
        <div class="party-edit" data-member-edit hidden>${fields}</div>
      </div>
    `;
  }

  const rsvp = memberRsvp(member, eventName);
  const checked = (value) => (rsvp === value ? "checked" : "");
  return `
    <div class="party-member party-member--rsvp" data-party-member data-member-id="${escapeAttr(member.id || "")}">
      <p class="party-member-name" data-member-name>${escapeAttr(memberName(member) || "Guest")}</p>
      <button type="button" class="party-edit-toggle" data-edit-member aria-expanded="false" aria-label="Edit ${escapeAttr(memberName(member) || "guest")}">
        ${EDIT_ICON}${SAVE_ICON}
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
    const address = addressInputs(card);
    return {
      id: card.dataset.memberId || "",
      firstName: first,
      lastName: last,
      phone: formatPhone(card.querySelector("input[name^='memberPhone']")?.value || ""),
      email: card.querySelector("input[name^='memberEmail']")?.value.trim() || "",
      rsvp: card.querySelector("input[name^='memberRsvp']:checked")?.value || "",
      street: address.street?.value.trim() || "",
      apt: address.apt?.value.trim() || "",
      city: address.city?.value.trim() || "",
      region: address.region?.value.trim() || "",
      postal: address.postal?.value.trim() || "",
      country: address.country?.value.trim() || "United States",
    };
  }).filter((guest) => guest.firstName || guest.lastName);
}

function markHouseholdSaved(form) {
  const modal = form.closest("[data-details-modal]");
  const wrap = modal?.querySelector("[data-details-form-wrap]");
  const success = modal?.querySelector("[data-details-success]");
  if (!modal || !success) {
    const button = form.querySelector("[type='submit']");
    if (!button) return;
    button.textContent = "Your details have been updated!";
    button.classList.add("is-saved");
    document.dispatchEvent(new CustomEvent("king:details-saved"));
    return;
  }
  if (wrap) wrap.hidden = true;
  success.hidden = false;
  document.dispatchEvent(new CustomEvent("king:details-saved"));
  requestAnimationFrame(() => {
    success.scrollIntoView({ block: "center", inline: "nearest" });
  });
  window.setTimeout(() => closeDetailsModal(modal), 2000);
}

export function closeDetailsModal(modal = document.querySelector("[data-details-modal]")) {
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("details-open");
  const wrap = modal.querySelector("[data-details-form-wrap]");
  const success = modal.querySelector("[data-details-success]");
  if (wrap) wrap.hidden = false;
  if (success) success.hidden = true;
}

export function openDetailsModal(modal = document.querySelector("[data-details-modal]")) {
  if (!modal) return;
  const wrap = modal.querySelector("[data-details-form-wrap]");
  const success = modal.querySelector("[data-details-success]");
  if (wrap) wrap.hidden = false;
  if (success) success.hidden = true;
  modal.hidden = false;
  document.body.classList.add("details-open");
  equalizeLetterPanels(modal.querySelector("[data-household-form]"));
  modal.querySelector("input[name^='memberFirst'], [name='addressSearch']")?.focus();
}

function addressScope(node) {
  return node.closest("[data-party-member]") || node.closest("form");
}

function addressInputs(scope) {
  if (!scope) return {};
  if (scope.matches?.("[data-party-member]")) {
    return {
      search: scope.querySelector("input[name^='memberAddress']"),
      street: scope.querySelector("input[name^='memberStreet']"),
      apt: scope.querySelector("input[name^='memberApt']"),
      city: scope.querySelector("input[name^='memberCity']"),
      region: scope.querySelector("input[name^='memberRegion']"),
      postal: scope.querySelector("input[name^='memberPostal']"),
      country: scope.querySelector("input[name^='memberCountry']"),
      list: scope.querySelector("[data-address-suggestions]"),
    };
  }
  return {
    search: scope.querySelector?.("[name='addressSearch']") || scope.addressSearch,
    street: scope.querySelector?.("[name='street']") || scope.street,
    apt: scope.querySelector?.("[name='apt']") || scope.apt,
    city: scope.querySelector?.("[name='city']") || scope.city,
    region: scope.querySelector?.("[name='region']") || scope.region,
    postal: scope.querySelector?.("[name='postal']") || scope.postal,
    country: scope.querySelector?.("[name='country']") || scope.country,
    list: scope.querySelector?.("[data-address-suggestions]"),
  };
}

function composedAddress(scope) {
  const fields = addressInputs(scope);
  return formatAddressLine({
    street: fields.street?.value,
    apt: fields.apt?.value,
    city: fields.city?.value,
    region: fields.region?.value,
    postal: fields.postal?.value,
    country: fields.country?.value,
  });
}

function applyAddress(scope, suggestion) {
  if (!suggestion) return;
  const fields = addressInputs(scope);
  const set = (input, value, allowEmpty = false) => {
    if (!input) return;
    if (!allowEmpty && (value == null || value === "")) return;
    input.value = value ?? "";
  };
  set(fields.street, suggestion.street);
  set(fields.city, suggestion.city);
  set(fields.region, suggestion.region);
  set(fields.postal, suggestion.postal);
  set(fields.country, suggestion.country || "United States");
  set(fields.apt, suggestion.apt || "", true);
  if (fields.search) fields.search.value = suggestion.label || composedAddress(scope);
}

function hideSuggestions(scope) {
  const list = addressInputs(scope).list;
  if (!list) return;
  list.hidden = true;
  list.innerHTML = "";
}

async function lookupAddresses(query) {
  const response = await fetch(`${API.address}?q=${encodeURIComponent(query)}`);
  const data = await response.json().catch(() => ({}));
  return {
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    hint: data.hint || "",
  };
}

function bindAddressLookup(form) {
  if (form.dataset.addressBound === "true") return;
  form.dataset.addressBound = "true";

  let timer = 0;
  let request = 0;

  const render = (scope, suggestions, hint = "") => {
    const list = addressInputs(scope).list;
    if (!list) return;
    if (!suggestions.length) {
      if (hint) {
        list.innerHTML = `<li class="address-hint">${escapeAttr(hint)}</li>`;
        list.hidden = false;
        return;
      }
      hideSuggestions(scope);
      return;
    }
    list.innerHTML = suggestions
      .map(
        (row, index) =>
          `<li><button type="button" data-address-index="${index}">${escapeAttr(row.label)}</button></li>`
      )
      .join("");
    list.hidden = false;
    list.querySelectorAll("[data-address-index]").forEach((button) => {
      button.addEventListener("click", () => {
        applyAddress(scope, suggestions[Number(button.dataset.addressIndex)]);
        hideSuggestions(scope);
        refreshMemberSummary(scope);
      });
    });
  };

  form.addEventListener("input", (event) => {
    if (!event.target.matches("[name='addressSearch'], input[name^='memberAddress']")) return;
    const scope = addressScope(event.target);
    const fields = addressInputs(scope);
    [fields.street, fields.city, fields.region, fields.postal].forEach((input) => {
      if (input) input.value = "";
    });
    const query = event.target.value.trim();
    window.clearTimeout(timer);
    const current = ++request;
    if (query.length < 4) {
      hideSuggestions(scope);
      return;
    }
    timer = window.setTimeout(async () => {
      try {
        const { suggestions, hint } = await lookupAddresses(query);
        if (current !== request) return;
        render(scope, suggestions, hint);
      } catch {
        if (current === request) hideSuggestions(scope);
      }
    }, 280);
  });

  document.addEventListener("click", (event) => {
    if (form.contains(event.target) && event.target.closest("[data-address-suggestions]")) return;
    form.querySelectorAll("[data-address-suggestions]").forEach((list) => {
      list.hidden = true;
      list.innerHTML = "";
    });
  });
}

function hasCompleteAddress(scope) {
  const fields = addressInputs(scope);
  return Boolean(
    fields.street?.value.trim() &&
    fields.city?.value.trim() &&
    fields.region?.value.trim() &&
    fields.postal?.value.trim() &&
    (fields.country?.value.trim() || "United States")
  );
}

function householdAddressScopes(form) {
  const cards = [...form.querySelectorAll("[data-party-member]")];
  return cards.length ? cards : [form];
}

function setMemberEditing(card, open) {
  if (!card?.matches?.("[data-party-member]")) return;
  card.classList.toggle("is-editing", open);
  const panel = card.querySelector("[data-member-edit]");
  if (panel) panel.hidden = !open;
  const toggle = card.querySelector(".party-edit-toggle");
  if (toggle) {
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Save guest details" : "Edit guest");
    const label = toggle.querySelector("[data-edit-label]");
    if (label) label.textContent = open ? "Save" : "Edit";
  }
  equalizeLetterPanels(card.closest("form"));
}

function refreshMemberSummary(card) {
  if (!card?.matches?.("[data-party-member]")) return;
  const name = card.querySelector("[data-member-name]");
  const first = card.querySelector("input[name^='memberFirst']")?.value.trim() || "";
  const last = card.querySelector("input[name^='memberLast']")?.value.trim() || "";
  const phone = formatPhone(card.querySelector("input[name^='memberPhone']")?.value || "");
  const email = card.querySelector("input[name^='memberEmail']")?.value.trim() || "";
  if (name) name.textContent = `${first} ${last}`.trim() || "Guest";
  const contact = card.querySelector("[data-member-contact]");
  if (contact) contact.innerHTML = memberContactLine(phone, email, addressRecord(card));
  equalizeLetterPanels(card.closest("form"));
}

function validateHouseholdDetails(form) {
  for (const scope of householdAddressScopes(form)) {
    const fields = addressInputs(scope);
    if (fields.search?.value.trim() || hasCompleteAddress(scope)) continue;
    setMemberEditing(scope, true);
    fields.search?.focus();
    const errorNode = form.querySelector("[data-form-error]");
    if (errorNode) errorNode.textContent = "Please enter a mailing address for each guest.";
    return false;
  }
  return true;
}

async function resolveScopeAddress(form, scope) {
  if (hasCompleteAddress(scope)) return true;
  const query = addressInputs(scope).search?.value.trim() || "";
  if (query.length < 4) return false;
  const { suggestions, hint } = await lookupAddresses(query);
  if (suggestions.length === 1) {
    applyAddress(scope, suggestions[0]);
    refreshMemberSummary(scope);
    return true;
  }
  if (suggestions.length > 1) {
    const list = addressInputs(scope).list;
    if (list) {
      list.innerHTML = suggestions
        .map(
          (row, index) =>
            `<li><button type="button" data-address-index="${index}">${escapeAttr(row.label)}</button></li>`
        )
        .join("");
      list.hidden = false;
      list.querySelectorAll("[data-address-index]").forEach((button) => {
        button.addEventListener("click", () => {
          applyAddress(scope, suggestions[Number(button.dataset.addressIndex)]);
          hideSuggestions(scope);
          refreshMemberSummary(scope);
        });
      });
    }
  } else if (hint) {
    const errorNode = form.querySelector("[data-form-error]");
    if (errorNode) errorNode.textContent = hint;
  }
  return false;
}

async function resolveTypedAddress(form) {
  for (const scope of householdAddressScopes(form)) {
    if (await resolveScopeAddress(form, scope)) continue;
    setMemberEditing(scope, true);
    addressInputs(scope).search?.focus();
    return false;
  }
  return true;
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

function hidePrimaryFields(form) {
  ["firstName", "lastName", "phone", "email"].forEach((name) => {
    const input = form.querySelector(`[name='${name}']`);
    if (!input) return;
    input.required = false;
  });
  form.querySelectorAll(".form-grid").forEach((grid) => {
    if (grid.querySelector("[name='firstName']")) {
      grid.classList.add("is-hidden-primary");
      grid.hidden = true;
    }
  });
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

function namedMember(member) {
  return Boolean(
    String(member.first_name || member.firstName || "").trim() &&
    String(member.last_name || member.lastName || "").trim()
  );
}

function renderParty(form, guest, eventName) {
  const members = (guest.members || []).filter(namedMember).map((member) => ({ ...member }));
  if (!members.length) members.push({ first_name: "", last_name: "" });

  if (form.dataset.formKind !== "rsvp") form.dataset.formKind = "address";
  form.classList.add("is-party");
  hidePrimaryFields(form);

  const showRsvp = form.dataset.formKind === "rsvp";
  if (showRsvp) {
    hideAddressFields(form);
  } else {
    form.querySelectorAll(".rsvp-choices").forEach((node) => node.remove());
  }

  partyList(form).innerHTML = members.length
    ? `
    <div class="party-head" data-letter-panel>
      <p class="party-count">Your Party: ${members.length}</p>
    </div>
    ${partyCrease()}
    ${members.map((member, index) => `${memberTemplate(index, member, eventName, showRsvp)}${partyCrease()}`).join("")}
  `
    : "";

  const extras = form.querySelector("[data-guest-list]");
  if (extras) extras.hidden = true;
  watchLetterFolds(form);
  equalizeLetterPanels(form);
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
    maxParty: guest.maxParty,
    firstName: primary.firstName || "",
    lastName: primary.lastName || "",
    phone: primary.phone || "",
    email: primary.email || "",
    rsvp: primary.rsvp || "",
    kind: form.dataset.formKind || "address",
    street: primary.street || "",
    apt: primary.apt || "",
    city: primary.city || "",
    region: primary.region || "",
    postal: primary.postal || "",
    country: primary.country || "",
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
    signal: AbortSignal.timeout(25000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Something went wrong sending your address.");
  }
}

function bindForm(form, eventName, guest) {
  const partyMode = Boolean(guest.code && (guest.personalized || guest.members?.length || form.dataset.household));
  if (partyMode) {
    renderParty(form, guest, eventName);
    const submit = form.querySelector("[type='submit']");
    if (submit && form.dataset.formKind === "rsvp") submit.textContent = "Send RSVP";
    else if (submit && form.dataset.household === "true") {
      submit.textContent = "Confirm mailing details";
    } else if (submit && !form.classList.contains("find-invite") && submit.classList.contains("btn")) {
      submit.textContent = "Save our details";
    }
  } else if (form.dataset.formKind === "rsvp") {
    hideAddressFields(form);
    ensureRsvpField(form, eventName);
  }
  updateCap(form, guest);

  if (form.dataset.bound === "true") return;
  form.dataset.bound = "true";

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
      const open = !card.classList.contains("is-editing");
      setMemberEditing(card, open);
      if (open) {
        const label = editBtn.textContent || "";
        const focusName = label.includes("address")
          ? "memberAddress"
          : editBtn.classList.contains("party-add-email")
            ? "memberEmail"
            : "memberFirst";
        card.querySelector(`input[name^='${focusName}']`)?.focus();
      }
    }
  });

  form.addEventListener("keydown", (keyEvent) => {
    const input = keyEvent.target;
    if (!input.matches?.("input[type='tel']")) return;
    if (keyEvent.ctrlKey || keyEvent.metaKey || keyEvent.altKey) return;
    if (keyEvent.key.length === 1 && !/\d/.test(keyEvent.key)) keyEvent.preventDefault();
  });

  form.addEventListener("input", (inputEvent) => {
    if (inputEvent.target.matches("input[type='tel']")) {
      applyPhoneMask(inputEvent.target);
    }
    const button = form.querySelector("[type='submit']");
    if (form.dataset.household === "true" && button?.classList.contains("is-saved")) {
      button.textContent = "Confirm mailing details";
      button.classList.remove("is-saved");
    }
    const card = inputEvent.target.closest("[data-party-member]");
    if (card) refreshMemberSummary(card);
  });

  form.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    const honeypot = form.querySelector("[name='company']");
    if (honeypot && honeypot.value) {
      if (form.dataset.household === "true") {
        markHouseholdSaved(form);
      } else {
        form.hidden = true;
        successNode(form)?.removeAttribute("hidden");
      }
      return;
    }

    if (form.dataset.household === "true") {
      if (!validateHouseholdDetails(form)) return;
      if (!(await resolveTypedAddress(form))) {
        const errorNode = form.querySelector("[data-form-error]");
        if (errorNode && !errorNode.textContent) {
          errorNode.textContent = "Please choose a mailing address from the list for each guest.";
        }
        return;
      }
    }
    const payload = partyMode ? serializeParty(form, eventName, guest) : serialize(form, eventName, guest);
    if (form.dataset.household === "true") payload.kind = "address";
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
      if (form.dataset.household === "true") {
        markHouseholdSaved(form);
      } else {
        form.hidden = true;
        successNode(form)?.removeAttribute("hidden");
      }
    } catch (error) {
      if (errorNode) {
        const timedOut = error.name === "TimeoutError" || error.name === "AbortError";
        errorNode.textContent = timedOut
          ? "Saving took too long. Please try again."
          : error.message || "Something went wrong sending your address. Please try again.";
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

  const host = card.querySelector("[data-rsvp-form-host]") || card;
  const form = document.createElement("form");
  form.className = "address-form";
  form.dataset.formKind = "rsvp";
  form.setAttribute("data-address-form", "");
  form.innerHTML = `
    <input class="hp" type="text" name="company" tabindex="-1" autocomplete="off">
    <div class="form-actions">
      <button class="btn" type="submit">Send RSVP</button>
    </div>
    <p class="form-error" data-form-error></p>
  `;
  host.appendChild(form);
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

export function initHouseholdForm({ guest, form }) {
  if (!form) return;
  form.dataset.formKind = "address";
  form.dataset.household = "true";
  bindForm(form, guest.events?.[0] || "jersey", guest);
  bindAddressLookup(form);
}
