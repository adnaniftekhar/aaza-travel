import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const logFile = path.join(repoRoot, "logs", "feed-update.log");

const FEED_FILES = [
  "js/feed.json",
  "js/feed-archive.json",
  "js/blog.json",
];

function loadEnvLocal() {
  const envPath = path.join(repoRoot, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.appendFileSync(logFile, `${line}\n`);
}

function run(cmd) {
  execSync(cmd, { cwd: repoRoot, stdio: "inherit", env: process.env });
}

function tryRun(cmd) {
  try {
    execSync(cmd, { cwd: repoRoot, stdio: "pipe", env: process.env });
    return true;
  } catch {
    return false;
  }
}

function hasStagedChanges() {
  try {
    execSync("git diff --staged --quiet", { cwd: repoRoot });
    return false;
  } catch {
    return true;
  }
}

function workingTreeDirty() {
  try {
    execSync("git diff --quiet", { cwd: repoRoot });
    execSync("git diff --cached --quiet", { cwd: repoRoot });
    return false;
  } catch {
    return true;
  }
}

function syncWithGitHub() {
  log("Syncing with GitHub");
  run("git fetch origin main");
  tryRun("git merge --abort");
  tryRun("git rebase --abort");

  // Never wipe unrelated local code edits. Only hard-reset when the tree is clean.
  if (workingTreeDirty()) {
    log(
      "Local changes detected — refreshing feed/blog JSON from origin only (not wiping your code).",
    );
    tryRun(
      "git checkout origin/main -- js/feed.json js/feed-archive.json js/blog.json",
    );
    return;
  }

  run("git reset --hard origin/main");
}

function publishChanges() {
  run(`git add ${FEED_FILES.join(" ")} photos/feed/`);
  if (!hasStagedChanges()) {
    log("No changes to commit.");
    return;
  }

  run('git commit -m "Update Instagram feed and blog"');

  if (tryRun("git pull --rebase origin main")) {
    run("git push");
    log("Pushed updates to GitHub.");
    return;
  }

  log("Rebase conflict — rebuilding on top of origin");
  tryRun("git rebase --abort");
  if (!workingTreeDirty()) {
    run("git reset --hard origin/main");
  } else {
    tryRun(
      "git checkout origin/main -- js/feed.json js/feed-archive.json js/blog.json",
    );
  }
  run("node scripts/fetch-instagram.mjs");
  run("node scripts/fetch-blog.mjs");
  run(`git add ${FEED_FILES.join(" ")} photos/feed/`);

  if (!hasStagedChanges()) {
    log("No changes after rebuild.");
    return;
  }

  run('git commit -m "Update Instagram feed and blog"');
  run("git pull --rebase origin main");
  run("git push");
  log("Pushed updates to GitHub (after conflict recovery).");
}

async function main() {
  loadEnvLocal();
  log("Starting feed + blog update");
  syncWithGitHub();
  run("node scripts/fetch-instagram.mjs");
  run("node scripts/fetch-blog.mjs");
  publishChanges();
}

main().catch((err) => {
  log(`ERROR: ${err.message}`);
  process.exit(1);
});
