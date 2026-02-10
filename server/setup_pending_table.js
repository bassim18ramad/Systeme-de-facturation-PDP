const db = require("./db");

async function run() {
  console.log("Setting up temporary storage for unverified registrations...");

  const sql = `
    -- Create a table for pending registrations
    CREATE TABLE IF NOT EXISTS public.pending_signups (
      id uuid PRIMARY KEY,
      email text NOT NULL,
      encrypted_password text NOT NULL,
      raw_user_meta_data jsonb,
      confirmation_token text NOT NULL,
      created_at timestamptz DEFAULT now()
    );
    
    -- Function to clean up old pending signups (optional, runs manually)
    CREATE OR REPLACE FUNCTION clean_expired_signups() RETURNS void AS $$
    BEGIN
      DELETE FROM public.pending_signups WHERE created_at < NOW() - INTERVAL '24 hours';
    END;
    $$ LANGUAGE plpgsql;
  `;

  try {
    await db.query(sql);
    console.log("Success! 'pending_signups' table created.");
  } catch (err) {
    console.error("Error creating table:", err);
  } finally {
    setTimeout(() => process.exit(), 500);
  }
}

run();
