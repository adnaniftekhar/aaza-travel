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

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.appendFileSync(logFile, `${line}\n`);
}

function run(cmd) {
  execSync(cmd, { cwd: repoRoot, stdio: "inherit" });
}

function tryRun(cmd) {
  try {
    execSync(cmd, { cwd: repoRoot, stdio: "pipe" });
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

function syncWithGitHub() {
  log("Syncing with GitHub (clean start)");
  run("git fetch origin main");
  tryRun("git merge --abort");
  tryRun("git rebase --abort");
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
  run("git reset --hard origin/main");
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
