const express = require("express");

const path = require("path");

const app = express();

// Store ping logs and stats
let pingLogs = [];
let stats = {
  startTime: new Date(),
  pingCount: 0,
  successCount: 0,
  totalResponseTime: 0
};

// Main app URL for status checking
const MAIN_APP_URL = "https://biege.onrender.com";

// Your main app’s URLs for random pinging
const RANDOM_URLS = process.env.RANDOM_URLS
  ? process.env.RANDOM_URLS.split(",")
  : [
      "https://biege.onrender.com/home.html",
      "https://biege.onrender.com/admin.html",
      "https://biege.onrender.com/booking.html"
    ];

// Dedicated URL to ping every 10 minutes
const DEDICATED_URL = process.env.DEDICATED_URL || "https://biege.onrender.com/priority"; // Replace with actual URL

// Self-ping URL (set dynamically after server starts)
let SELF_PING_URL = null;

// Helper: random delay
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Ping a single URL with retry logic
async function pingUrl(url, retries = 3, retryDelay = 5000) {
  let startTime = Date.now();
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { timeout: 10000 });
      const responseTime = Date.now() - startTime;
      const log = {
        timestamp: new Date().toISOString(),
        type: "success",
        message: `Pinged ${url} → ${res.status} (Attempt ${attempt}, ${responseTime}ms)`
      };
      console.log(log.message);
      pingLogs.push(log);
      if (pingLogs.length > 100) pingLogs.shift();
      stats.pingCount++;
      stats.successCount++;
      stats.totalResponseTime += responseTime;
      return true;
    } catch (err) {
      const log = {
        timestamp: new Date().toISOString(),
        type: "error",
        message: `Ping failed for ${url}: ${err.message} (Attempt ${attempt})`
      };
      console.error(log.message);
      pingLogs.push(log);
      if (pingLogs.length > 100) pingLogs.shift();
      if (attempt < retries) {
        console.log(`Retrying ${url} in ${retryDelay / 1000}s...`);
        pingLogs.push({
          timestamp: new Date().toISOString(),
          type: "info",
          message: `Retrying ${url} in ${retryDelay / 1000}s...`
        });
        await new Promise((r) => setTimeout(r, retryDelay));
      } else {
        pingLogs.push({
          timestamp: new Date().toISOString(),
          type: "error",
          message: `All ${retries} attempts failed for ${url}`
        });
        stats.pingCount++;
      }
    }
  }
  return false;
}

// Ping a random URL
async function pingRandom() {
  const url = RANDOM_URLS[Math.floor(Math.random() * RANDOM_URLS.length)];
  const success = await pingUrl(url);
  if (!success) {
    const log = {
      timestamp: new Date().toISOString(),
      type: "warning",
      message: `Failed to ping ${url} after retries`
    };
    console.warn(log.message);
    pingLogs.push(log);
  }
}

// Ping the dedicated URL
async function pingDedicated() {
  const success = await pingUrl(DEDICATED_URL);
  if (!success) {
    const log = {
      timestamp: new Date().toISOString(),
      type: "warning",
      message: `Failed to ping dedicated URL ${DEDICATED_URL} after retries`
    };
    console.warn(log.message);
    pingLogs.push(log);
  }
}

// Ping the Web Service itself to prevent idling
async function pingSelf() {
  if (!SELF_PING_URL) {
    const log = {
      timestamp: new Date().toISOString(),
      type: "warning",
      message: `Self-ping URL not set yet`
    };
    console.warn(log.message);
    pingLogs.push(log);
    return;
  }
  const success = await pingUrl(SELF_PING_URL);
  if (!success) {
    const log = {
      timestamp: new Date().toISOString(),
      type: "warning",
      message: `Failed to ping self ${SELF_PING_URL} after retries`
    };
    console.warn(log.message);
    pingLogs.push(log);
  }
}

// Check main app status
async function checkSiteStatus() {
  try {
    const startTime = Date.now();
    const res = await fetch(MAIN_APP_URL, { timeout: 10000 });
    const responseTime = Date.now() - startTime;
    const isLive = res.status === 200;
    const log = {
      timestamp: new Date().toISOString(),
      type: isLive ? "success" : "error",
      message: `Site status check for ${MAIN_APP_URL}: ${isLive ? "Live" : `Not Live (Status: ${res.status})`}`
    };
    console.log(log.message);
    pingLogs.push(log);
    return { isLive, status: res.status, checkedAt: new Date().toISOString(), responseTime };
  } catch (err) {
    const log = {
      timestamp: new Date().toISOString(),
      type: "error",
      message: `Site status check failed for ${MAIN_APP_URL}: ${err.message}`
    };
    console.error(log.message);
    pingLogs.push(log);
    return { isLive: false, error: err.message, checkedAt: new Date().toISOString(), responseTime: null };
  }
}

