import { json } from "../lib/http.js";

const STATE_NAMES = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  "district of columbia": "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "puerto rico": "PR",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

function text(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function joinStreet(number, street) {
  return [number, street].map(text).filter(Boolean).join(" ");
}

function stateCode(value) {
  const raw = text(value).replace(/\./g, "");
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper) && Object.values(STATE_NAMES).includes(upper)) return upper;
  return STATE_NAMES[raw.toLowerCase()] || "";
}

function isUnitedStates(props, country) {
  const code = String(props?.countrycode || "").trim().toUpperCase();
  const name = text(country || props?.country).toLowerCase();
  return code === "US" || name === "united states" || name === "usa" || name === "united states of america";
}

function suggestion({ street, apt = "", city, region, postal }) {
  const state = stateCode(region) || text(region);
  const zip = text(postal);
  if (!street || !city || !state || !zip) return null;
  const label = [street, apt, `${city}, ${state} ${zip}`].filter(Boolean).join(", ");
  return { label, street, apt: text(apt), city, region: state, postal: zip, country: "United States" };
}

function censusMatches(data) {
  const matches = data?.result?.addressMatches;
  if (!Array.isArray(matches)) return [];
  return matches
    .map((match) => {
      const parts = match.addressComponents || {};
      const street = joinStreet(parts.fromAddress || parts.toAddress, [parts.preType, parts.preDirection, parts.streetName, parts.suffixType, parts.suffixDirection].filter(Boolean).join(" "));
      return suggestion({
        street,
        city: text(parts.city),
        region: text(parts.state),
        postal: text(parts.zip),
      });
    })
    .filter(Boolean);
}

function photonMatches(data) {
  const features = data?.features;
  if (!Array.isArray(features)) return [];
  return features
    .map((feature) => {
      const props = feature.properties || {};
      if (!isUnitedStates(props, props.country)) return null;
      return suggestion({
        street: joinStreet(props.housenumber, props.street || props.name),
        city: text(props.city || props.town || props.village || props.locality),
        region: text(props.state),
        postal: text(props.postcode),
      });
    })
    .filter(Boolean);
}

async function lookupCensus(query) {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", query);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!response.ok) return [];
  return censusMatches(await response.json().catch(() => ({})));
}

async function lookupPhoton(query) {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "15");
  url.searchParams.set("lang", "en");
  url.searchParams.set("lat", "39.8283");
  url.searchParams.set("lon", "-98.5795");
  const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!response.ok) return [];
  return photonMatches(await response.json().catch(() => ({})));
}

function unique(suggestions) {
  const seen = new Set();
  return suggestions.filter((row) => {
    const key = row.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function onRequestGet(context) {
  const query = text(new URL(context.request.url).searchParams.get("q"));
  if (query.length < 4 || query.length > 160) return json({ suggestions: [] });

  try {
    const [census, photon] = await Promise.all([lookupCensus(query), lookupPhoton(query)]);
    return json({ suggestions: unique([...photon, ...census]).slice(0, 6) });
  } catch {
    return json({ suggestions: [] }, 502);
  }
}
