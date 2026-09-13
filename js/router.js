import { resolveGuest, withCode } from "./guests.js";

const VIEW_IDS = ["save-the-date", "rsvp", "faq"];

function viewFromPath(pathname, base) {
  const prefix = base.endsWith("/") ? base.slice(0, -1) : base;
  let rest = pathname;
  if (rest.startsWith(prefix)) rest = rest.slice(prefix.length);
  rest = rest.replace(/^\/+|\/+$/g, "").replace(/index\.html$/i, "");
  if (!rest || rest === "save-the-date") return "save-the-date";
  if (VIEW_IDS.includes(rest)) return rest;
  return "save-the-date";
}

function urlForView(base, view) {
  const prefix = base.endsWith("/") ? base.slice(0, -1) : base;
  const guest = resolveGuest();
  return withCode(`${prefix}/${view}`, guest?.code);
}

function showView(view) {
  document.querySelectorAll("[data-view]").forEach((el) => {
    el.classList.toggle("is-active", el.dataset.view === view);
  });
  document.querySelectorAll("[data-nav]").forEach((el) => {
    const active = el.dataset.nav === view;
    el.classList.toggle("is-active", active);
    if (active) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
  document.body.dataset.activeView = view;
  const titleBase = document.body.dataset.titleBase || "The King Wedding";
  const labels = {
    "save-the-date": "Save the Date",
    rsvp: "RSVP",
    faq: "FAQ",
  };
  document.title = `${labels[view] || "Invitation"} · ${titleBase}`;
  window.scrollTo(0, 0);
}

export function initRouter({ base }) {
  const go = (view, push) => {
    if (!VIEW_IDS.includes(view)) view = "save-the-date";
    if (push) {
      window.history.pushState({ view }, "", urlForView(base, view));
    }
    showView(view);
  };

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-route]");
    if (!link) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const url = new URL(link.href, window.location.origin);
    if (url.origin !== window.location.origin) return;
    if (!url.pathname.startsWith(base.endsWith("/") ? base.slice(0, -1) : base)) return;
    event.preventDefault();
    go(viewFromPath(url.pathname, base), true);
  });

  window.addEventListener("popstate", () => {
    showView(viewFromPath(window.location.pathname, base));
  });

  showView(viewFromPath(window.location.pathname, base));

  return { go };
}
