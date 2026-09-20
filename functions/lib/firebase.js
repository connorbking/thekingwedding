const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let certCache = { at: 0, certs: null, ttl: 3_600_000 };

function b64urlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeJson(part) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
}

async function googleCerts() {
  if (certCache.certs && Date.now() - certCache.at < certCache.ttl) {
    return certCache.certs;
  }
  const response = await fetch(CERTS_URL);
  if (!response.ok) throw new Error("Could not load Google signing certificates.");
  const certs = await response.json();
  certCache = { at: Date.now(), certs, ttl: 3_600_000 };
  return certs;
}

async function importCertKey(pem) {
  const { X509Certificate } = await import("node:crypto");
  const certificate = new X509Certificate(pem);
  const spki = certificate.publicKey.export({ type: "spki", format: "der" });
  return crypto.subtle.importKey(
    "spki",
    spki,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

async function verifyWithJwks(projectId, idToken) {
  const parts = String(idToken).split(".");
  if (parts.length !== 3) return null;
  const header = decodeJson(parts[0]);
  const payload = decodeJson(parts[1]);
  if (header.alg !== "RS256" || !header.kid) return null;
  if (payload.aud !== projectId) return null;
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
  if (!payload.exp || payload.exp * 1000 < Date.now() - 30_000) return null;
  if (payload.email_verified !== true || !payload.email) return null;

  const certs = await googleCerts();
  const pem = certs[header.kid];
  if (!pem) return null;
  const key = await importCertKey(pem);
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!ok) return null;
  return { email: String(payload.email).toLowerCase(), uid: payload.sub || "" };
}

async function verifyWithLookup(env, idToken) {
  if (!env.FIREBASE_API_KEY) return null;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!response.ok) return null;
  const data = await response.json();
  const user = data.users?.[0];
  if (!user?.email) return null;
  const verified = user.emailVerified === true || user.emailVerified === "true";
  if (!verified) return null;
  return { email: String(user.email).toLowerCase(), uid: user.localId || "" };
}

export async function verifyFirebaseIdToken(env, idToken) {
  if (!idToken || !env.FIREBASE_PROJECT_ID) return null;
  try {
    const verified = await verifyWithJwks(env.FIREBASE_PROJECT_ID, idToken);
    if (verified) return verified;
  } catch {
    // Fall through to Identity Toolkit lookup.
  }
  return verifyWithLookup(env, idToken);
}

export function allowedAdminEmails(env) {
  return String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdmin(env, email) {
  const allowed = allowedAdminEmails(env);
  return Boolean(email) && allowed.includes(String(email).toLowerCase());
}

export function publicFirebaseConfig(env) {
  if (!env.FIREBASE_API_KEY || !env.FIREBASE_PROJECT_ID || !env.FIREBASE_AUTH_DOMAIN || !env.FIREBASE_APP_ID) {
    return null;
  }
  return {
    apiKey: env.FIREBASE_API_KEY,
    authDomain: env.FIREBASE_AUTH_DOMAIN,
    projectId: env.FIREBASE_PROJECT_ID,
    appId: env.FIREBASE_APP_ID,
  };
}
