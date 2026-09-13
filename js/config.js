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
 * Local fallbacks when the Google Sheet API is unavailable.
 * Live lookups use Group Code on the guest spreadsheet.
 */
export const GUEST_CODES = {
  DEMO: {
    greeting: "the Demo family",
    maxParty: 4,
    events: ["como", "jersey"],
    guests: [
      { first_name: "Demo", last_name: "Guest" },
      { first_name: "Plus", last_name: "One" },
    ],
  },
};

export const LOCAL_PEOPLE = [{ firstName: "Demo", lastName: "Guest", code: "DEMO" }];
