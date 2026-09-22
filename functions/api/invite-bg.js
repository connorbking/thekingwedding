import { json } from "../lib/http.js";

export async function onRequestGet(context) {
  const variant = new URL(context.request.url).searchParams.get("variant");
  const assetPath =
    variant === "mobile" ? "/public/invite-bg-mobile.json" : "/public/invite-bg.json";
  try {
    const url = new URL(assetPath, context.request.url);
    const asset = await context.env.ASSETS.fetch(new Request(url.toString(), { method: "GET" }));
    if (asset.ok) {
      const data = await asset.json();
      const files = Array.isArray(data) ? data : data.files;
      if (Array.isArray(files)) return json({ files });
    }
  } catch {
    /* fall through */
  }
  return json({ files: [] });
}
