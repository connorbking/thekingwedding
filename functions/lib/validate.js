const EVENTS = new Set(["shower", "como", "jersey"]);

function text(value, { min = 1, max = 160 } = {}) {
  const next = String(value || "").trim();
  if (next.length < min || next.length > max) return "";
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
  return {
    street: text(body.street, { max: 200 }),
    apt: text(body.apt, { min: 0, max: 80 }),
    city: text(body.city),
    region: text(body.region),
    postal: text(body.postal, { max: 20 }),
    country: text(body.country),
  };
}

function validateParty(body, event) {
  const accessCode = text(body.accessCode || body.groupCode || body.code, { min: 1, max: 40 }).toUpperCase();
  if (!accessCode) return { error: "This invitation link is missing a group code." };

  const guests = (Array.isArray(body.guests) ? body.guests : [])
    .map((guest) => ({
      id: text(guest.id, { min: 0, max: 240 }),
      firstName: text(guest.firstName || guest.first_name),
      lastName: text(guest.lastName || guest.last_name),
      phone: text(guest.phone, { min: 0, max: 40 }),
      email: text(guest.email, { min: 0, max: 200 }),
      rsvp: normalizeRsvp(guest.rsvp),
    }))
    .filter((guest) => guest.firstName || guest.lastName);

  if (!guests.length) return { error: "Add at least one guest in your party." };
  if (guests.some((guest) => !guest.firstName || !guest.lastName)) {
    return { error: "Each guest needs a first and last name." };
  }
  if (guests.some((guest) => guest.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email))) {
    return { error: "Please enter a valid email address." };
  }

  const isRsvp = text(body.kind || body.formKind, { min: 0, max: 20 }).toLowerCase() === "rsvp";
  if (isRsvp && guests.some((guest) => !guest.rsvp)) {
    return { error: "Please reply for each guest." };
  }

  const address = addressFields(body);
  if (!isRsvp && (!address.street || !address.city || !address.region || !address.postal || !address.country)) {
    return { error: "Please complete the mailing address for your party." };
  }

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

  const firstName = text(body.firstName);
  const lastName = text(body.lastName);
  const phone = text(body.phone, { max: 40 });
  const email = text(body.email, { max: 200 });
  const address = addressFields(body);

  if (!firstName || !lastName || !phone || !email || !address.street || !address.city || !address.region || !address.postal || !address.country) {
    return { error: "Please complete every required field." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  const extras = Array.isArray(body.additionalGuests)
    ? body.additionalGuests
        .map((guest) => ({
          firstName: text(guest.firstName),
          lastName: text(guest.lastName),
        }))
        .filter((guest) => guest.firstName || guest.lastName)
    : [];

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
