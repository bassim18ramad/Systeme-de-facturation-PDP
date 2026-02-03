const db = require("./db");

(async () => {
  try {
    console.log("🛠️ Starting data fix...");

    // 1. Check or Create Company
    let companyId;
    const companyRes = await db.query("SELECT id FROM companies LIMIT 1");

    if (companyRes.rows.length > 0) {
      companyId = companyRes.rows[0].id;
      console.log(`✅ Found existing company: ${companyId}`);
    } else {
      // Find an employer to own the company
      const employerRes = await db.query(
        "SELECT id FROM user_profiles WHERE role = 'employer' LIMIT 1",
      );
      const employerId =
        employerRes.rows.length > 0 ? employerRes.rows[0].id : null;

      console.log("⚠️ No company found. Creating 'Default Company'...");
      const newComp = await db.query(
        `
        INSERT INTO companies (name, employer_id)
        VALUES ('Ma Entreprise', $1)
        RETURNING id
      `,
        [employerId],
      ); // employerId can be null if table allows, if not it will fail (users should exist)

      companyId = newComp.rows[0].id;
      console.log(`✅ Created company: ${companyId}`);
    }

    // 2. Link Orphan Profiles to Company
    const updateRes = await db.query(
      `
      UPDATE user_profiles
      SET company_id = $1
      WHERE company_id IS NULL
    `,
      [companyId],
    );

    console.log(
      `✅ Updated ${updateRes.rowCount} user profiles to belong to company ${companyId}`,
    );

    // 3. Create missing profiles for Auth Users
    // This fixes the issue where you login but see nothing because you have no profile/company
    const insertMissingRes = await db.query(
      `
      INSERT INTO user_profiles (id, email, full_name, role, company_id)
      SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', 'Utilisateur'), 'employer', $1
      FROM auth.users
      WHERE id NOT IN (SELECT id FROM user_profiles)
      RETURNING email
    `,
      [companyId],
    );

    if (insertMissingRes.rowCount > 0) {
      console.log(
        `✅ Created ${insertMissingRes.rowCount} missing profiles linked to company:`,
        insertMissingRes.rows.map((r) => r.email),
      );
    }

    // Verify
    const profiles = await db.query(
      "SELECT email, company_id FROM user_profiles",
    );
    console.table(profiles.rows);
  } catch (err) {
    console.error("❌ Error fixing data:", err);
  } finally {
    process.exit();
  }
})();
