const db = require("./db");

async function run() {
  console.log(
    "Updating trigger logic to create profile ONLY after email verification...",
  );

  const sql = `
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Si l'email n'est pas confirmé, on ne fait rien (on attend).
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. On crée le profil SEULEMENT si :
  --    a) C'est une insertion et l'email est déjà confirmé (ex: création admin)
  --    b) C'est une mise à jour et l'email vient d'être confirmé (transition NULL -> DATE)
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.email_confirmed_at IS NULL) THEN
      INSERT INTO public.user_profiles (id, email, full_name, role, company_id)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, 'Utilisateur'),
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'employee'),
        NULLIF(NEW.raw_user_meta_data->>'company_id', '')::uuid
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role;
  END IF;
    
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Drop old trigger (which was likely INSERT only)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create new trigger on INSERT AND UPDATE
CREATE TRIGGER on_auth_user_created
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  `;

  try {
    await db.query(sql);
    console.log("Success! Trigger updated.");
  } catch (err) {
    console.error("Error updating trigger:", err);
  } finally {
    // Keep connection alive briefly to ensure logs flush if needed, usually exit is fine
    setTimeout(() => process.exit(), 500);
  }
}

run();
