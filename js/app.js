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

function getCurrentStop(stops, today) {
  const day = today.toISOString().slice(0, 10);
  return stops.find((s) => day >= s.start && day <= s.end) || null;
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

function renderWhereBanner(containerId) {
  const el = document.getElementById(containerId);
  if (!el || typeof ITINERARY === "undefined") return;

  const current = getCurrentStop(ITINERARY, new Date());
  if (!current) {
    el.hidden = true;
    return;
  }

  el.hidden = false;
  el.innerHTML = `We are in <strong>${escapeHtml(current.city)}, ${escapeHtml(current.country)}</strong> right now.`;
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
        <p class="muted">Post on Instagram with a hashtag like <code>#AAZATravels</code> and it will show up here within a few hours.</p>
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

async function loadInstagramFeed(containerId) {
  try {
    const res = await fetch(`js/feed.json?v=${Date.now()}`);
    if (!res.ok) throw new Error("Feed not found");
    const posts = await res.json();
    renderFeed(containerId, posts);
  } catch {
    renderFeed(containerId, []);
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

function renderItinerary(containerId, stops) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const current = getCurrentStop(stops, new Date());

  el.innerHTML = stops
    .map((stop) => {
      const isHere =
        current && current.city === stop.city && current.start === stop.start;
      return `
    <article class="card ${isHere ? "current" : ""}">
      <div class="card-body">
        <div class="card-row">
          <h3>${escapeHtml(stop.city)}, ${escapeHtml(stop.country)}</h3>
          ${isHere ? '<span class="badge">We are here</span>' : ""}
        </div>
        <p class="muted">${stop.start} → ${stop.end}</p>
      </div>
    </article>`;
    })
    .join("");
}
