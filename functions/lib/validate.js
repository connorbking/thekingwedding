const EVENTS = new Set(["shower", "como", "jersey"]);
const TEXT_MAX = 40;
const EMAIL_MAX = 40;
const POSTAL_MAX = 10;

function text(value, { min = 1, max = TEXT_MAX } = {}) {
  const next = String(value || "").trim();
  if (next.length < min || next.length > max) return "";
  return next;
}

function tooLong(value, max) {
  return String(value || "").trim().length > max;
}

function phoneDigits(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("1")) digits = digits.slice(1);
  return digits;
}

function phoneValue(value) {
  const digits = phoneDigits(value);
  if (!digits) return "";
  if (digits.length > 10) return null;
  if (digits.length < 10) return digits;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function emailValue(value) {
  const next = String(value || "").trim();
  if (!next) return "";
  if (next.length > EMAIL_MAX) return null;
  return next;
}

function normalizeRsvp(value) {
  const key = text(value, { min: 0, max: 12 }).toLowerCase();
  if (key === "yes" || key === "no") {
    return key[0].toUpperCase() + key.slice(1);
  }
  return "";
}

function addressFields(body) {
  if (
    tooLong(body.street, TEXT_MAX) ||
    tooLong(body.apt, TEXT_MAX) ||
    tooLong(body.city, TEXT_MAX) ||
    tooLong(body.region, TEXT_MAX) ||
    tooLong(body.country, TEXT_MAX)
  ) {
    return { error: "Please keep each entry to 40 characters." };
  }
  if (tooLong(body.postal, POSTAL_MAX)) {
    return { error: "Postal codes must be 10 characters or fewer." };
  }
  return {
    street: text(body.street, { min: 0 }),
    apt: text(body.apt, { min: 0 }),
    city: text(body.city, { min: 0 }),
    region: text(body.region, { min: 0 }),
    postal: text(body.postal, { min: 0, max: POSTAL_MAX }),
    country: text(body.country, { min: 0 }),
  };
}

function guestFields(guest) {
  const address = addressFields(guest);
  if (address.error) return address;
  if (tooLong(guest.firstName || guest.first_name, TEXT_MAX) || tooLong(guest.lastName || guest.last_name, TEXT_MAX)) {
    return { error: "Please keep each entry to 40 characters." };
  }
  const phone = phoneValue(guest.phone);
  if (phone == null) return { error: "Enter a 10-digit phone number." };
  const email = emailValue(guest.email);
  if (email == null) return { error: "Email must be 40 characters or fewer." };
  return {
    id: text(guest.id, { min: 0, max: 240 }),
    firstName: text(guest.firstName || guest.first_name, { min: 0 }),
    lastName: text(guest.lastName || guest.last_name, { min: 0 }),
    phone,
    email,
    rsvp: normalizeRsvp(guest.rsvp),
    ...address,
  };
}

function validateParty(body, event) {
  const parsed = [];
  for (const guest of Array.isArray(body.guests) ? body.guests : []) {
    const fields = guestFields(guest);
    if (fields.error) return fields;
    if (fields.firstName || fields.lastName) parsed.push(fields);
  }
  const guests = parsed;

  if (!guests.length) return { error: "Add at least one guest in your party." };
  if (guests.some((guest) => !guest.firstName || !guest.lastName)) {
    return { error: "Each guest needs a first and last name." };
  }
  if (guests.some((guest) => guest.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email))) {
    return { error: "Please enter a valid email address." };
  }

  const isRsvp = text(body.kind || body.formKind, { min: 0, max: 20 }).toLowerCase() === "rsvp";
  const accessCode = text(body.accessCode || body.groupCode || body.code, { min: 0, max: 40 }).toUpperCase();
  if (isRsvp && !accessCode) return { error: "This invitation link is missing a group code." };
  if (isRsvp && guests.some((guest) => !guest.rsvp)) {
    return { error: "Please reply for each guest." };
  }

  const address = addressFields(guests[0] || {});
  const primary = guests[0] || {};
  return {
    submission: {
      event,
      kind: isRsvp ? "rsvp" : "address",
      accessCode,
      party: text(body.party || body.greeting, { min: 0, max: 160 }),
      firstName: primary.firstName,
      lastName: primary.lastName,
      phone: primary.phone,
      email: primary.email,
      ...address,
      guests,
      extras: guests.slice(1),
      partySize: guests.length,
    },
  };
}

export function validateSubmission(body) {
  if (body.company) return { honeypot: true };

  const event = text(body.event, { max: 20 }).toLowerCase();
  if (!EVENTS.has(event)) return { error: "Choose a celebration." };

  if (Array.isArray(body.guests)) return validateParty(body, event);

  if (tooLong(body.firstName, TEXT_MAX) || tooLong(body.lastName, TEXT_MAX)) {
    return { error: "Please keep each entry to 40 characters." };
  }
  const firstName = text(body.firstName);
  const lastName = text(body.lastName);
  const phone = phoneValue(body.phone);
  if (phone == null) return { error: "Enter a 10-digit phone number." };
  const email = emailValue(body.email);
  if (email == null) return { error: "Email must be 40 characters or fewer." };
  const address = addressFields(body);
  if (address.error) return address;

  if (!firstName || !lastName || !phone || !email || !address.street || !address.city || !address.region || !address.postal || !address.country) {
    return { error: "Please complete every required field." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  const extras = [];
  for (const guest of Array.isArray(body.additionalGuests) ? body.additionalGuests : []) {
    if (tooLong(guest.firstName, TEXT_MAX) || tooLong(guest.lastName, TEXT_MAX)) {
      return { error: "Please keep each entry to 40 characters." };
    }
    const extra = {
      firstName: text(guest.firstName, { min: 0 }),
      lastName: text(guest.lastName, { min: 0 }),
    };
    if (extra.firstName || extra.lastName) extras.push(extra);
  }

  return {
    submission: {
      event,
      rsvp: normalizeRsvp(body.rsvp),
      accessCode: text(body.accessCode, { min: 0, max: 40 }).toUpperCase(),
      party: text(body.party || body.greeting, { min: 0, max: 160 }),
      firstName,
      lastName,
      phone,
      email,
      ...address,
      extras,
      partySize: 1 + extras.length,
    },
  };
}
