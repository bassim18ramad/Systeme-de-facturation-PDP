const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // preserve original extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const upload = multer({ storage: storage });

// Upload route: /storage/v1/object/:bucket/:filename
// Note: Supabase upload URL is /storage/v1/object/bucket/path/to/file
// and it expects the file body. Multer expects multipart/form-data.
// Supabase-js client sends FormData usually.

router.post(/^\/object\/([^/]+)\/(.+)$/, upload.single("file"), (req, res) => {
  const bucket = req.params[0];
  const relativePath = req.params[1];

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // Use bucket as a folder
  const bucketDir = path.join(uploadDir, bucket);
  if (!fs.existsSync(bucketDir)) {
    fs.mkdirSync(bucketDir, { recursive: true });
  }

  // Handle subdirectories in relativePath
  const finalPath = path.join(bucketDir, relativePath);
  const finalDir = path.dirname(finalPath);

  if (!fs.existsSync(finalDir)) {
    fs.mkdirSync(finalDir, { recursive: true });
  }

  try {
    fs.renameSync(req.file.path, finalPath);
  } catch (e) {
    return res.status(500).json({ error: "Failed to save file: " + e.message });
  }

  const key = `${bucket}/${relativePath}`;
  res.json({ Key: key, path: key });
});

// Get Public URL
// Client calls: supabase.storage.from(bucket).getPublicUrl(path)
// This is a client-side method mostly, but it needs a URL structure.
// We serve files statically or via route.

router.get(/^\/object\/public\/([^/]+)\/(.+)$/, (req, res) => {
  const bucket = req.params[0];
  const relativePath = req.params[1];

  // Security check to prevent directory traversal
  if (relativePath.includes("..")) {
    return res.status(400).json({ error: "Invalid path" });
  }

  const filePath = path.join(uploadDir, bucket, relativePath);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: "File not found" });
  }
});

module.exports = router;
