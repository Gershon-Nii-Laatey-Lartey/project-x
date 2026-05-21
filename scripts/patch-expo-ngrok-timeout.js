const fs = require("fs");
const path = require("path");

const asyncNgrokPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo",
  "node_modules",
  "@expo",
  "cli",
  "build",
  "src",
  "start",
  "server",
  "AsyncNgrok.js",
);

const original = "const TUNNEL_TIMEOUT = 10 * 1000;";
const patched = "const TUNNEL_TIMEOUT = 60 * 1000;";

if (!fs.existsSync(asyncNgrokPath)) {
  console.warn(`Expo AsyncNgrok file not found at ${asyncNgrokPath}`);
  process.exit(0);
}

const source = fs.readFileSync(asyncNgrokPath, "utf8");

if (source.includes(patched)) {
  console.log("Expo ngrok timeout already patched.");
  process.exit(0);
}

if (!source.includes(original)) {
  console.warn(
    "Expo ngrok timeout pattern not found; continuing without patch.",
  );
  process.exit(0);
}

fs.writeFileSync(asyncNgrokPath, source.replace(original, patched));
console.log("Patched Expo ngrok timeout to 60 seconds.");
