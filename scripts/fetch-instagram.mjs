import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(__dirname, "../js/feed.json");
const FEED_PHOTOS = path.join(__dirname, "../photos/feed");

const AAZA_HASHTAG = /#aaza\w+/i;

// Post IDs to never show, even if they still match a hashtag (old test posts).
const EXCLUDED_IDS = new Set([
  "18087449387048294", // test: La Paz whale signs
  "18007137643920371", // test: Mongolia reel
]);

async function cacheImage(url, id) {
  if (!url || url.includes(".mp4")) return "";

  fs.mkdirSync(FEED_PHOTOS, { recursive: true });
  const filePath = path.join(FEED_PHOTOS, `${id}.jpg`);

  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
    return `photos/feed/${id}.jpg`;
  } catch {
    return url;
  }
}

function isVideoItem(item) {
  const type = (item.media_type || "").toUpperCase();
  const url = item.media_url || "";
  return type === "VIDEO" || type === "REELS" || type === "REEL" || url.includes(".mp4");
}

async function fetchThumbnail(mediaId, token) {
  const fields = "thumbnail_url,media_url,media_type";
  const res = await fetch(
    `https://graph.instagram.com/${mediaId}?fields=${fields}&access_token=${token}`,
  );
  if (!res.ok) return "";
  const data = await res.json();
  return data.thumbnail_url || "";
}

async function mediaImage(item, token) {
  if (!isVideoItem(item)) {
    return {
      image: item.media_url || item.thumbnail_url || "",
      mediaType: item.media_type || "IMAGE",
    };
  }

  let thumb = item.thumbnail_url || "";
  if (!thumb) {
    thumb = await fetchThumbnail(item.id, token);
  }

  return {
    image: thumb || "",
    mediaType: item.media_type || "VIDEO",
  };
}

const ACCOUNTS = [
  {
    name: "Adnan",
    username: "adnanyoga",
    userId: process.env.INSTAGRAM_USER_ID_ADNAN,
    token: process.env.INSTAGRAM_ACCESS_TOKEN_ADNAN || process.env.INSTAGRAM_ACCESS_TOKEN,
  },
  {
    name: "Amy",
    username: "mackling",
    userId: process.env.INSTAGRAM_USER_ID_AMY,
    token: process.env.INSTAGRAM_ACCESS_TOKEN_AMY || process.env.INSTAGRAM_ACCESS_TOKEN,
  },
];

// Map an Instagram @handle to a friendly author name (used for collab posts,
// where the owner may be someone other than the profile we're reading).
function authorFromUsername(username, fallback) {
  const match = ACCOUNTS.find((a) => a.username === username);
  return (match && match.name) || fallback || username || "";
}

// Pull the shortcode out of an Instagram permalink, e.g.
// https://www.instagram.com/p/ABC123/  ->  ABC123
function extractShortcode(permalink) {
  const m = /\/(?:p|reel|tv)\/([^/?#]+)/.exec(permalink || "");
  return m ? m[1] : "";
}

const MEDIA_FIELDS = "id,caption,media_url,permalink,timestamp,media_type,thumbnail_url";

// Turn one raw Graph API media item into a feed post (or null if it should be skipped).
async function buildPost(item, account) {
  if (EXCLUDED_IDS.has(item.id)) return null;
  if (!AAZA_HASHTAG.test(item.caption || "")) return null;

  const shortcode = extractShortcode(item.permalink);
  const id = shortcode || item.id;
  const { image, mediaType } = await mediaImage(item, account.token);
  const localImage = await cacheImage(image, id);

  return {
    id,
    author: account.name,
    caption: item.caption || "",
    image: localImage || image,
    mediaType,
    permalink: item.permalink || "",
    date: item.timestamp || "",
  };
}

// Turn one node from the public web_profile_info feed into a feed post. This is
// how we pick up COLLAB posts, which the official Graph API deliberately hides.
async function buildPostFromNode(node, profileAccount) {
  const shortcode = node.shortcode;
  if (!shortcode) return null;
  if (EXCLUDED_IDS.has(shortcode) || EXCLUDED_IDS.has(node.id)) return null;

  const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text || "";
  if (!AAZA_HASHTAG.test(caption)) return null;

  const image = node.display_url || "";
  const localImage = await cacheImage(image, shortcode);
  const ownerUsername = node.owner?.username;

  return {
    id: shortcode,
    author: authorFromUsername(ownerUsername, profileAccount.name),
    caption,
    image: localImage || image,
    mediaType: node.is_video ? "VIDEO" : "IMAGE",
    permalink: `https://www.instagram.com/p/${shortcode}/`,
    date: node.taken_at_timestamp
      ? new Date(node.taken_at_timestamp * 1000).toISOString()
      : "",
  };
}

// Read a public profile's grid via Instagram's web endpoint. Returns own posts
// AND collab posts. No login/token required, but only works for PUBLIC profiles.
async function fetchPublicProfilePosts(account) {
  const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${account.username}`;
  let data;
  try {
    const res = await fetch(url, {
      headers: {
        "X-IG-App-ID": "936619743392459",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Referer: `https://www.instagram.com/${account.username}/`,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.log(`${account.name}: public profile read failed (${err.message})`);
    return [];
  }

  const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges || [];
  const posts = [];
  for (const edge of edges) {
    const post = await buildPostFromNode(edge.node || {}, account);
    if (post) posts.push(post);
  }
  return posts;
}

// Walk a paginated Graph edge (e.g. /media or /collaborative_media) and collect posts.
async function collectFromEdge(startUrl, account, posts) {
  let url = startUrl;
  while (url) {
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }
    const data = await res.json();
    for (const item of data.data || []) {
      const post = await buildPost(item, account);
      if (post) posts.push(post);
    }
    url = data.paging?.next || null;
  }
}

async function fetchMediaForAccount(account) {
  if (!account.userId || !account.token) {
    console.log(`Skipping ${account.name}: missing user ID or token`);
    return [];
  }

  // The /media edge only returns posts this account AUTHORED. Instagram's simple
  // "Instagram Login" API cannot fetch posts the account only collaborated on, so
  // a collab post only appears here if THIS account is the original author.
  const posts = [];
  const ownUrl = `https://graph.instagram.com/${account.userId}/media?fields=${MEDIA_FIELDS}&limit=50&access_token=${account.token}`;
  try {
    await collectFromEdge(ownUrl, account, posts);
  } catch (err) {
    throw new Error(`Instagram API error for ${account.name}: ${err.message}`);
  }

  return posts;
}

async function main() {
  const all = [];
  const seen = new Set();

  const add = (post) => {
    if (!post || !post.id || seen.has(post.id)) return;
    seen.add(post.id);
    all.push(post);
  };

  for (const account of ACCOUNTS) {
    // 1. Primary: public profile grid (includes the account's own posts AND any
    //    collab posts). Works without a token, but only for public profiles.
    const scraped = await fetchPublicProfilePosts(account);
    console.log(`${account.name}: ${scraped.length} posts from public profile`);
    for (const post of scraped) add(post);

    // 2. Fallback/supplement: official Graph API (own posts only). Catches posts
    //    if the public read is blocked or the profile is private.
    const api = await fetchMediaForAccount(account);
    if (api.length) console.log(`${account.name}: ${api.length} posts from Graph API`);
    for (const post of api) add(post);
  }

  all.sort((a, b) => new Date(b.date) - new Date(a.date));

  fs.writeFileSync(OUT_FILE, JSON.stringify(all, null, 2) + "\n");
  console.log(`Wrote ${all.length} posts to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
