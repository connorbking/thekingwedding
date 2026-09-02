export function initEnvelope(root = document) {
  const envelope = root.querySelector("[data-envelope]");
  if (!envelope) return;

  const open = () => {
    if (envelope.classList.contains("is-open")) return;
    envelope.classList.add("is-open");
    envelope.setAttribute("aria-expanded", "true");
    const hint = envelope.parentElement?.querySelector("[data-envelope-hint]");
    if (hint) hint.classList.add("is-hidden");
  };

  envelope.addEventListener("click", (event) => {
    event.preventDefault();
    open();
  });

  envelope.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  });
}