// Run random pings forever (5–15 minutes)
async function startRandomPings() {
  while (true) {
    await pingRandom();
    const waitTime = randomDelay(5, 15) * 60 * 1000;
    const log = {
      timestamp: new Date().toISOString(),
      type: "info",
      message: `Waiting ${waitTime / 1000 / 60} minutes before next random ping...`
    };
    console.log(log.message);
    pingLogs.push(log);
    await new Promise((r) => setTimeout(r, waitTime));
  }
}

// Run dedicated pings forever (every 10 minutes)
async function startDedicatedPings() {
  const fixedInterval = 10 * 60 * 1000; // 10 minutes
  while (true) {
    await pingDedicated();
    const log = {
      timestamp: new Date().toISOString(),
      type: "info",
      message: `Waiting 10 minutes before next dedicated ping...`
    };
    console.log(log.message);
    pingLogs.push(log);
    await new Promise((r) => setTimeout(r, fixedInterval));
  }
}

// Run self-pings forever (every 13 minutes)
async function startSelfPings() {
  const fixedInterval = 13 * 60 * 1000; // 13 minutes
  while (true) {
    await pingSelf();
    const log = {
      timestamp: new Date().toISOString(),
      type: "info",
      message: `Waiting 13 minutes before next self-ping...`
    };
    console.log(log.message);
    pingLogs.push(log);
    await new Promise((r) => setTimeout(r, fixedInterval));
  }
}

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// API endpoint for ping logs
app.get("/api/logs", (req, res) => {
  try {
    res.json({ logs: pingLogs });
  } catch (err) {
    const log = {
      timestamp: new Date().toISOString(),
      type: "error",
      message: `Error serving /api/logs: ${err.message}`
    };
    console.error(log.message);
    pingLogs.push(log);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

// API endpoint for site status
app.get("/api/site-status", async (req, res) => {
  try {
    const status = await checkSiteStatus();
    res.json(status);
  } catch (err) {
    const log = {
      timestamp: new Date().toISOString(),
      type: "error",
      message: `Error serving /api/site-status: ${err.message}`
    };
    console.error(log.message);
    pingLogs.push(log);
    res.status(500).json({ error: "Failed to fetch site status" });
  }
});

// API endpoint for stats
app.get("/api/stats", (req, res) => {
  try {
    const uptime = ((Date.now() - stats.startTime) / (1000 * 60 * 60 * 24)).toFixed(2); // Days
    const successRate = stats.pingCount > 0 ? ((stats.successCount / stats.pingCount) * 100).toFixed(2) : 0;
    const avgResponseTime = stats.successCount > 0 ? (stats.totalResponseTime / stats.successCount).toFixed(0) : 0;
    res.json({
      uptime: `${uptime} days`,
      successRate: `${successRate}%`,
      responseTime: `${avgResponseTime}ms`
    });
  } catch (err) {
    const log = {
      timestamp: new Date().toISOString(),
      type: "error",
      message: `Error serving /api/stats: ${err.message}`
    };
    console.error(log.message);
    pingLogs.push(log);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Start server and pings
async function start() {
  const allUrls = [...RANDOM_URLS, DEDICATED_URL];
  if (!allUrls.every(url => url.startsWith("http"))) {
    const log = {
      timestamp: new Date().toISOString(),
      type: "error",
      message: `Invalid URLs detected: ${allUrls.join(", ")}`
    };
    console.error(log.message);
    pingLogs.push(log);
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] Starting keep-alive bot...`);
  pingLogs.push({
    timestamp: new Date().toISOString(),
    type: "info",
    message: `Starting keep-alive bot...`
  });

  // Start Express server
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    pingLogs.push({
      timestamp: new Date().toISOString(),
      type: "info",
      message: `Server running on port ${port}`
    });
    // Set self-ping URL after server starts
    SELF_PING_URL = process.env.SELF_PING_URL || `http://localhost:${port}`;
    console.log(`Self-ping URL set to ${SELF_PING_URL}`);
    pingLogs.push({
      timestamp: new Date().toISOString(),
      type: "info",
      message: `Self-ping URL set to ${SELF_PING_URL}`
    });
    // Validate SELF_PING_URL
    if (!SELF_PING_URL.startsWith("http")) {
      const log = {
        timestamp: new Date().toISOString(),
        type: "error",
        message: `Invalid SELF_PING_URL: ${SELF_PING_URL}`
      };
      console.error(log.message);
      pingLogs.push(log);
      process.exit(1);
    }
  });

  // Start all ping cycles
  Promise.all([
    startRandomPings(),
    startDedicatedPings(),
    startSelfPings()
  ]).catch(err => {
    const log = {
      timestamp: new Date().toISOString(),
      type: "error",
      message: `Fatal error: ${err.message}`
    };
    console.error(log.message);
    pingLogs.push(log);
    process.exit(1);
  });
}

start();
