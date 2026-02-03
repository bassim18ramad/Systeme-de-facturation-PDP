const db = require("./db");

(async () => {
  try {
    console.log("--- User Profiles ---");
    const profiles = await db.query(
      "SELECT id, email, company_id, role FROM user_profiles",
    );
    console.table(profiles.rows);

    console.log("\n--- Quotes (Top 5) ---");
    const quotes = await db.query(
      "SELECT id, company_id, quote_number FROM quotes LIMIT 5",
    );
    console.table(quotes.rows);

    console.log("\n--- Auth Users ---");
    // Assuming auth.users is accessible or we mock it in a way we can read
    // Note: standard postgres user might not not see 'auth' schema if search_path isn't set,
    // but usually can Select if owner.
    try {
      const users = await db.query("SELECT id, email FROM auth.users");
      console.table(users.rows);
    } catch (e) {
      console.log("Could not read auth.users: " + e.message);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
})();
