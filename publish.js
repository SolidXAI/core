const { execSync } = require("child_process");

const args = process.argv.slice(2);
const forceFlag = args.includes("--force");
const dryRun = args.includes("--dry-run");
const versionType = args.find((arg) => !arg.startsWith("--")) || "patch";

const MAIN_BRANCH = "main";
const DEV_BRANCH = "dev";

function exec(cmd, options = {}) {
  if (dryRun) {
    console.log(`[dry-run] ${cmd}`);
    return "";
  }
  return execSync(cmd, { stdio: "inherit", ...options });
}

function getCurrentBranch() {
  return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
}

try {
  // Check we're on main branch
  const currentBranch = getCurrentBranch();
  if (currentBranch !== MAIN_BRANCH) {
    if (forceFlag) {
      console.log(`⚠️  Not on ${MAIN_BRANCH} branch (on ${currentBranch}), but --force flag set. Continuing...`);
    } else {
      console.error(`❌ Must be on ${MAIN_BRANCH} branch to publish. Currently on: ${currentBranch}`);
      console.error(`   Use --force to override this check.`);
      process.exit(1);
    }
  }

  if (dryRun) {
    console.log("🧪 Dry run mode - no changes will be made\n");
  }

  console.log(`🔄 Updating package version (${versionType})...`);
  exec(`npm version ${versionType}`);

  console.log("📦 Pushing to git (with tags)...");
  exec("git push --follow-tags");

  console.log("📦 Publishing package...");
  exec("npm publish");

  console.log("✅ Published successfully!\n");

  // Reverse merge to dev
  console.log(`🔀 Merging ${MAIN_BRANCH} into ${DEV_BRANCH}...`);
  exec(`git checkout ${DEV_BRANCH}`);
  exec(`git pull origin ${DEV_BRANCH}`);

  try {
    exec(`git merge ${MAIN_BRANCH} -m "chore: merge ${MAIN_BRANCH} after publish"`);
    exec(`git push origin ${DEV_BRANCH}`);
    console.log(`✅ Successfully merged ${MAIN_BRANCH} into ${DEV_BRANCH}\n`);
  } catch (mergeError) {
    console.error(`\n⚠️  Merge conflict detected. Please resolve manually.`);
    console.error(`   You are now on the ${DEV_BRANCH} branch.`);
    process.exit(1);
  }

  // Return to main branch
  exec(`git checkout ${MAIN_BRANCH}`);
  console.log(`📍 Back on ${MAIN_BRANCH} branch`);

  console.log("\n🎉 All done!");
} catch (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
}
