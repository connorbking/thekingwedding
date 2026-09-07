export const GAS_URL = "";

export const CONTACT_EMAIL = "hello@theking.wedding";

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
 * Local mock codes — lookup happens in js/guests.js from this object.
 * Cloudflare D1 is not used locally.
 *
 *   BOTH     — Lake Como + New Jersey
 *   KING     — Lake Como + New Jersey (larger party)
 *   NJ       — New Jersey only
 *   SMITH    — New Jersey only
 */
export const GUEST_CODES = {
  BOTH: { greeting: "our honored guests", maxParty: 4, events: ["como", "jersey"] },
  DEMO: { greeting: "our honored guests", maxParty: 4, events: ["como", "jersey"] },
  KING: { greeting: "the King family", maxParty: 6, events: ["como", "jersey"] },
  NJ: { greeting: "our New Jersey guests", maxParty: 2, events: ["jersey"] },
  SMITH: { greeting: "the Smith family", maxParty: 2, events: ["jersey"] },
};
