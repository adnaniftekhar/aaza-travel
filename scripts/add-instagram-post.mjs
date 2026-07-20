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

function isReelUrl(input) {
  return /\/reel\//i.test(input || "");
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
    set theFile to choose file with prompt "Could not auto-download the photo. Choose it from Downloads (or Cancel to skip)" of type {"public.image"}
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

function guessAuthor(caption) {
  const first = (caption || "").split("\n")[0];
  if (
    /^(YELLOW|ORANGE|GREEN|RED|BLUE|PURPLE|PINK|BROWN|BLACK|WHITE|GRAY|GREY|GOLD|SILVER|TURQUOISE)\b/i.test(
      first,
    )
  ) {
    return "Amy";
  }
  return "Adnan";
}

async function downloadCoverImage(shortcode) {
  fs.mkdirSync(FEED_PHOTOS, { recursive: true });
  const dest = path.join(FEED_PHOTOS, `${shortcode}.jpg`);
  const urls = [
    `https://www.instagram.com/p/${shortcode}/media/?size=l`,
    `https://www.instagram.com/reel/${shortcode}/media/?size=l`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        },
        redirect: "follow",
      });
      if (!res.ok) continue;
      const type = res.headers.get("content-type") || "";
      if (!type.includes("image")) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) continue;
      fs.writeFileSync(dest, buf);
      return `photos/feed/${shortcode}.jpg`;
    } catch {
      /* try next */
    }
  }
  return "";
}

async function main() {
  const argUrl = process.argv[2] || "";
  const argCaption = process.argv[3] || "";

  const url =
    argUrl ||
    prompt(
      "Paste the Instagram post/reel LINK that is missing from the website",
    );
  const shortcode = extractShortcode(url);
  if (!shortcode) {
    console.error("Could not find an Instagram post id in that link.");
    process.exit(1);
  }

  const caption =
    argCaption ||
    prompt("Paste the FULL caption from that Instagram post");
  if (!caption.trim()) {
    console.error("Caption is required.");
    process.exit(1);
  }

  let imagePath = await downloadCoverImage(shortcode);
  if (!imagePath && !(argUrl && argCaption)) {
    const chosen = chooseImage();
    if (chosen) {
      fs.mkdirSync(FEED_PHOTOS, { recursive: true });
      const dest = path.join(FEED_PHOTOS, `${shortcode}.jpg`);
      fs.copyFileSync(chosen, dest);
      imagePath = `photos/feed/${shortcode}.jpg`;
    }
  }

  const reel = isReelUrl(url);
  const post = {
    id: shortcode,
    author: guessAuthor(caption),
    caption: caption.trim(),
    image: imagePath,
    mediaType: reel ? "VIDEO" : "IMAGE",
    permalink: reel
      ? `https://www.instagram.com/reel/${shortcode}/`
      : `https://www.instagram.com/p/${shortcode}/`,
    date: new Date().toISOString(),
    collab: guessAuthor(caption) === "Amy",
  };

  const feed = upsert(loadPosts(FEED_FILE), post);
  const archive = upsert(loadPosts(ARCHIVE_FILE), post);
  savePosts(FEED_FILE, feed);
  savePosts(ARCHIVE_FILE, archive);

  console.log(`Added/updated post ${shortcode}`);
  console.log(`Author: ${post.author}`);
  console.log(`Caption starts: ${post.caption.split("\n")[0].slice(0, 80)}`);
  console.log(`Image: ${imagePath || "(none)"}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
