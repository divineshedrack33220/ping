
// Your Render app URLs for random pinging
const RANDOM_URLS = [
  "https://your-app.onrender.com/", // Replace with your app's URLs
  "https://your-app.onrender.com/about",
  "https://your-app.onrender.com/api/health"
];

// Dedicated URL to ping every 10 minutes
const DEDICATED_URL = "https://your-app.onrender.com/priority"; // Replace with your specific URL

// Helper: random delay
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Ping a single URL with retry logic
async function pingUrl(url, retries = 3, retryDelay = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { timeout: 10000 });
      console.log(`[${new Date().toISOString()}] Pinged ${url} → ${res.status} (Attempt ${attempt})`);
      return true;
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Ping failed for ${url}: ${err.message} (Attempt ${attempt})`);
      if (attempt < retries) {
        console.log(`Retrying ${url} in ${retryDelay / 1000}s...`);
        await new Promise((r) => setTimeout(r, retryDelay));
      } else {
        console.error(`[${new Date().toISOString()}] All ${retries} attempts failed for ${url}`);
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
    console.warn(`[${new Date().toISOString()}] Failed to ping ${url} after retries`);
  }
}

// Ping the dedicated URL
async function pingDedicated() {
  const success = await pingUrl(DEDICATED_URL);
  if (!success) {
    console.warn(`[${new Date().toISOString()}] Failed to ping dedicated URL ${DEDICATED_URL} after retries`);
  }
}

// Run random pings forever (5–15 minutes)
async function startRandomPings() {
  while (true) {
    await pingRandom();
    const waitTime = randomDelay(5, 15) * 60 * 1000;
    console.log(`[${new Date().toISOString()}] Waiting ${waitTime / 1000 / 60} minutes before next random ping...`);
    await new Promise((r) => setTimeout(r, waitTime));
  }
}

// Run dedicated pings forever (every 10 minutes)
async function startDedicatedPings() {
  const fixedInterval = 10 * 60 * 1000; // 10 minutes
  while (true) {
    await pingDedicated();
    console.log(`[${new Date().toISOString()}] Waiting 10 minutes before next dedicated ping...`);
    await new Promise((r) => setTimeout(r, fixedInterval));
  }
}

// Run both ping cycles
async function start() {
  const allUrls = [...RANDOM_URLS, DEDICATED_URL];
  if (!allUrls.every(url => url.startsWith('http'))) {
    console.error('Invalid URLs detected. Please check your URL configurations.');
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] Starting keep-alive bot...`);
  Promise.all([
    startRandomPings(),
    startDedicatedPings()
  ]).catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
}

start();