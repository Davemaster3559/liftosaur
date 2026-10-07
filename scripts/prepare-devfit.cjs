const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
if (!fs.existsSync(path.join(root, "localdomain.js"))) {
  fs.copyFileSync(path.join(root, "localdomain.default.js"), path.join(root, "localdomain.js"));
}

for (const args of [
  ["generate-semantic-colors.js"],
  ["scripts/generate-theme-css.js"],
  ["scripts/build-markdown.js"],
  ["-r", "ts-node/register", "scripts/build-programs.ts"],
]) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, TS_NODE_TRANSPILE_ONLY: "1" },
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

const index = JSON.parse(fs.readFileSync(path.join(root, "programdata/index.json"), "utf8"));
const programs = {};
for (const category of ["builtin", "community"]) {
  const directory = path.join(root, "programdata/programs", category);
  if (!fs.existsSync(directory)) continue;
  for (const filename of fs.readdirSync(directory).filter((name) => name.endsWith(".json"))) {
    programs[`${category}/${filename.slice(0, -5)}`] = JSON.parse(fs.readFileSync(path.join(directory, filename), "utf8"));
  }
}
fs.writeFileSync(path.join(root, "src/devfit/programCatalog.generated.json"), JSON.stringify({ index, programs }));
console.log(`DevFit bundled ${index.length} programs for offline use.`);
