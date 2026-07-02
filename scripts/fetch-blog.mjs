import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(__dirname, "../js/blog.json");

// Public Blogger blog. No API key needed for the public feed.
const BLOG_URL =
  process.env.BLOGGER_URL || "https://aazaadventures.blogspot.com";
const FEED_URL = `${BLOG_URL.replace(/\/$/, "")}/feeds/posts/default?alt=json&max-results=50`;

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function firstImage(html) {
  const match = html.match(/<img[^>]+src="([^"]+)"/i);
  return match ? match[1] : "";
}

function deriveTitle(rawTitle, text) {
  if (rawTitle && rawTitle.trim()) return rawTitle.trim();
  if (!text) return "Journal entry";
  const firstSentence = text.split(/[.!?]/)[0].trim();
  return firstSentence.slice(0, 80) || "Journal entry";
}

async function main() {
  const res = await fetch(FEED_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (AAZA Travel site)" },
  });

  if (!res.ok) {
    throw new Error(`Blogger feed error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const entries = data.feed?.entry || [];

  const posts = entries.map((e) => {
    const html = e.content?.$t || e.summary?.$t || "";
    const text = stripHtml(html);
    const rawTitle = e.title?.$t || "";
    const link =
      (e.link || []).find((l) => l.rel === "alternate")?.href || BLOG_URL;

    return {
      id: e.id?.$t || link,
      title: deriveTitle(rawTitle, text),
      excerpt: text.slice(0, 240),
      image: firstImage(html) || e["media$thumbnail"]?.url || "",
      link,
      author: e.author?.[0]?.name?.$t || "Amy",
      date: e.published?.$t || "",
    };
  });

  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  fs.writeFileSync(OUT_FILE, JSON.stringify(posts, null, 2) + "\n");
  console.log(`Wrote ${posts.length} blog posts to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
