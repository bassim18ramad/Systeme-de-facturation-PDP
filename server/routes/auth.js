const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendVerificationEmail } = require("../utils/email");

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key";

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

router.post("/v1/signup", async (req, res) => {
  const { email, password, options } = req.body;
  const {
    data: { full_name, role, company_id },
  } = options || { data: {} };

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

    // Insert into auth.users (Mocking Supabase) with confirmation token
    await db.query(
      "INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data, aud, role, confirmation_token, email_confirmed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)",
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

    // 3. Send verification email
    try {
      await sendVerificationEmail(email, confirmationToken);
    } catch (emailErr) {
      console.error("Failed to send verification email:", emailErr);
      // We might want to warn the user or just continue, but for security, knowing if it failed is good.
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

    // ALWAYS Include token in response for local testing
    // const isDev = process.env.NODE_ENV !== 'production';

    res.json({
      user: userObj,
      session: null,
      dev_token: confirmationToken,
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
