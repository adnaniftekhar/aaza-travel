# AAZA Travel Adventures

A family travel blog built with plain HTML, CSS, and JavaScript. Instagram posts tagged with `#AAZATravels` (or `#AAZAParis`, `#AAZAScotland`, etc.) appear on the site automatically.

## Quick start (local)

1. Open the folder in Cursor
2. In terminal:
   ```bash
   cd "/Users/adnan/Desktop/AAZA Website"
   open index.html
   ```
3. Add a hero photo: save an image as `photos/hero.jpg`

## Edit your content

Open `js/data.js` and update:

- `INSTAGRAM.adnan.handle` and `INSTAGRAM.amy.handle` — your real Instagram usernames
- `INSTAGRAM.*.url` — match your profile URLs
- `VLOGS` — YouTube video IDs
- `ITINERARY` — trip dates and cities

The Instagram feed itself lives in `js/feed.json` and is **auto-generated** — do not edit it by hand.

---

## Part 1: Instagram API setup (one time, ~30–60 min)

You need **Business or Creator** Instagram accounts (not personal). Each account must be linked to a Facebook Page.

### Step 1 — Switch to Business/Creator

1. Open Instagram on your phone → **Settings** → **Account type and tools**
2. Tap **Switch to professional account**
3. Choose **Creator** or **Business**
4. Link a Facebook Page (create one if needed)

Repeat for both Adnan and Amy.

### Step 2 — Create a Meta Developer App

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. **My Apps** → **Create App** → type **Business**
3. Add product: **Instagram** → **Instagram API with Instagram Login** (or Graph API)
4. Under **Instagram** → **API setup**, connect each Instagram account

### Step 3 — Get your User IDs and Access Token

**User ID** (do this for Adnan and Amy):

```
GET https://graph.instagram.com/me?fields=id,username&access_token=YOUR_TOKEN
```

Or find it in the Meta Developer dashboard under your connected account.

**Long-lived access token:**

1. Generate a short-lived token in the Meta dashboard
2. Exchange it for a long-lived token (valid ~60 days):

```
GET https://graph.instagram.com/access_token
  ?grant_type=ig_exchange_token
  &client_secret=YOUR_APP_SECRET
  &access_token=SHORT_LIVED_TOKEN
```

Save these values — you will add them as GitHub Secrets in Part 3.

### Step 4 — How hashtags work

Post on Instagram as usual. Include a hashtag like:

- `#AAZATravels`
- `#AAZAParis`
- `#AAZAScotland`

Any caption matching `#AAZA*` will appear on the site. The script fetches **your own** posts and filters by caption — no manual copying needed.

### Step 5 — Test the fetch script locally (optional)

```bash
export INSTAGRAM_ACCESS_TOKEN="your-token"
export INSTAGRAM_USER_ID_ADNAN="adnan-user-id"
export INSTAGRAM_USER_ID_AMY="amy-user-id"
node scripts/fetch-instagram.mjs
```

Check `js/feed.json` was updated, then refresh `index.html`.

---

## Part 2: Deploy to GitHub Pages (free public URL)

### Step 1 — Push to GitHub

1. Create a new repo on [github.com](https://github.com) (e.g. `aaza-travel`)
2. In terminal:
   ```bash
   cd "/Users/adnan/Desktop/AAZA Website"
   git remote add origin https://github.com/YOUR_USERNAME/aaza-travel.git
   git add .
   git commit -m "Initial AAZA travel site"
   git push -u origin main
   ```

### Step 2 — Enable GitHub Pages

1. Repo → **Settings** → **Pages**
2. Source: **Deploy from branch** → `main` → `/ (root)`
3. Save. Your site will be at `https://YOUR_USERNAME.github.io/aaza-travel/`

### Step 3 — Add GitHub Secrets (for auto Instagram updates)

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret name | Value |
|-------------|-------|
| `INSTAGRAM_ACCESS_TOKEN` | Long-lived token (works for both if same app) |
| `INSTAGRAM_USER_ID_ADNAN` | Adnan's Instagram user ID |
| `INSTAGRAM_USER_ID_AMY` | Amy's Instagram user ID |

Optional (if each account has its own token):

| Secret name | Value |
|-------------|-------|
| `INSTAGRAM_ACCESS_TOKEN_ADNAN` | Adnan's token |
| `INSTAGRAM_ACCESS_TOKEN_AMY` | Amy's token |

### Step 4 — Verify auto-updates

1. Repo → **Actions** → **Update Instagram Feed**
2. Click **Run workflow** to test immediately
3. After it runs, `js/feed.json` is updated and the site refreshes within a few minutes

The workflow runs every **2 hours** automatically.

---

## File structure

```
index.html          Home — hero + Instagram grid
vlogs.html          YouTube vlogs
itinerary.html      Trip timeline
css/style.css       All styling
js/data.js          Your content (edit this)
js/feed.json        Auto-generated Instagram feed
js/app.js           Display logic
photos/hero.jpg     Hero background image (you add this)
scripts/fetch-instagram.mjs   Instagram fetch script
.github/workflows/update-instagram.yml   Auto-update every 2 hours
```

---

## Token refresh (~every 60 days)

Long-lived Instagram tokens expire. When the feed stops updating:

1. Generate a new token in the Meta Developer dashboard
2. Update the `INSTAGRAM_ACCESS_TOKEN` secret in GitHub
3. Run the workflow manually to confirm it works

---

## Custom domain (optional)

Buy a domain (e.g. `aazatravels.com`), then in GitHub Pages settings add it as a custom domain and point your DNS CNAME to `YOUR_USERNAME.github.io`.
