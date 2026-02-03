const { Pool } = require("pg");
require("dotenv").config();

let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn(" DATABASE_URL not found in env, using default fallback.");
  connectionString = "postgresql://postgres:postgres@localhost:5432/postgres";
}

// Simple masking for debug
const masked = connectionString.replace(/:([^:@]+)@/, ":****@");
console.log(`🔌 Database: ${masked}`);

// Fix specifically for the "client password must be a string" error
// This happens if the password in the connection string is somehow not parsed correctly by pg
// We can manually parse it to be sure.
let config = { connectionString };

try {
  const url = new URL(connectionString);
  if (url.password) {
    // Force it to be a string, although URL decoding should have done it.
    // But we can also decompose it to config object to avoid pg's internal string parsing if it's failing
    config = {
      user: url.username,
      password: String(url.password),
      host: url.hostname,
      port: url.port || 5432,
      database: url.pathname.split("/")[1],
      ssl: false,
    };
    console.log("✅ Parsed connection string manually.");
  }
} catch (e) {
  console.error("❌ Failed to parse connection string URL:", e.message);
}

const pool = new Pool(config);

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
