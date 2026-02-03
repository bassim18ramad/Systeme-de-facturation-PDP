const express = require("express");
const router = express.Router();
const db = require("../db");

// Generic handler for "supabase-like" queries
// POST /api/:table
// Body: { select: '*', eq: { col: val }, order: { col: 'asc' } }
// This is a simplified adapter.

router.all("/:table", async (req, res) => {
  const table = req.params.table;
  const method = req.method;

  try {
    if (method === "GET") {
      // Handle SELECT
      // Query params: select=*, company_id=eq.123, order=created_at.desc
      // This requires parsing PostgREST syntax or custom query params.
      // Simplification: We look at query string.

      let query = `SELECT * FROM ${table}`;
      let conditions = [];
      let values = [];
      let paramIndex = 1;

      // Simple filter parsing
      for (const [key, val] of Object.entries(req.query)) {
        if (key === "select") continue;
        if (key === "order") continue;
        if (key.startsWith("_")) continue;

        // Handle "in.(...)"
        if (
          typeof val === "string" &&
          val.startsWith("in.(") &&
          val.endsWith(")")
        ) {
          const inner = val.slice(4, -1);
          if (inner.length === 0) {
            conditions.push("1=0"); // Empty set matches nothing
            continue;
          }
          const items = inner.split(",");
          const placeholders = items.map(() => `$${paramIndex++}`).join(", ");

          conditions.push(`${key} IN (${placeholders})`);
          values.push(...items);
          continue;
        }

        conditions.push(`${key} = $${paramIndex}`);
        values.push(val);
        paramIndex++;
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      if (req.query.order) {
        // format: column.direction (e.g. created_at.desc)
        const [col, dir] = req.query.order.split(".");
        query += ` ORDER BY ${col} ${dir === "desc" ? "DESC" : "ASC"}`;
      }

      const result = await db.query(query, values);
      res.json(result.rows);
    } else if (method === "POST") {
      // INSERT / UPSERT
      const body = req.body;
      const isUpsert = req.query._upsert === "true";
      const ignoreDuplicates = req.query._ignore_duplicates === "true";
      const conflictTarget = req.query._on_conflict;

      const performInsert = async (item) => {
        const keys = Object.keys(item);
        const values = Object.values(item);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");

        let query = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`;

        if (isUpsert) {
          const target = conflictTarget || "id";
          if (ignoreDuplicates) {
            query += ` ON CONFLICT (${target}) DO NOTHING`;
          } else {
            const updateSet = keys
              .map((k) => `${k} = EXCLUDED.${k}`)
              .join(", ");
            query += ` ON CONFLICT (${target}) DO UPDATE SET ${updateSet}`;
          }
        }

        query += ` RETURNING *`;
        return db.query(query, values);
      };

      // If array insert (batch)
      if (Array.isArray(body)) {
        const results = [];
        for (const item of body) {
          const res = await performInsert(item);
          if (res.rows.length > 0) results.push(res.rows[0]);
        }
        res.status(201).json(results);
        return;
      }

      const result = await performInsert(body);
      res.status(201).json(result.rows);
    } else if (method === "PATCH") {
      // UPDATE
      // Need ID or filter.
      // Assuming ?id=...
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "Update requires id" });

      const body = req.body;
      const keys = Object.keys(body);
      const values = Object.values(body);

      const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
      values.push(id);

      const query = `UPDATE ${table} SET ${setClause} WHERE id = $${values.length} RETURNING *`;
      const result = await db.query(query, values);
      res.json(result.rows);
    } else if (method === "DELETE") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "Delete requires id" });

      await db.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
      res.status(204).send();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Specific route for POST /rpc/ (Supabase Functions) if any
// router.post('/rpc/:function', ...);

module.exports = router;
