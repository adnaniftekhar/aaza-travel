// Helper functions used across pages.

const AAZA_HASHTAG = /#aaza\w+/i;

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function todayIso(today) {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getCurrentStop(stops, today) {
  const day = todayIso(today);
  const matches = stops.filter((s) => day >= s.start && day <= s.end);
  if (!matches.length) return null;
  // Prefer the latest-starting overlap (more specific than a long parent range).
  return matches.reduce((best, s) => {
    if (s.start > best.start) return s;
    if (s.start === best.start && s.end < best.end) return s;
    return best;
  });
}

function getNextStop(stops, today) {
  const current = getCurrentStop(stops, today);
  if (current) {
    const idx = stops.findIndex(
      (s) => s.city === current.city && s.start === current.start,
    );
    return idx >= 0 ? stops[idx + 1] || null : null;
  }
  const day = todayIso(today);
  return stops.find((s) => s.start > day) || null;
}

function formatAuthorName(name) {
  const raw = (name || "").trim();
  if (!raw) return "";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function authorChip(name) {
  const label = formatAuthorName(name);
  if (!label) return "";
  return `<span class="author-chip">${escapeHtml(label)}</span>`;
}

function renderInstagramLinks(containerId) {
  const el = document.getElementById(containerId);
  if (!el || typeof INSTAGRAM === "undefined") return;

  el.innerHTML = `
    <a class="ig-btn" href="${INSTAGRAM.adnan.url}" target="_blank" rel="noopener">
      Follow @${escapeHtml(INSTAGRAM.adnan.handle)}
    </a>
    <a class="ig-btn" href="${INSTAGRAM.amy.url}" target="_blank" rel="noopener">
      Follow @${escapeHtml(INSTAGRAM.amy.handle)}
    </a>`;
}

async function renderWhereBanner(containerId) {
  const el = document.getElementById(containerId);
  if (!el || typeof ITINERARY === "undefined") return;

  const now = new Date();
  const current = getCurrentStop(ITINERARY, now);
  const next = getNextStop(ITINERARY, now);
  if (!current && !next) {
    el.hidden = true;
    return;
  }

  const [feed, archive] = await Promise.all([
    loadJsonArray("js/feed.json"),
    loadJsonArray("js/feed-archive.json"),
  ]);
  const posts = mergePostsById(feed, archive);
  const usedIds = new Set();
  const stop = current || next;
  const photo = current
    ? "photos/hero.jpg"
    : pickItineraryPhoto(stop, posts, usedIds, todayIso(now));
  const mapUrl =
    stop.lat != null && stop.lon != null
      ? mapEmbedUrl(stop.lat, stop.lon, stop.mapPad || 0.35)
      : "";

  const heading = current
    ? `We are in <strong>${escapeHtml(current.city)}</strong>`
    : `Next stop: <strong>${escapeHtml(next.city)}</strong>`;
  const place = current || next;
  const dates = `${formatDate(place.start)} → ${formatDate(place.end)}`;
  const nextLine =
    current && next
      ? `<p class="where-next">Next: <strong>${escapeHtml(next.city)}</strong> · ${formatDate(next.start)}</p>`
      : "";

  el.hidden = false;
  el.classList.add("where-card");
  el.innerHTML = `
    <div class="where-card-photo">
      ${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(place.city)}">` : ""}
    </div>
    <div class="where-card-copy">
      <p class="where-kicker">${current ? "Right now" : "Coming up"}</p>
      <h2>${heading}</h2>
      <p class="muted">${escapeHtml(place.city)}, ${escapeHtml(place.country)} · ${escapeHtml(dates)}</p>
      ${nextLine}
      <a class="where-link" href="itinerary.html">See the full itinerary →</a>
    </div>
    <div class="where-card-map">
      ${
        mapUrl
          ? `<iframe class="itinerary-map" title="Map of ${escapeHtml(place.city)}" src="${mapUrl}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`
          : ""
      }
    </div>`;
}

function feedImageUrl(item) {
  const url = item.image || item.media_url || "";
  const isVideo =
    item.mediaType === "VIDEO" ||
    item.mediaType === "REELS" ||
    url.includes(".mp4");
  if (isVideo && url.includes(".mp4")) return "";
  return url;
}

const COLOR_WORDS = [
  "EYE",
  "YELLOW",
  "ORANGE",
  "GREEN",
  "RED",
  "BLUE",
  "PURPLE",
  "PINK",
  "VIOLET",
  "INDIGO",
  "BLACK",
  "WHITE",
  "BROWN",
  "GRAY",
  "GREY",
  "GOLD",
  "SILVER",
  "TURQUOISE",
  "TEAL",
  "CYAN",
  "AQUA",
  "NAVY",
  "MAGENTA",
  "CORAL",
  "MAROON",
  "OLIVE",
  "LIME",
  "BEIGE",
  "CREAM",
  "IVORY",
  "CRIMSON",
  "SCARLET",
  "AMBER",
  "LAVENDER",
  "PEACH",
  "MINT",
  "FUCHSIA",
  "CHARTREUSE",
  "BURGUNDY",
  "MUSTARD",
  "SAFFRON",
  "COBALT",
  "AZURE",
  "CERULEAN",
  "EMERALD",
  "JADE",
  "SAGE",
  "KHAKI",
  "TAN",
  "RUST",
  "COPPER",
  "BRONZE",
  "LIGHT",
  "DARK",
  "DEEP",
  "BRIGHT",
  "PALE",
  "SOFT",
  "HOT",
  "NEON",
  "ROYAL",
  "FOREST",
  "SEA",
  "SKY",
  "BABY",
];

const COLOR_WORD_RE = COLOR_WORDS.join("|");
const COLOR_POST_RE = new RegExp(
  `^((?:(?:${COLOR_WORD_RE})\\s+)*(?:${COLOR_WORD_RE}))\\s*:`,
  "im",
);

// Map shade names to the family chip they belong under.
const COLOR_FAMILY_ALIASES = {
  TURQUOISE: "BLUE",
  TEAL: "BLUE",
  CYAN: "BLUE",
  AQUA: "BLUE",
  NAVY: "BLUE",
  COBALT: "BLUE",
  AZURE: "BLUE",
  CERULEAN: "BLUE",
  SKY: "BLUE",
  SEA: "BLUE",
  EMERALD: "GREEN",
  JADE: "GREEN",
  SAGE: "GREEN",
  OLIVE: "GREEN",
  LIME: "GREEN",
  MINT: "GREEN",
  FOREST: "GREEN",
  CHARTREUSE: "GREEN",
  LAVENDER: "PURPLE",
  MAGENTA: "PINK",
  FUCHSIA: "PINK",
  CORAL: "ORANGE",
  PEACH: "ORANGE",
  AMBER: "ORANGE",
  MUSTARD: "YELLOW",
  SAFFRON: "YELLOW",
  CREAM: "WHITE",
  IVORY: "WHITE",
  BEIGE: "BROWN",
  TAN: "BROWN",
  KHAKI: "BROWN",
  RUST: "BROWN",
  COPPER: "BROWN",
  BRONZE: "BROWN",
  MAROON: "RED",
  CRIMSON: "RED",
  SCARLET: "RED",
  BURGUNDY: "RED",
  GREY: "GRAY",
};

const COLOR_MODIFIERS = new Set([
  "LIGHT",
  "DARK",
  "DEEP",
  "BRIGHT",
  "PALE",
  "SOFT",
  "HOT",
  "NEON",
  "ROYAL",
  "FOREST",
  "SEA",
  "SKY",
  "BABY",
]);

function parseColorFromCaption(caption) {
  const match = (caption || "").trim().match(COLOR_POST_RE);
  return match ? match[1].replace(/\s+/g, " ").toUpperCase() : "";
}

function colorFamily(label) {
  if (!label) return "";
  const parts = label.split(/\s+/).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (COLOR_MODIFIERS.has(part)) continue;
    if (COLOR_FAMILY_ALIASES[part]) return COLOR_FAMILY_ALIASES[part];
    return part;
  }
  return parts[parts.length - 1] || "";
}

function colorCaptionText(caption, color) {
  if (!color) return caption || "";
  const escaped = color.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const prefix = new RegExp(`^${escaped}\\s*:\\s*`, "i");
  return (caption || "").replace(prefix, "").trim();
}

function colorSlug(label) {
  return (label || "").toLowerCase().replace(/\s+/g, "-");
}

function postMatchesColorFilter(label, filter) {
  if (!filter || filter === "ALL") return true;
  const upper = (label || "").toUpperCase();
  if (colorFamily(upper) === filter) return true;
  return new RegExp(`\\b${filter}\\b`, "i").test(upper);
}

function mergePostsById(...arrays) {
  const seen = new Map();
  for (const arr of arrays) {
    for (const post of arr || []) {
      if (post && post.id) seen.set(post.id, post);
    }
  }
  return [...seen.values()];
}

function filterColorPosts(items) {
  return (items || [])
    .filter((item) => parseColorFromCaption(item.caption))
    .sort((a, b) => new Date(b.date || b.timestamp || 0) - new Date(a.date || a.timestamp || 0));
}

function feedCardMedia(item, caption) {
  const img = feedImageUrl(item);
  const isVideo =
    item.mediaType === "VIDEO" ||
    item.mediaType === "REELS" ||
    (item.image || "").includes(".mp4");

  if (img) {
    return `<img src="${escapeHtml(img)}" alt="${escapeHtml(caption)}" loading="lazy">`;
  }

  if (isVideo) {
    return `<div class="feed-video-placeholder" aria-label="Video post"><span class="play-btn">▶</span><span class="play-label">Video</span></div>`;
  }

  return `<div class="feed-video-placeholder" aria-label="Post"><span class="play-label">View post</span></div>`;
}

function renderFeed(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (!items || items.length === 0) {
    el.innerHTML = `
      <div class="feed-empty">
        <p>No Instagram posts yet.</p>
        <p class="muted">Follow along on Instagram — new photos will show up here.</p>
        <div class="ig-links" style="justify-content:center"></div>
      </div>`;
    const links = el.querySelector(".ig-links");
    if (links && typeof INSTAGRAM !== "undefined") {
      links.innerHTML = `
        <a class="ig-btn" href="${INSTAGRAM.adnan.url}" target="_blank" rel="noopener">@${escapeHtml(INSTAGRAM.adnan.handle)}</a>
        <a class="ig-btn" href="${INSTAGRAM.amy.url}" target="_blank" rel="noopener">@${escapeHtml(INSTAGRAM.amy.handle)}</a>`;
    }
    return;
  }

  el.innerHTML = items
    .map((item) => {
      const href = item.permalink || "#";
      const caption = item.caption || "";
      const author = item.author || "";
      const date = item.date || item.timestamp || "";

      return `
    <a class="feed-card" href="${escapeHtml(href)}" target="_blank" rel="noopener">
      ${feedCardMedia(item, caption)}
      <div class="feed-card-body">
        <p class="meta">${escapeHtml(author)} · ${formatDate(date)}</p>
        <p class="caption">${escapeHtml(caption)}</p>
        <span class="view-ig">View on Instagram →</span>
      </div>
    </a>`;
    })
    .join("");
}

async function loadJsonArray(path) {
  try {
    const res = await fetch(`${path}?v=${Date.now()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Load Instagram's embed script once, then (re)process any embed blockquotes.
function processInstagramEmbeds() {
  if (window.instgrm && window.instgrm.Embeds) {
    window.instgrm.Embeds.process();
    return;
  }
  if (document.getElementById("ig-embed-js")) return;
  const s = document.createElement("script");
  s.id = "ig-embed-js";
  s.async = true;
  s.src = "https://www.instagram.com/embed.js";
  document.body.appendChild(s);
}

// Public posts we can't reach through the API (e.g. collab posts) are shown as
// official Instagram embeds, listed by URL in js/manual-posts.json.
function renderManualEmbeds(items) {
  return (items || [])
    .map((item) => {
      const url = typeof item === "string" ? item : item && item.permalink;
      if (!url) return "";
      return `<blockquote class="instagram-media feed-embed"
        data-instgrm-permalink="${escapeHtml(url)}"
        data-instgrm-version="14"></blockquote>`;
    })
    .join("");
}

function renderColorPalette(containerId, items, activeFilter, onFilter) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const families = [
    ...new Set(items.map((item) => colorFamily(parseColorFromCaption(item.caption)))),
  ]
    .filter(Boolean)
    .sort();

  if (families.length === 0) {
    el.hidden = true;
    return;
  }

  el.hidden = false;
  const chips = [
    `<button type="button" class="color-chip color-chip--all${
      !activeFilter || activeFilter === "ALL" ? " is-active" : ""
    }" data-color="ALL">All</button>`,
    ...families.map((color) => {
      const active = activeFilter === color ? " is-active" : "";
      return `<button type="button" class="color-chip color-chip--${colorSlug(
        color,
      )}${active}" data-color="${escapeHtml(color)}">${escapeHtml(color)}</button>`;
    }),
  ];
  el.innerHTML = chips.join("");

  el.querySelectorAll(".color-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const next = chip.getAttribute("data-color") || "ALL";
      onFilter(next === activeFilter ? "ALL" : next);
    });
  });
}

