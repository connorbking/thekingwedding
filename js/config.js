export const CONTACT_EMAIL = "hello@theking.wedding";

export const API = {
  submissions: "/api/submissions",
  invite: "/api/invite",
  address: "/api/address",
};

export const DEFAULT_PARTY_SIZE = 2;

export const EVENTS = {
  shower: {
    key: "shower",
    iso: "2027-06-05T14:00:00-04:00",
    display: "5 June 2027",
    weekday: "Saturday",
    shortTitle: "Bridal Shower",
    place: "New Jersey",
    region: "New Jersey",
    calendar: "/public/calendar/shower.ics",
  },
  como: {
    key: "como",
    iso: "2027-09-11T16:00:00+02:00",
    display: "11 September 2027",
    weekday: "Saturday",
    shortTitle: "Lake Como",
    place: "Lake Como, Italy",
    region: "Italy",
    calendar: "/public/calendar/como.ics",
  },
  jersey: {
    key: "jersey",
    iso: "2027-10-02T16:00:00-04:00",
    display: "2 October 2027",
    weekday: "Saturday",
    shortTitle: "Whippany",
    place: "Whippany, New Jersey",
    region: "New Jersey",
    calendar: "/public/calendar/whippany.ics",
  },
};

export const EVENT_ORDER = ["shower", "como", "jersey"];

export function sortEvents(events) {
  const allowed = new Set(events || []);
  return EVENT_ORDER.filter((key) => allowed.has(key));
}

/**
 * Local fallback when the guest database is unavailable.
 * Live lookups use the group code stored in D1.
 */
export const GUEST_CODES = {
  DEMO: {
    greeting: "the Demo family",
    maxParty: 4,
    events: ["shower", "como", "jersey"],
    guests: [
      { first_name: "Demo", last_name: "Guest", como: true, jersey: true, shower: true },
      { first_name: "Plus", last_name: "One", como: true, jersey: true, shower: true },
    ],
  },
};

export const LOCAL_PEOPLE = [{ firstName: "Demo", lastName: "Guest", code: "DEMO" }];
