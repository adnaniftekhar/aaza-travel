import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FEED_FILE = path.join(ROOT, "js/feed.json");
const ARCHIVE_FILE = path.join(ROOT, "js/feed-archive.json");
const FEED_PHOTOS = path.join(ROOT, "photos/feed");

function loadPosts(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function savePosts(filePath, posts) {
  const sorted = [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));
  fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2) + "\n");
  return sorted;
}

function extractShortcode(input) {
  const text = (input || "").trim();
  const fromUrl = /\/(?:p|reel|tv)\/([^/?#]+)/.exec(text);
  if (fromUrl) return fromUrl[1];
  if (/^[A-Za-z0-9_-]+$/.test(text)) return text;
  return "";
}

function prompt(message, defaultValue = "") {
  const script = defaultValue
    ? `text returned of (display dialog ${JSON.stringify(message)} default answer ${JSON.stringify(defaultValue)})`
    : `text returned of (display dialog ${JSON.stringify(message)} default answer "")`;
  try {
    return execFileSync("osascript", ["-e", script], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function chooseImage() {
  const script = `
    set theFile to choose file with prompt "Optional: choose the Instagram photo to show on the site (Cancel to skip)" of type {"public.image"}
    return POSIX path of theFile
  `;
  try {
    return execFileSync("osascript", ["-e", script], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function upsert(posts, post) {
  const idx = posts.findIndex((p) => p.id === post.id);
  if (idx >= 0) posts[idx] = { ...posts[idx], ...post };
  else posts.push(post);
  return posts;
}

async function main() {
  const argUrl = process.argv[2] || "";
  const argCaption = process.argv[3] || "";

  const url =
    argUrl ||
    prompt(
      "Paste the Instagram post link for the missing color post (example: https://www.instagram.com/p/XXXX/)",
    );
  const shortcode = extractShortcode(url);
  if (!shortcode) {
    console.error("Could not find an Instagram post id in that link.");
    process.exit(1);
  }

  const caption =
    argCaption ||
    prompt(
      "Paste the FULL caption from Instagram (must start like BROWN: ...)",
      "BROWN: ",
    );
  if (!caption.trim()) {
    console.error("Caption is required.");
    process.exit(1);
  }

  let imagePath = "";
  const chosen = argUrl && argCaption ? "" : chooseImage();
  if (chosen) {
    fs.mkdirSync(FEED_PHOTOS, { recursive: true });
    const dest = path.join(FEED_PHOTOS, `${shortcode}.jpg`);
    fs.copyFileSync(chosen, dest);
    imagePath = `photos/feed/${shortcode}.jpg`;
  }

  const post = {
    id: shortcode,
    author: /brown|yellow|orange|green|red|blue|purple|pink|turquoise/i.test(
      caption.split("\n")[0],
    )
      ? "Amy"
      : "Amy",
    caption: caption.trim(),
    image: imagePath,
    mediaType: "IMAGE",
    permalink: `https://www.instagram.com/p/${shortcode}/`,
    date: new Date().toISOString(),
    collab: true,
  };

  const feed = upsert(loadPosts(FEED_FILE), post);
  const archive = upsert(loadPosts(ARCHIVE_FILE), post);
  savePosts(FEED_FILE, feed);
  savePosts(ARCHIVE_FILE, archive);

  console.log(`Added/updated post ${shortcode}`);
  console.log(`Caption starts: ${post.caption.split("\n")[0].slice(0, 80)}`);
  console.log(`Image: ${imagePath || "(none yet — card may show placeholder until you add a photo)"}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