function renderColorsFeed(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (!items || items.length === 0) {
    el.innerHTML = `
      <div class="feed-empty">
        <p>No color or theme posts yet.</p>
        <p class="muted">Amy’s color and theme hunts will appear here.</p>
      </div>`;
    return;
  }

  el.innerHTML = items
    .map((item) => {
      const href = item.permalink || "#";
      const color = parseColorFromCaption(item.caption);
      const family = colorFamily(color);
      const caption = colorCaptionText(item.caption, color);
      const author = item.author || "";
      const date = item.date || item.timestamp || "";
      const colorClass = family ? ` color-card--${colorSlug(family)}` : "";

      return `
    <a class="feed-card color-card${colorClass}" href="${escapeHtml(href)}" target="_blank" rel="noopener">
      ${color ? `<span class="color-badge">${escapeHtml(color)}</span>` : ""}
      ${feedCardMedia(item, caption)}
      <div class="feed-card-body">
        <p class="meta">${escapeHtml(author)} · ${formatDate(date)}</p>
        <p class="caption">${escapeHtml(caption)}</p>
        <span class="view-ig">View on Instagram →</span>
      </div>
    </a>`;
    })
    .join("");
}

async function loadColorsPage(feedId, paletteId) {
  const [feed, archive] = await Promise.all([
    loadJsonArray("js/feed.json"),
    loadJsonArray("js/feed-archive.json"),
  ]);

  const colorPosts = filterColorPosts(mergePostsById(feed, archive));
  let activeFilter = "ALL";

  function paint() {
    const visible =
      activeFilter === "ALL"
        ? colorPosts
        : colorPosts.filter((item) =>
            postMatchesColorFilter(parseColorFromCaption(item.caption), activeFilter),
          );
    renderColorPalette(paletteId, colorPosts, activeFilter, (next) => {
      activeFilter = next;
      paint();
    });
    renderColorsFeed(feedId, visible);
  }

  paint();
}

