const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

// Public development key distributed by the official React Native template.
// Keep all keystore files out of the repository. Pin both revision and digest.
const url = "https://raw.githubusercontent.com/react-native-community/template/c54e73100a54576c025250d05dd0911a03b502aa/template/android/app/debug.keystore";
const sha256 = "221e0a3106aa4c3ccc154e0a418b55020b3f9ea6e84f92e8749cd9e2f39f5e58";
const target = path.resolve(__dirname, "../android/app/debug.keystore");

async function main() {
  if (fs.existsSync(target)) return;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download public test key: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== sha256) throw new Error("Public test key checksum mismatch");
  fs.writeFileSync(target, bytes);
  console.log("Prepared verified public React Native development key.");
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
