import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(__dirname, "../js/feed.json");
const ARCHIVE_FILE = path.join(__dirname, "../js/feed-archive.json");
const FEED_PHOTOS = path.join(__dirname, "../photos/feed");

const AAZA_HASHTAG = /#aaza\w+/i;

// Color-hunt captions like "BROWN:" or "TURQUOISE BLUE:" are always kept,
// even if the #AAZA hashtag was forgotten.
const COLOR_WORDS = [
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
const COLOR_CAPTION_RE = new RegExp(
  `^((?:(?:${COLOR_WORDS.join("|")})\\s+)*(?:${COLOR_WORDS.join("|")}))\\s*:`,
  "im",
);

function shouldIncludeCaption(caption, shortcode) {
  const text = caption || "";
  return (
    AAZA_HASHTAG.test(text) ||
    COLOR_CAPTION_RE.test(text.trim()) ||
    INCLUDED_SHORTCODES.has(shortcode)
  );
}

// Post IDs to never show, even if they still match a hashtag (old test posts).
const EXCLUDED_IDS = new Set([
  "18087449387048294", // test: La Paz whale signs
  "18007137643920371", // test: Mongolia reel
]);

// Shortcodes to ALWAYS include, even without an #AAZA hashtag. Use this to
// hand-pick a post (e.g. a collab post the author forgot to hashtag).
const INCLUDED_SHORTCODES = new Set([
  "DaVV6v2iN_8tUH4Xjf6vpwYHxpg_uu1rkXr5Ks0", // Amy: "First stop in Paris, a corner bakery..."
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
    scrapePublic: true, // public grid includes own posts + collab posts
    userId: process.env.INSTAGRAM_USER_ID_ADNAN,
    token: process.env.INSTAGRAM_ACCESS_TOKEN_ADNAN || process.env.INSTAGRAM_ACCESS_TOKEN,
  },
  {
    name: "Amy",
    username: "mackling",
    scrapePublic: false, // private — collab posts appear on adnanyoga's grid
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

const MEDIA_FIELDS =
  "id,caption,media_url,permalink,timestamp,media_type,thumbnail_url,username";

// Turn one raw Graph API media item into a feed post (or null if it should be skipped).
async function buildPost(item, account, options = {}) {
  if (EXCLUDED_IDS.has(item.id)) return null;

  const shortcode = extractShortcode(item.permalink);
  const id = shortcode || item.id;
  if (!shouldIncludeCaption(item.caption || "", shortcode)) return null;
  const { image, mediaType } = await mediaImage(item, account.token);
  let localImage = await cacheImage(image, id);

  // Fallback cover for reels/collabs when Graph gives no downloadable URL.
  if (!localImage && shortcode) {
    localImage = await cacheImage(
      `https://www.instagram.com/p/${shortcode}/media/?size=l`,
      id,
    );
  }

  const isCollab = !!options.collab;
  const author = isCollab
    ? authorFromUsername(item.username, account.name)
    : account.name;

  return {
    id,
    author,
    caption: item.caption || "",
    image: localImage || image,
    mediaType,
    permalink: item.permalink || "",
    date: item.timestamp || "",
    collab: isCollab,
  };
}

// Turn one node from the public web_profile_info feed into a feed post. This is
// how we pick up COLLAB posts, which the official Graph API deliberately hides.
async function buildPostFromNode(node, profileAccount) {
  const shortcode = node.shortcode;
  if (!shortcode) return null;
  if (EXCLUDED_IDS.has(shortcode) || EXCLUDED_IDS.has(node.id)) return null;

  const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text || "";
  if (!shouldIncludeCaption(caption, shortcode)) return null;

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
    // A collab post is owned by someone other than the profile we're reading.
    collab: !!ownerUsername && ownerUsername !== profileAccount.username,
  };
}

// Optional: an Instagram session cookie lets the public read succeed from
// datacenter IPs (like GitHub Actions), which otherwise get rate-limited (429).
function parseSessionId(raw) {
  if (!raw) return { sessionid: "", dsUserId: "" };
  let sessionid = raw.trim();
  try {
    sessionid = decodeURIComponent(sessionid);
  } catch {
    /* keep raw value */
  }
  const dsUserId = sessionid.split(":")[0] || "";
  return { sessionid, dsUserId };
}

const { sessionid: IG_SESSIONID, dsUserId: IG_DS_USER_ID } = parseSessionId(
  process.env.IG_SESSIONID || "",
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Read a public profile's grid via Instagram's web endpoint. Returns own posts
// AND collab posts. Returns { posts, ok } so callers know if the read succeeded.
async function fetchPublicProfilePosts(account) {
  const legacy = await fetchWebProfileInfo(account);
  if (legacy.ok) return legacy;

  // web_profile_info is heavily rate-limited / broken in 2026. Fall back to the
  // GraphQL timeline query used by Instagram's own website (and tools like Instaloader).
  const graphql = await fetchGraphqlProfilePosts(account);
  if (graphql.ok) return graphql;

  return { posts: [], ok: false };
}

function igWebHeaders(account) {
  const headers = {
    "X-IG-App-ID": "936619743392459",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    Referer: `https://www.instagram.com/${account.username}/`,
    "X-Requested-With": "XMLHttpRequest",
  };
  if (IG_SESSIONID) {
    const parts = [`sessionid=${IG_SESSIONID}`];
    if (IG_DS_USER_ID) parts.push(`ds_user_id=${IG_DS_USER_ID}`);
    headers.Cookie = parts.join("; ");
    headers["X-CSRFToken"] = "missing";
  }
  return headers;
}

async function fetchWebProfileInfo(account) {
  const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${account.username}`;
  const headers = igWebHeaders(account);

  let data;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (res.status === 429 && attempt < 3) {
        await sleep(attempt * 5000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
      break;
    } catch (err) {
      if (attempt === 3) {
        console.log(`${account.name}: web_profile_info failed (${err.message})`);
        return { posts: [], ok: false };
      }
      await sleep(attempt * 5000);
    }
  }

  const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges || [];
  const posts = [];
  for (const edge of edges) {
    const post = await buildPostFromNode(edge.node || {}, account);
    if (post) posts.push(post);
  }
  return { posts, ok: true };
}

/** Convert Instagram "iphone struct" timeline nodes into our feed shape. */
async function buildPostFromIphoneStruct(media, profileAccount) {
  const shortcode = media.code || media.shortcode;
  if (!shortcode) return null;
  if (EXCLUDED_IDS.has(shortcode) || EXCLUDED_IDS.has(String(media.pk || ""))) return null;

  const caption =
    (media.caption && (media.caption.text || media.caption)) ||
    media.caption_text ||
    "";
  if (!shouldIncludeCaption(caption, shortcode)) return null;

  const image =
    media.image_versions2?.candidates?.[0]?.url ||
    media.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url ||
    "";
  const localImage = await cacheImage(image, shortcode);
  const ownerUsername = media.user?.username || media.owner?.username;

  return {
    id: shortcode,
    author: authorFromUsername(ownerUsername, profileAccount.name),
    caption,
    image: localImage || image,
    mediaType: media.media_type === 2 ? "VIDEO" : "IMAGE",
    permalink: `https://www.instagram.com/p/${shortcode}/`,
    date: media.taken_at
      ? new Date(media.taken_at * 1000).toISOString()
      : "",
    collab: !!ownerUsername && ownerUsername !== profileAccount.username,
  };
}

async function fetchGraphqlProfilePosts(account) {
  // PolarisProfilePostsQuery / user timeline — current Instagram web client query.
  const docIds = ["34579740524958711", "7898261790222653", "7950326061742207"];
  const headers = {
    ...igWebHeaders(account),
    "Content-Type": "application/x-www-form-urlencoded",
    "X-FB-LSD": "AVqbxe3J_YA",
  };

  for (const docId of docIds) {
    const variables = {
      data: {
        count: 24,
        include_relationship_info: true,
        latest_besties_reel_media: true,
        latest_reel_media: true,
      },
      username: account.username,
    };
    try {
      const body = new URLSearchParams({
        doc_id: docId,
        variables: JSON.stringify(variables),
      });
      const res = await fetch("https://www.instagram.com/graphql/query", {
        method: "POST",
        headers,
        body,
      });
      if (!res.ok) {
        console.log(
          `${account.name}: GraphQL ${docId} failed (HTTP ${res.status})`,
        );
        continue;
      }
      const json = await res.json();
      const conn =
        json?.data?.xdt_api__v1__feed__user_timeline_graphql_connection ||
        json?.data?.user?.edge_owner_to_timeline_media;
      const edges = conn?.edges || [];
      if (!edges.length) {
        console.log(`${account.name}: GraphQL ${docId} returned 0 edges`);
        continue;
      }

      const posts = [];
      for (const edge of edges) {
        const node = edge.node || edge;
        // Newer queries return iphone_struct-shaped nodes; older return GraphImage nodes.
        const post = node.shortcode
          ? await buildPostFromNode(node, account)
          : await buildPostFromIphoneStruct(node, account);
        if (post) posts.push(post);
      }
      console.log(
        `${account.name}: GraphQL timeline (${docId}) returned ${posts.length} matching posts`,
      );
      return { posts, ok: true };
    } catch (err) {
      console.log(`${account.name}: GraphQL ${docId} error (${err.message})`);
    }
  }

  return { posts: [], ok: false };
}

function loadJsonArray(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8").trim();
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function loadExistingFeed() {
  return loadJsonArray(OUT_FILE);
}

// Permanent archive: every post ever synced stays here forever (unless EXCLUDED_IDS).
// Instagram only returns ~12 recent posts, so this is the only way older posts
// never vanish when new ones are added.
function loadArchive() {
  const archive = loadJsonArray(ARCHIVE_FILE);
  const byId = new Map();

  for (const post of archive) {
    if (post?.id && !EXCLUDED_IDS.has(post.id)) byId.set(post.id, post);
  }

  // Bootstrap: pull anything from feed.json not yet in the archive.
  for (const post of loadExistingFeed()) {
    if (post?.id && !EXCLUDED_IDS.has(post.id) && !byId.has(post.id)) {
      byId.set(post.id, post);
    }
  }

  return byId;
}

// Merge fresh data into the archive. Fresh wins for caption/image/date updates.
function upsertArchive(byId, post) {
  if (!post?.id || EXCLUDED_IDS.has(post.id)) return false;

  const prev = byId.get(post.id);
  if (prev) {
    byId.set(post.id, {
      ...prev,
      ...post,
      collab: post.collab ?? prev.collab,
    });
  } else {
    byId.set(post.id, post);
  }
  return true;
}

function saveFeedAndArchive(byId) {
  const all = [...byId.values()].sort((a, b) => new Date(b.date) - new Date(a.date));
  const json = JSON.stringify(all, null, 2) + "\n";
  fs.writeFileSync(ARCHIVE_FILE, json);
  fs.writeFileSync(OUT_FILE, json);
  return all;
}

// Walk a paginated Graph edge (e.g. /media or /collaborative_media) and collect posts.
async function collectFromEdge(startUrl, account, posts, options = {}) {
  let url = startUrl;
  while (url) {
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }
    const data = await res.json();
    for (const item of data.data || []) {
      const post = await buildPost(item, account, options);
      if (post) posts.push(post);
    }
    url = data.paging?.next || null;
  }
}

function shortApiError(err) {
  const raw = String(err?.message || err || "");
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || parsed?.message || raw.slice(0, 160);
  } catch {
    return raw.slice(0, 160);
  }
}

async function fetchMediaForAccount(account) {
  if (!account.userId || !account.token) {
    console.log(`Skipping ${account.name}: missing user ID or token`);
    return [];
  }

  const posts = [];

  // Own authored posts.
  const ownUrl = `https://graph.instagram.com/${account.userId}/media?fields=${MEDIA_FIELDS}&limit=50&access_token=${account.token}`;
  try {
    await collectFromEdge(ownUrl, account, posts, { collab: false });
    console.log(`${account.name}: ${posts.length} posts from Graph API /media`);
  } catch (err) {
    throw new Error(`Instagram API error for ${account.name}: ${err.message}`);
  }

  // Official Collaborative Media API (Meta, 2026): media where this user is an
  // accepted collaborator — this is how Amy's color posts should arrive without scraping.
  const collabEndpoints = [
    `https://graph.instagram.com/${account.userId}/collaborative_media`,
    `https://graph.instagram.com/v22.0/${account.userId}/collaborative_media`,
    `https://graph.facebook.com/v22.0/${account.userId}/collaborative_media`,
  ];

  for (const base of collabEndpoints) {
    const url = `${base}?fields=${MEDIA_FIELDS}&limit=50&access_token=${account.token}`;
    try {
      const before = posts.length;
      await collectFromEdge(url, account, posts, { collab: true });
      const added = posts.length - before;
      const host = base.includes("facebook.com") ? "facebook" : "instagram";
      console.log(
        `${account.name}: ${added} collab posts from ${host} /collaborative_media`,
      );
      break;
    } catch (err) {
      console.log(
        `${account.name}: /collaborative_media not available yet (${shortApiError(err)})`,
      );
    }
  }

  return posts;
}

async function main() {
  const archive = loadArchive();
  const beforeCount = archive.size;
  let refreshed = 0;
  let scrapeFailed = false;
  let scrapeAttempted = false;

  const add = (post) => {
    if (upsertArchive(archive, post)) refreshed++;
  };

  for (const account of ACCOUNTS) {
    if (account.scrapePublic) {
      scrapeAttempted = true;
      const scraped = await fetchPublicProfilePosts(account);
      console.log(`${account.name}: ${scraped.posts.length} posts from public/GraphQL profile`);
      if (!scraped.ok) scrapeFailed = true;
      for (const post of scraped.posts) add(post);
      await sleep(3000);
    }

    const api = await fetchMediaForAccount(account);
    if (api.length) console.log(`${account.name}: ${api.length} posts from Graph API`);
    for (const post of api) add(post);
  }

  const all = saveFeedAndArchive(archive);
  const added = all.length - beforeCount;
  console.log(
    `Archive: ${all.length} posts total (${refreshed} refreshed, ${added} newly added, 0 removed)`,
  );
  console.log(`Wrote ${OUT_FILE} and ${ARCHIVE_FILE}`);

  const statusPath = path.join(__dirname, "../logs/scrape-status.json");
  fs.mkdirSync(path.dirname(statusPath), { recursive: true });
  fs.writeFileSync(
    statusPath,
    JSON.stringify(
      {
        ok: !scrapeFailed,
        scrapeAttempted,
        scrapeFailed,
        at: new Date().toISOString(),
        message: scrapeFailed
          ? "Instagram blocked the public profile scrape. Adnan's own posts may still update via the API, but Amy collab / color posts need add-instagram-post.command until the scrape works again."
          : "Public profile scrape succeeded.",
      },
      null,
      2,
    ) + "\n",
  );

  if (scrapeAttempted && scrapeFailed) {
    // Warn loudly, but do NOT fail the process. GitHub Actions still needs to
    // commit Graph API updates. A hard exit was turning every 2-hour run red
    // and blocking those commits.
    console.warn("");
    console.warn("WARNING: Instagram blocked the public profile scrape (collab/color posts may be missing).");
    console.warn("Adnan's Graph API posts were still saved. Use add-instagram-post.command for Amy's color posts if needed.");
    console.warn("");
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