async function loadInstagramFeed(containerId) {
  const [auto, manual] = await Promise.all([
    loadJsonArray("js/feed.json"),
    loadJsonArray("js/manual-posts.json"),
  ]);

  const el = document.getElementById(containerId);
  if (!el) return;

  const hasContent = (auto && auto.length) || (manual && manual.length);
  if (!hasContent) {
    renderFeed(containerId, []);
    return;
  }

  let cardsHtml = "";
  if (auto && auto.length) {
    renderFeed(containerId, auto);
    cardsHtml = el.innerHTML;
  }
  el.innerHTML = renderManualEmbeds(manual) + cardsHtml;

  if (manual && manual.length) processInstagramEmbeds();
}

function blogPostUrl(post) {
  const key = post.slug || post.id || "";
  return `post.html?p=${encodeURIComponent(key)}`;
}

function findBlogPost(posts, key) {
  if (!key || !posts) return null;
  const decoded = decodeURIComponent(key);
  return (
    posts.find((post) => post.slug === decoded) ||
    posts.find((post) => post.id === decoded) ||
    null
  );
}

function renderBlog(containerId, posts) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (!posts || posts.length === 0) {
    el.innerHTML = `
      <div class="feed-empty">
        <p>No blog posts yet.</p>
        <p class="muted">New posts from our journal will appear here automatically.</p>
      </div>`;
    return;
  }

  el.innerHTML = posts
    .map((post) => {
      const href = blogPostUrl(post);
      const image = post.image
        ? `<img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" loading="lazy">`
        : "";
      return `
    <article class="blog-card">
      <a class="blog-card-link" href="${escapeHtml(href)}">
        ${image}
        <div class="blog-card-body">
          <p class="meta">${authorChip(post.author)} <span>${formatDate(post.updated || post.date)}</span></p>
          <h2>${escapeHtml(post.title)}</h2>
          <p class="blog-excerpt">${escapeHtml(post.excerpt)}</p>
          <span class="view-ig">Read full post →</span>
        </div>
      </a>
    </article>`;
    })
    .join("");
}

