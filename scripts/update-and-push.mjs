import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const logFile = path.join(repoRoot, "logs", "feed-update.log");

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.appendFileSync(logFile, `${line}\n`);
}

function run(cmd) {
  execSync(cmd, { cwd: repoRoot, stdio: "inherit" });
}

function hasStagedChanges() {
  try {
    execSync("git diff --staged --quiet", { cwd: repoRoot });
    return false;
  } catch {
    return true;
  }
}

async function main() {
  log("Starting feed + blog update");

  run("node scripts/fetch-instagram.mjs");
  run("node scripts/fetch-blog.mjs");

  run("git add js/feed.json js/feed-archive.json js/blog.json photos/feed/");
  if (!hasStagedChanges()) {
    log("No changes to commit.");
    return;
  }

  run('git commit -m "Update Instagram feed and blog"');
  run("git pull --rebase origin main");
  run("git push");
  log("Pushed updates to GitHub.");
}

main().catch((err) => {
  log(`ERROR: ${err.message}`);
  process.exit(1);
});
