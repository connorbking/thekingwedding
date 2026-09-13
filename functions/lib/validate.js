const EVENTS = new Set(["como", "jersey"]);

function text(value, { min = 1, max = 160 } = {}) {
  const next = String(value || "").trim();
  if (next.length < min || next.length > max) return "";
  return next;
}

export function validateSubmission(body) {
  if (body.company) return { honeypot: true };

  const event = text(body.event, { max: 20 }).toLowerCase();
  if (!EVENTS.has(event)) return { error: "Choose a celebration." };

  const firstName = text(body.firstName);
  const lastName = text(body.lastName);
  const phone = text(body.phone, { max: 40 });
  const email = text(body.email, { max: 200 });
  const street = text(body.street, { max: 200 });
  const city = text(body.city);
  const region = text(body.region);
  const postal = text(body.postal, { max: 20 });
  const country = text(body.country);

  if (!firstName || !lastName || !phone || !email || !street || !city || !region || !postal || !country) {
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
      accessCode: text(body.accessCode, { min: 0, max: 40 }).toUpperCase(),
      firstName,
      lastName,
      phone,
      email,
      street,
      apt: text(body.apt, { min: 0, max: 80 }),
      city,
      region,
      postal,
      country,
      extras,
      partySize: 1 + extras.length,
    },
  };
}

export function validateInvite(body) {
  const code = text(body.code, { max: 40 }).toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const greeting = text(body.greeting, { max: 160 });
  const maxParty = Number(body.maxParty);
  const events = text(body.events || "como,jersey", { min: 0, max: 40 }).toLowerCase();
  const notes = text(body.notes, { min: 0, max: 300 });

  if (!code || !greeting) return { error: "A code and greeting are required." };
  if (!Number.isInteger(maxParty) || maxParty < 1 || maxParty > 20) {
    return { error: "Party size must be between 1 and 20." };
  }

  const allowed = events
    .split(",")
    .map((item) => item.trim())
    .filter((item) => EVENTS.has(item));
  if (!allowed.length) return { error: "Choose Lake Como, Whippany, or both." };

  return {
    invite: {
      code,
      greeting,
      maxParty,
      events: allowed.join(","),
      notes,
    },
  };
}