async function loadBlog(containerId, options) {
  const limit = options && options.limit;
  try {
    const res = await fetch(`js/blog.json?v=${Date.now()}`);
    if (!res.ok) throw new Error("Blog not found");
    const posts = await res.json();
    const list = Array.isArray(posts) ? posts : [];
    renderBlog(containerId, typeof limit === "number" ? list.slice(0, limit) : list);
  } catch {
    renderBlog(containerId, []);
  }
}

function setupBlogScroll(articleEl) {
  const body = articleEl.querySelector(".post-body");
  const btn = articleEl.querySelector(".post-scroll-btn");
  if (!body || !btn || btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";

  function updateScrollUi() {
    const overflow = body.scrollHeight > body.clientHeight + 8;
    const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 12;
    btn.hidden = !overflow || atBottom;
  }

  btn.addEventListener("click", () => {
    body.scrollBy({ top: Math.max(160, body.clientHeight * 0.7), behavior: "smooth" });
  });

  body.addEventListener("scroll", updateScrollUi, { passive: true });
  window.addEventListener("resize", updateScrollUi);
  updateScrollUi();
  // Images / fonts can change height after load.
  setTimeout(updateScrollUi, 300);
  setTimeout(updateScrollUi, 1000);
}

function applyPostOrientation(article, img) {
  if (!article || !img || !img.naturalWidth) return;
  const isPortrait = img.naturalHeight > img.naturalWidth * 1.05;
  article.classList.toggle("post--portrait", isPortrait);
  article.classList.toggle("post--landscape", !isPortrait);
}

function renderBlogPost(containerId, post) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (!post) {
    el.innerHTML = `
      <div class="feed-empty">
        <p>Post not found.</p>
        <p class="muted"><a href="blog.html">← Back to the journal</a></p>
      </div>`;
    return;
  }

  const orientation = post.orientation || "landscape";
  const layoutClass =
    orientation === "portrait" ? "post--portrait" : "post--landscape";
  const image = post.image
    ? `<figure class="post-image">
        <img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" loading="eager">
      </figure>`
    : "";
  const bodyHtml = post.body || `<p>${escapeHtml(post.excerpt || "")}</p>`;

  el.innerHTML = `
    <article class="post ${layoutClass}">
      <a class="post-back" href="blog.html">← Journal</a>
      ${image}
      <div class="post-content">
        <p class="meta">${authorChip(post.author)} <span>${formatDate(post.updated || post.date)}</span></p>
        <h1>${escapeHtml(post.title)}</h1>
        <div class="post-body-wrap">
          <div class="post-body">${bodyHtml}</div>
          <button type="button" class="post-scroll-btn" hidden>Scroll for more ↓</button>
        </div>
        <p class="post-source muted">
          Also on
          <a href="${escapeHtml(post.link)}" target="_blank" rel="noopener">Blogger</a>
        </p>
      </div>
    </article>`;

  const article = el.querySelector(".post");
  setupBlogScroll(article);

  const img = el.querySelector(".post-image img");
  if (img) {
    const syncOrientation = () => {
      applyPostOrientation(article, img);
      // Re-check overflow after layout flip.
      const body = article.querySelector(".post-body");
      const btn = article.querySelector(".post-scroll-btn");
      if (body && btn) {
        const overflow = body.scrollHeight > body.clientHeight + 8;
        const atBottom =
          body.scrollTop + body.clientHeight >= body.scrollHeight - 12;
        btn.hidden = !overflow || atBottom;
      }
    };
    if (img.complete && img.naturalWidth) syncOrientation();
    else img.addEventListener("load", syncOrientation);
  }
}

