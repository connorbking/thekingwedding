export const CONTACT_EMAIL = "hello@theking.wedding";

export const API = {
  submissions: "/api/submissions",
  invite: "/api/invite",
};

export const DEFAULT_PARTY_SIZE = 2;

export const EVENTS = {
  como: {
    key: "como",
    iso: "2027-09-11T16:00:00+02:00",
    display: "11 September 2027",
    weekday: "Saturday",
    place: "Lake Como, Italy",
  },
  jersey: {
    key: "jersey",
    iso: "2027-10-02T16:00:00-04:00",
    display: "2 October 2027",
    weekday: "Saturday",
    place: "Whippany, New Jersey",
  },
};

/**
 * Personalized Save the Date links:
 *   https://theking.wedding/como/save-the-date?code=ROSSI
 *
 * maxParty includes the person filling the form.
 * Without a matching code, guests may add a +1 only.
 */
export const GUEST_CODES = {
  // https://theking.wedding/como/save-the-date?code=DEMO
  DEMO: { greeting: "our honored guests", maxParty: 4 },
  // KINGFAM: { greeting: "The King Family", maxParty: 6 },
};
