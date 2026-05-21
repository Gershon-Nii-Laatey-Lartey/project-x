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
const userActionsPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo",
  "node_modules",
  "@expo",
  "cli",
  "build",
  "src",
  "api",
  "user",
  "actions.js",
);

function patchFile(filePath, original, patched, description) {
  if (!fs.existsSync(filePath)) {
    console.warn(`${description} file not found at ${filePath}`);
    return;
  }

  const source = fs.readFileSync(filePath, "utf8");

  if (source.includes(patched)) {
    console.log(`${description} already patched.`);
    return;
  }

  if (!source.includes(original)) {
    console.warn(`${description} pattern not found; continuing without patch.`);
    return;
  }

  fs.writeFileSync(filePath, source.replace(original, patched));
  console.log(`Patched ${description}.`);
}

patchFile(
  asyncNgrokPath,
  "const TUNNEL_TIMEOUT = 10 * 1000;",
  "const TUNNEL_TIMEOUT = 60 * 1000;",
  "Expo ngrok timeout to 60 seconds",
);

patchFile(
  userActionsPath,
  "const value = await (0, _prompts.selectAsync)",
  "if (process.env.EXPO_RAILWAY_ANONYMOUS === '1') {\n        return null;\n    }\n    const value = await (0, _prompts.selectAsync)",
  "Expo Railway anonymous login prompt",
);
