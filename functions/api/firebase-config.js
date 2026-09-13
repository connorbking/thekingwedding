import { publicFirebaseConfig } from "../lib/firebase.js";
import { json } from "../lib/http.js";

export function onRequestGet(context) {
  const config = publicFirebaseConfig(context.env);
  if (!config) {
    return json({ configured: false }, 503);
  }
  return json({ configured: true, firebase: config });
}