async function loadBlogPost(containerId) {
  const params = new URLSearchParams(window.location.search);
  const key = params.get("p") || params.get("id") || "";
  const el = document.getElementById(containerId);

  try {
    const res = await fetch(`js/blog.json?v=${Date.now()}`);
    if (!res.ok) throw new Error("Blog not found");
    const posts = await res.json();
    const post = findBlogPost(posts, key);
    if (post && post.title) {
      document.title = `${post.title} — AAZA Travels`;
    }
    renderBlogPost(containerId, post);
  } catch {
    if (el) {
      el.innerHTML = `
        <div class="feed-empty">
          <p>Could not load this post.</p>
          <p class="muted"><a href="blog.html">← Back to the journal</a></p>
        </div>`;
    }
  }
}

function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

function youtubeEmbedUrl(videoId) {
  const params = new URLSearchParams({ rel: "0", modestbranding: "1" });
  if (window.location.protocol !== "file:") {
    params.set("origin", window.location.origin);
  }
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params}`;
}

function renderVlogPlayer(v) {
  const id = escapeHtml(v.videoId);
  const title = escapeHtml(v.title);
  const watchUrl = youtubeWatchUrl(v.videoId);
  const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

  // YouTube blocks embeds on file:// pages (Error 153). Use thumbnail + link instead.
  if (window.location.protocol === "file:") {
    return `
      <div class="video-wrap video-fallback">
        <a href="${watchUrl}" target="_blank" rel="noopener" class="video-thumb-link">
          <img src="${thumb}" alt="${title}">
          <span class="play-btn" aria-hidden="true">▶</span>
          <span class="play-label">Play on YouTube</span>
        </a>
      </div>
      <p class="video-note muted">Tip: run <code>python3 -m http.server 8080</code> in this folder, then open <code>http://localhost:8080/vlogs.html</code> to play videos here.</p>`;
  }

  return `
      <div class="video-wrap">
        <iframe
          src="${youtubeEmbedUrl(v.videoId)}"
          title="${title}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen
        ></iframe>
      </div>`;
}

