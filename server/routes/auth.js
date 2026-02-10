const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendVerificationEmail, sendRecoveryEmail } = require("../utils/email");

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key";

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ error: "Missing authorization header" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Invalid token format" });

  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid token" });
  }
};

// Mocking the auth.users table interaction
// In a real migration, you would have a real users table.
// We will assume `user_profiles` exists and we might need to add password handling there
// OR we create a `users` table on startup if it doesn't exist.

// Helper to get user
const getUserByEmail = async (email) => {
  // Check if we have a local_users table
  try {
    const res = await db.query("SELECT * FROM auth_users WHERE email = $1", [
      email,
    ]);
    return res.rows[0];
  } catch (e) {
    // If table doesn't exist, we might fail.
    // ideally we should create it.
    return null;
  }
};

router.post("/v1/recover", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    const result = await db.query("SELECT * FROM auth.users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length === 0) {
      // Don't reveal if user exists, just say ok
      return res.json({});
    }

    const user = result.rows[0];
    const recoveryToken = crypto.randomBytes(32).toString("hex");

    await db.query(
      "UPDATE auth.users SET recovery_token = $1, recovery_sent_at = NOW() WHERE id = $2",
      [recoveryToken, user.id],
    );

    // Send email without blocking
    sendRecoveryEmail(email, recoveryToken).catch((err) =>
      console.error("Failed to send recovery email:", err),
    );

    return res.json({});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/v1/reset-password", async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password)
    return res.status(400).json({ error: "Missing fields" });

  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return res.status(400).json({
      error:
        "Password must be at least 8 characters long and contain both letters and numbers.",
    });
  }

  try {
    const result = await db.query(
      "SELECT * FROM auth.users WHERE recovery_token = $1",
      [token],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Token invalide ou expiré" });
    }

    const user = result.rows[0];
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      "UPDATE auth.users SET encrypted_password = $1, recovery_token = NULL WHERE id = $2",
      [hashedPassword, user.id],
    );

    res.json({ message: "Mot de passe mis à jour avec succès" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/v1/signup", async (req, res) => {
  const { email, password, options } = req.body;
  const {
    data: { full_name, role, company_id },
  } = options || { data: {} };

  if (
    password.length < 8 ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    return res.status(400).json({
      error:
        "Password must be at least 8 characters long and contain both letters and numbers.",
    });
  }

  try {
    // Check if user already exists
    const existingUser = await db.query(
      "SELECT * FROM auth.users WHERE email = $1",
      [email],
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "User already registered" });
    }

    // 2. Create auth user
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const confirmationToken = crypto.randomBytes(32).toString("hex");

    // Prepare metadata for the trigger to use
    const userMetadata = { full_name, role, company_id };

    // Insert into pending_signups INSTEAD of auth.users
    await db.query(
      "INSERT INTO public.pending_signups (id, email, encrypted_password, raw_user_meta_data, confirmation_token) VALUES ($1, $2, $3, $4, $5)",
      [
        userId,
        email,
        hashedPassword,
        userMetadata, // Metadata handles full_name, role, etc.
        confirmationToken,
      ],
    );

    // 3. Send verification email
    try {
      await sendVerificationEmail(email, confirmationToken);
    } catch (emailErr) {
      console.error("Failed to send verification email:", emailErr);
      // DO NOT BLOCK REGISTRATION. Log the token for manual verification.
      const verifyLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify-email?token=${confirmationToken}`;
      console.log("-----------------------------------------");
      console.log("⚠️ EMAIL SENDING FAILED. MANUAL LINK:");
      console.log(verifyLink);
      console.log("-----------------------------------------");
      // Continue without returning 500
    }

    const userObj = {
      id: userId,
      email,
      user_metadata: {
        full_name,
        role: role || "employee",
      },
      app_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    // Return session as null to enforce email verification
    // The frontend should handle this by showing "Please check your email"

    res.json({
      user: userObj,
      session: null,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

router.post("/v1/token", async (req, res) => {
  const { email, password, grant_type } = req.body;

  if (grant_type === "password") {
    try {
      const userResult = await db.query(
        "SELECT * FROM auth.users WHERE email = $1",
        [email],
      );
      const user = userResult.rows[0];

      if (!user) return res.status(400).json({ error: "Invalid credentials" });

      // Note: In real Supabase, password is bcrypt.
      const valid = await bcrypt.compare(password, user.encrypted_password);
      if (!valid) return res.status(400).json({ error: "Invalid credentials" });

      // Check email verification
      if (!user.email_confirmed_at) {
        return res
          .status(400)
          .json({ error: "Email not verified. Please check your inbox." });
      }

      // Fetch profile data to populate user_metadata
      const profileResult = await db.query(
        "SELECT * FROM user_profiles WHERE id = $1",
        [user.id],
      );
      const profile = profileResult.rows[0] || {};

      const userObj = {
        id: user.id,
        email: user.email,
        user_metadata: {
          full_name: profile.full_name,
          role: profile.role,
        },
        app_metadata: {},
        aud: "authenticated",
        created_at: user.created_at,
      };

      const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET);

      return res.json({
        user: userObj,
        session: { access_token: token, user: userObj },
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(400).json({ error: "Unsupported grant_type" });
});

router.get("/v1/verify", async (req, res) => {
  const { token } = req.query;

  if (!token) return res.status(400).json({ error: "Missing token" });

  try {
    // 1. First, search in pending_signups (New behavior)
    let pendingRes = await db.query(
      "SELECT * FROM public.pending_signups WHERE confirmation_token = $1",
      [token],
    );

    if (pendingRes.rows.length > 0) {
      // It's a pending user! Let's migrate them to auth.users NOW.
      const newUser = pendingRes.rows[0];

      // Move to auth.users
      await db.query(
        "INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data, aud, role, confirmation_token, email_confirmed_at) VALUES ($1, $2, $3, $4, $5, $6, NULL, NOW())",
        [
          newUser.id,
          newUser.email,
          newUser.encrypted_password,
          newUser.raw_user_meta_data,
          "authenticated",
          "authenticated",
          // Token is NULL because it's used
        ],
      );

      // Trigger should fire and create the profile (handled by postgres trigger)

      // Delete from pending
      await db.query("DELETE FROM public.pending_signups WHERE id = $1", [
        newUser.id,
      ]);

      // Continue to create session...
      const user = newUser; // alias for JWT creation below

      // Create session token
      const accessToken = jwt.sign(
        { sub: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: "1h" },
      );

      const userObj = {
        id: user.id,
        email: user.email,
        user_metadata: {
          full_name:
            typeof user.raw_user_meta_data === "string"
              ? JSON.parse(user.raw_user_meta_data).full_name
              : user.raw_user_meta_data?.full_name,
          role:
            (typeof user.raw_user_meta_data === "string"
              ? JSON.parse(user.raw_user_meta_data).role
              : user.raw_user_meta_data?.role) || "employee",
        },
        app_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      };

      return res.json({
        user: userObj,
        session: {
          access_token: accessToken,
          token_type: "bearer",
          user: userObj,
        },
      });
    }

    // 2. Fallback: Search in auth.users (Old behavior for existing users)
    const result = await db.query(
      "SELECT * FROM auth.users WHERE confirmation_token = $1",
      [token],
    );
    const user = result.rows[0];

    if (!user)
      return res.status(400).json({ error: "Invalid or expired token" });

    // Mark as verified
    await db.query(
      "UPDATE auth.users SET email_confirmed_at = NOW(), confirmation_token = NULL WHERE id = $1",
      [user.id],
    );

    // Create session token
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email },
      JWT_SECRET,
    );

    // Fetch full profile for the response
    const profileResult = await db.query(
      "SELECT * FROM user_profiles WHERE id = $1",
      [user.id],
    );
    const profile = profileResult.rows[0] || {};

    const userObj = {
      id: user.id,
      email: user.email,
      user_metadata: {
        full_name: profile.full_name,
        role: profile.role,
      },
      app_metadata: {},
      aud: "authenticated",
      created_at: user.created_at,
    };

    res.json({
      message: "Email verified successfully",
      session: { access_token: accessToken, user: userObj },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Admin Create User Route (Protected)
router.post("/v1/admin/create-user", verifyToken, async (req, res) => {
  const {
    email,
    password,
    full_name,
    company_id,
    role = "employee",
  } = req.body;

  try {
    // 1. Check permissions (optional: check if req.user.role === 'employer')
    // For now assuming any authenticated user can try (RLS limits usage anyway usually, but here manual check)

    // Check if user already exists
    const existingUser = await db.query(
      "SELECT * FROM auth.users WHERE email = $1",
      [email],
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "User already registered" });
    }

    // 2. Create auth user (Auto-confirmed)
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const confirmationToken = crypto.randomBytes(32).toString("hex");

    const userMetadata = { full_name, role, company_id };

    await db.query(
      "INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data, aud, role, confirmation_token, email_confirmed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())",
      [
        userId,
        email,
        hashedPassword,
        userMetadata,
        "authenticated",
        "authenticated",
        confirmationToken,
      ],
    );

    // Note: The public.user_profiles should be created by the Trigger on auth.users insert.
    // Ensure the trigger handles 'full_name' and 'company_id' from raw_user_meta_data correctly.
    // If your trigger only takes new.id and email, we might need to update the profile explicitly here.

    // Let's verify trigger behavior or manually update profile to be safe.
    // Waiting a tick for trigger? Or just UPSERT.

    // Explicitly update profile to ensure company linkage and active status
    // (Assuming trigger creates it, we update it. Or we insert if trigger fails/doesn't exist)
    const profileInsert = `
      INSERT INTO user_profiles (id, email, full_name, role, company_id, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      company_id = EXCLUDED.company_id,
      status = 'active';
    `;

    await db.query(profileInsert, [userId, email, full_name, role, company_id]);

    const userObj = {
      id: userId,
      email,
      user_metadata: userMetadata,
      app_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    res.json({
      user: userObj,
      message: "User created successfully",
    });
  } catch (err) {
    console.error("Admin Create Error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/v1/user", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing token" });

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ id: payload.sub, email: payload.email });
  } catch (e) {
    res.status(401).json({ error: "Invalid token" });
  }
});

module.exports = router;
