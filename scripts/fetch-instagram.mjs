import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(__dirname, "../js/feed.json");

const AAZA_HASHTAG = /#aaza\w+/i;

const ACCOUNTS = [
  {
    name: "Adnan",
    userId: process.env.INSTAGRAM_USER_ID_ADNAN,
    token: process.env.INSTAGRAM_ACCESS_TOKEN_ADNAN || process.env.INSTAGRAM_ACCESS_TOKEN,
  },
  {
    name: "Amy",
    userId: process.env.INSTAGRAM_USER_ID_AMY,
    token: process.env.INSTAGRAM_ACCESS_TOKEN_AMY || process.env.INSTAGRAM_ACCESS_TOKEN,
  },
];

async function fetchMediaForAccount(account) {
  if (!account.userId || !account.token) {
    console.log(`Skipping ${account.name}: missing user ID or token`);
    return [];
  }

  const fields = "id,caption,media_url,permalink,timestamp,media_type,thumbnail_url";
  let url = `https://graph.instagram.com/${account.userId}/media?fields=${fields}&limit=50&access_token=${account.token}`;
  const posts = [];

  while (url) {
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Instagram API error for ${account.name}: ${err}`);
    }

    const data = await res.json();

    for (const item of data.data || []) {
      if (!AAZA_HASHTAG.test(item.caption || "")) continue;

      posts.push({
        id: item.id,
        author: account.name,
        caption: item.caption || "",
        image: item.media_url || item.thumbnail_url || "",
        permalink: item.permalink || "",
        date: item.timestamp || "",
      });
    }

    url = data.paging?.next || null;
  }

  return posts;
}

async function main() {
  const all = [];

  for (const account of ACCOUNTS) {
    const posts = await fetchMediaForAccount(account);
    console.log(`${account.name}: ${posts.length} posts with #AAZA hashtags`);
    all.push(...posts);
  }

  all.sort((a, b) => new Date(b.date) - new Date(a.date));

  fs.writeFileSync(OUT_FILE, JSON.stringify(all, null, 2) + "\n");
  console.log(`Wrote ${all.length} posts to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