function renderVlogs(containerId, vlogs) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = vlogs
    .map(
      (v) => `
    <article class="vlog-item">
      <h2>${escapeHtml(v.title)}</h2>
      <p class="muted">${escapeHtml(v.description)}</p>
      ${renderVlogPlayer(v)}
    </article>`,
    )
    .join("");
}

function mapEmbedUrl(lat, lon, pad = 0.35) {
  const bbox = [lon - pad, lat - pad, lon + pad, lat + pad].join("%2C");
  const marker = `${lat}%2C${lon}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
}

const ITINERARY_PLACE_WORDS = {
  Paris: ["paris"],
  Marseille: ["marseille", "panier", "calanques"],
  Toulouse: ["toulouse"],
  Bordeaux: ["bordeaux", "moissac"],
  "Saint-Jean-de-Luz": [
    "saint-jean-de-luz",
    "saint jean de luz",
    "guéthary",
    "guethary",
    "biarritz",
    "san sebastián",
    "san sebastian",
    "ibardin",
    "basque",
  ],
  Edinburgh: ["edinburgh", "royal mile", "tron kirk"],
  Cruachan: ["cruachan", "loch tay", "killin", "glamping"],
  Glencoe: ["glencoe", "glen coe"],
  Aviemore: ["aviemore", "viaduct", "hogwarts"],
  Inverness: ["inverness", "kelpies"],
};

const FAMILY_PHOTO_WORDS =
  /ayana|zarmina|adnan|amy|girls|daughters|family|kids|we stayed|our airbnb|our lovely/i;

function isColorThemeCaption(caption) {
  return Boolean(parseColorFromCaption(caption));
}

function postDay(item) {
  const raw = item.date || item.timestamp || "";
  return raw.slice(0, 10);
}

function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function scoreItineraryPhoto(stop, item) {
  const img = feedImageUrl(item);
  if (!img) return -1;
  const caption = item.caption || "";
  if (isColorThemeCaption(caption)) return -1;

  const day = postDay(item);
  if (!day) return -1;

  const windowStart = addDays(stop.start, -1);
  const windowEnd = addDays(stop.end, 6);
  const inWindow = day >= windowStart && day <= windowEnd;

  const words = ITINERARY_PLACE_WORDS[stop.city] || [stop.city.toLowerCase()];
  const lower = caption.toLowerCase();
  const mentionsPlace = words.some((w) => lower.includes(w));

  if (!inWindow && !mentionsPlace) return -1;

  let score = 0;
  if (inWindow) score += 40;
  if (mentionsPlace) score += 80;
  if (item.mediaType === "IMAGE") score += 35;
  if (FAMILY_PHOTO_WORDS.test(caption)) score += 50;
  if (item.author === "Amy") score += 15;
  return score;
}

function pickItineraryPhoto(stop, feed, usedIds, todayIso) {
  if (stop.start > todayIso) return stop.image || "";

  let best = null;
  let bestScore = 0;
  for (const item of feed) {
    if (usedIds.has(item.id)) continue;
    const score = scoreItineraryPhoto(stop, item);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  if (!best) return stop.image || "";
  usedIds.add(best.id);
  return feedImageUrl(best);
}

async function renderItinerary(containerId, stops) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const now = new Date();
  const current = getCurrentStop(stops, now);
  const day = todayIso(now);

  const [feed, archive] = await Promise.all([
    loadJsonArray("js/feed.json"),
    loadJsonArray("js/feed-archive.json"),
  ]);
  const posts = mergePostsById(feed, archive);
  const usedIds = new Set();

  el.innerHTML = stops
    .map((stop) => {
      const isHere =
        current && current.city === stop.city && current.start === stop.start;
      const mapUrl =
        stop.lat != null && stop.lon != null
          ? mapEmbedUrl(stop.lat, stop.lon, stop.mapPad || 0.35)
          : "";
      let photo = pickItineraryPhoto(stop, posts, usedIds, day);
      if (isHere) photo = "photos/hero.jpg";

      return `
    <article class="itinerary-stop card ${isHere ? "current" : ""}">
      <div class="itinerary-stop-info">
        <div class="card-row">
          <h3>${escapeHtml(stop.city)}, ${escapeHtml(stop.country)}</h3>
          ${isHere ? '<span class="badge">We are here</span>' : ""}
        </div>
        <p class="muted">${escapeHtml(stop.start)} → ${escapeHtml(stop.end)}</p>
      </div>
      <div class="itinerary-stop-photo">
        ${
          photo
            ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(stop.city)}" loading="lazy">`
            : ""
        }
      </div>
      <div class="itinerary-stop-map">
        ${
          mapUrl
            ? `<iframe class="itinerary-map" title="Map of ${escapeHtml(stop.city)}" src="${mapUrl}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`
            : ""
        }
      </div>
    </article>`;
    })
    .join("");
}
