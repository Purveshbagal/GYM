import schedule from "node-schedule";

const BASE_URL = process.env.BACKEND_PUBLIC_URL || "http://localhost:3000";

async function runExpiryCheck() {
  try {
    const res = await fetch(`${BASE_URL}/api/cron/expiry-check`);
    const data = await res.json();
    console.log(`[cron] expiry-check: ${JSON.stringify(data)} @ ${new Date().toISOString()}`);
  } catch (err) {
    console.error("[cron] expiry-check failed:", err);
  }
}

// Runs daily at 00:05, after the app server (`npm run dev` / `npm start`)
// is already up. Start with: `npm run cron`
schedule.scheduleJob("5 0 * * *", runExpiryCheck);

console.log("Cron scheduler started: expiry-check daily at 00:05");
runExpiryCheck();
