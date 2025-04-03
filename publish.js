const { execSync } = require("child_process");

const versionType = process.argv[2] || "patch"; // Default to patch if not specified

try {
  console.log(`🔄 Updating package version (${versionType})...`);
  execSync(`npm version ${versionType}`, { stdio: "inherit" });
  
  console.log("📦 Pushing to git ...");
  execSync("git push", { stdio: "inherit" });

  console.log("📦 Publishing package...");
  execSync("npm publish", { stdio: "inherit" });

  console.log("✅ Published successfully!");
} catch (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
}
