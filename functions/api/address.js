import { json } from "../lib/http.js";

function text(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function joinStreet(number, street) {
  return [number, street].map(text).filter(Boolean).join(" ");
}

function censusMatches(data) {
  const matches = data?.result?.addressMatches;
  if (!Array.isArray(matches)) return [];
  return matches
    .map((match) => {
      const parts = match.addressComponents || {};
      const street = joinStreet(parts.fromAddress || parts.toAddress, [parts.preType, parts.preDirection, parts.streetName, parts.suffixType, parts.suffixDirection].filter(Boolean).join(" "));
      const city = text(parts.city);
      const region = text(parts.state);
      const postal = text(parts.zip);
      if (!street || !city || !region) return null;
      return {
        label: text(match.matchedAddress) || `${street}, ${city}, ${region} ${postal}`.trim(),
        street,
        apt: "",
        city,
        region,
        postal,
        country: "United States",
      };
    })
    .filter(Boolean);
}

function isUnitedStates(props, country) {
  const code = String(props?.countrycode || "").trim().toUpperCase();
  const name = text(country || props?.country).toLowerCase();
  return code === "US" || name === "united states" || name === "usa" || name === "united states of america";
}

function photonMatches(data) {
  const features = data?.features;
  if (!Array.isArray(features)) return [];
  return features
    .map((feature) => {
      const props = feature.properties || {};
      const street = joinStreet(props.housenumber, props.street || props.name);
      const city = text(props.city || props.town || props.village || props.locality);
      const region = text(props.state);
      const postal = text(props.postcode);
      const country = text(props.country);
      if (!street || !city || !isUnitedStates(props, country)) return null;
      const label = [street, city, region, postal, "United States"].filter(Boolean).join(", ");
      return { label, street, apt: "", city, region, postal, country: "United States" };
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
    return json({ suggestions: unique([...census, ...photon]).slice(0, 6) });
  } catch {
    return json({ suggestions: [] }, 502);
  }
}
