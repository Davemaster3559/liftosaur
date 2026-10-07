const path = require("path");
const { spawnSync } = require("child_process");

const windows = process.platform === "win32";
const result = spawnSync(windows ? "gradlew.bat" : "./gradlew", [
  ":app:assembleRelease", "-PreactNativeArchitectures=arm64-v8a", ...process.argv.slice(2),
], {
  cwd: path.resolve(__dirname, "../android"),
  stdio: "inherit",
  shell: windows,
  env: { ...process.env, DISABLE_OTA: "1" },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
