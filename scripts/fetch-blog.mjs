import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(__dirname, "../js/blog.json");

// Public Blogger blog. No API key needed for the public feed.
const BLOG_URL =
  process.env.BLOGGER_URL || "https://aazaadventures.blogspot.com";
const PAGE_SIZE = 500;

function feedPageUrl(startIndex) {
  const base = `${BLOG_URL.replace(/\/$/, "")}/feeds/posts/default`;
  const params = new URLSearchParams({
    alt: "json",
    "max-results": String(PAGE_SIZE),
    "start-index": String(startIndex),
    // Blogger otherwise defaults to roughly the last 30 days.
    "published-min": "1970-01-01T00:00:00",
  });
  return `${base}?${params.toString()}`;
}

function decodeEntities(html) {
  return html
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    );
}

function stripHtml(html) {
  return decodeEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function firstImage(html) {
  const match = html.match(/<img[^>]+src="([^"]+)"/i);
  return match ? match[1] : "";
}

function imageOrientation(html, imageUrl) {
  const imgTag = html.match(/<img[^>]+>/i);
  if (imgTag) {
    const tag = imgTag[0];
    const w =
      Number(
        (tag.match(/data-original-width="(\d+)"/i) || [])[1] ||
          (tag.match(/\bwidth="(\d+)"/i) || [])[1] ||
          0,
      ) || 0;
    const h =
      Number(
        (tag.match(/data-original-height="(\d+)"/i) || [])[1] ||
          (tag.match(/\bheight="(\d+)"/i) || [])[1] ||
          0,
      ) || 0;
    if (w && h) {
      if (h > w * 1.05) return "portrait";
      if (w > h * 1.05) return "landscape";
      return "square";
    }
  }

  if (imageUrl) {
    const m = imageUrl.match(/[/=]w(\d+)-h(\d+)/i);
    if (m) {
      const w = Number(m[1]);
      const h = Number(m[2]);
      if (h > w * 1.05) return "portrait";
      if (w > h * 1.05) return "landscape";
      return "square";
    }
  }

  return "landscape";
}

function slugFromLink(link) {
  try {
    const parts = new URL(link).pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "";
    return last.replace(/\.html?$/i, "") || "";
  } catch {
    return "";
  }
}

function deriveTitle(rawTitle, text) {
  if (rawTitle && rawTitle.trim()) return rawTitle.trim();
  if (!text) return "Journal entry";
  const firstSentence = text.split(/[.!?]/)[0].trim();
  return firstSentence.slice(0, 80) || "Journal entry";
}

/** Turn Blogger HTML into clean readable paragraphs + extra images. */
function cleanBodyHtml(html) {
  let working = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Collect every image URL, then drop the first (shown as the hero).
  const images = [];
  working.replace(/<img[^>]+src="([^"]+)"[^>]*>/gi, (_, src) => {
    images.push(src);
    return "";
  });
  const extraImages = images.slice(1);

  // Prefer real paragraph breaks from the source HTML.
  working = working
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n\n")
    .replace(/<(p|div|h[1-6]|li|blockquote)(?:\s[^>]*)?>/gi, "")
    .replace(/<[^>]+>/g, " ");

  const text = decodeEntities(working)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // If Blogger didn't use paragraphs, split long blobs into sentences.
  const finalParagraphs =
    paragraphs.length > 1
      ? paragraphs
      : text
          .split(/(?<=[.!?])\s+(?=[A-Z“"‘'])/)
          .map((p) => p.trim())
          .filter(Boolean);

  const parts = finalParagraphs.map((p) => {
    const safe = p
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<p>${safe}</p>`;
  });

  for (const src of extraImages) {
    parts.push(
      `<img src="${src.replace(/"/g, "&quot;")}" alt="" loading="lazy">`,
    );
  }

  return parts.join("\n");
}

function mapEntry(e) {
  const html = e.content?.$t || e.summary?.$t || "";
  const text = stripHtml(html);
  const rawTitle = e.title?.$t || "";
  const link =
    (e.link || []).find((l) => l.rel === "alternate")?.href || BLOG_URL;
  const image = firstImage(html) || e["media$thumbnail"]?.url || "";

  return {
    id: e.id?.$t || link,
    slug: slugFromLink(link),
    title: deriveTitle(rawTitle, text),
    excerpt: text.slice(0, 240),
    body: cleanBodyHtml(html),
    image,
    orientation: imageOrientation(html, image),
    link,
    author: e.author?.[0]?.name?.$t || "Amy",
    date: e.published?.$t || "",
    updated: e.updated?.$t || e.published?.$t || "",
  };
}

function loadExistingPosts() {
  try {
    const data = JSON.parse(fs.readFileSync(OUT_FILE, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function fetchAllEntries() {
  const entries = [];
  let start = 1;
  let total = Infinity;

  while (start <= total) {
    const res = await fetch(feedPageUrl(start), {
      headers: { "User-Agent": "Mozilla/5.0 (AAZA Travel site)" },
    });
    if (!res.ok) {
      throw new Error(`Blogger feed error: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    const page = data.feed?.entry || [];
    total = Number(data.feed?.["openSearch$totalResults"]?.$t || page.length);
    entries.push(...page);
    if (!page.length) break;
    start += page.length;
  }

  return entries;
}

async function main() {
  const entries = await fetchAllEntries();
  const byId = new Map();

  // Keep any older posts we already saved, in case Blogger omits them later.
  for (const post of loadExistingPosts()) {
    if (post?.id) byId.set(post.id, post);
  }
  for (const entry of entries) {
    const post = mapEntry(entry);
    byId.set(post.id, post);
  }

  const posts = [...byId.values()].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );

  fs.writeFileSync(OUT_FILE, JSON.stringify(posts, null, 2) + "\n");
  console.log(`Wrote ${posts.length} blog posts to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
