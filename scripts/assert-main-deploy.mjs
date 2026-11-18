import { execFileSync } from "node:child_process";

function currentBranch() {
  try {
    return execFileSync("git", ["branch", "--show-current"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

const branch = currentBranch();
if (branch !== "main") {
  console.error(
    `BLOCKED: production Firebase deploys are allowed only from main (current branch: ${branch || "detached HEAD"}). Merge your changes to main first, then deploy from main.`,
  );
  process.exit(1);
}

console.log("Deploy branch check passed: main.");
