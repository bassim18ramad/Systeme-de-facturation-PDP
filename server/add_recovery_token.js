const db = require('./db');

async function run() {
  console.log("Adding recovery_token column to auth.users...");
  const sql = `
    ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS recovery_token text;
    ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS recovery_sent_at timestamptz;
  `;

  try {
    await db.query(sql);
    console.log("Success! Added recovery columns.");
  } catch (err) {
    console.error("Error updating table:", err);
  } finally {
    setTimeout(() => process.exit(), 500);
  }
}

run();
