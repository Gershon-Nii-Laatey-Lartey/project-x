const { spawn } = require("child_process");

const port = process.env.PORT || "8081";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTunnelUrls() {
  try {
    const response = await fetch("http://127.0.0.1:4040/api/tunnels");
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return (data.tunnels || [])
      .map((tunnel) => tunnel.public_url)
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function printTunnelUrlsWhenReady() {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const urls = await fetchTunnelUrls();
    const httpsUrl = urls.find((url) => url.startsWith("https://"));
    const httpUrl = urls.find((url) => url.startsWith("http://"));
    const publicUrl = httpsUrl || httpUrl;

    if (publicUrl) {
      const expoGoUrl = publicUrl.replace(/^https?:\/\//, "exp://");

      console.log("");
      console.log("Expo tunnel is ready:");
      console.log(publicUrl);
      console.log("");
      console.log("Open this on iPhone:");
      console.log(`${publicUrl}/_expo/loading?platform=ios`);
      console.log("");
      console.log("Or paste this into Safari:");
      console.log(expoGoUrl);
      console.log("");
      return;
    }

    await sleep(1000);
  }

  console.warn("Expo tunnel URL was not found in ngrok API after 90 seconds.");
}

const expo = spawn("npx", ["expo", "start", "--tunnel", "--port", port], {
  env: {
    ...process.env,
    CI: "false",
    EXPO_RAILWAY_ANONYMOUS: "1",
    EXPO_NO_TELEMETRY: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
  shell: process.platform === "win32",
});

expo.stdout.on("data", (chunk) => process.stdout.write(chunk));
expo.stderr.on("data", (chunk) => process.stderr.write(chunk));

expo.on("exit", (code, signal) => {
  if (signal) {
    console.log(`Expo exited with signal ${signal}`);
    process.exit(1);
  }

  process.exit(code || 0);
});

printTunnelUrlsWhenReady();
