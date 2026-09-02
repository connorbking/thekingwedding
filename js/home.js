function probeImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = `${src}?v=1`;
  });
}

async function loadPhotos() {
  const grid = document.querySelector("[data-photo-grid]");
  if (!grid) return;

  const found = [];
  for (let index = 1; index <= 8; index += 1) {
    const candidates = [
      `/img/engagement/${index}.jpg`,
      `/img/engagement/${index}.jpeg`,
      `/img/engagement/${index}.png`,
    ];
    let match = "";
    for (const src of candidates) {
      if (await probeImage(src)) {
        match = src;
        break;
      }
    }
    if (match) found.push(match);
  }

  if (!found.length) return;

  grid.innerHTML = found
    .map(
      (src, index) =>
        `<figure class="shot ${index === 0 ? "shot--wide" : ""}">
          <img src="${src}" alt="Alyssa and Connor">
        </figure>`
    )
    .join("");
}

function loadVideo() {
  const wrap = document.querySelector("[data-video-wrap]");
  const video = wrap?.querySelector("video");
  const source = video?.querySelector("source");
  if (!wrap || !video || !source) return;

  const test = document.createElement("video");
  test.preload = "metadata";
  test.src = source.getAttribute("src");
  test.addEventListener("loadeddata", () => {
    wrap.hidden = false;
  });
  test.addEventListener("error", () => {});
}

loadPhotos();
loadVideo();
