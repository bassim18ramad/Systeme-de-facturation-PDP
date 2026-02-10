const { Pool } = require("pg");
require("dotenv").config();

// Config from db.js or .env
let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  connectionString = "postgresql://postgres:postgres@localhost:5432/postgres";
}

const pool = new Pool({ connectionString });

async function fixNumbering() {
  const client = await pool.connect();
  try {
    console.log("Starting numbering update...");

    // 1. Get all companies
    const { rows: companies } = await client.query("SELECT id, name FROM companies");
    
    for (const company of companies) {
      console.log(`Processing company: ${company.name} (${company.id})`);
      
      const acronym = company.name
        .split(" ")
        .map(w => w[0])
        .join("")
        .toUpperCase();
        
      if (!acronym) continue;

      // --- QUOTES ---
      const { rows: quotes } = await client.query(
        "SELECT id, created_at FROM quotes WHERE company_id = $1 ORDER BY created_at ASC",
        [company.id]
      );

      // Group by year
      const quotesByYear = {};
      for (const q of quotes) {
        const year = new Date(q.created_at).getFullYear();
        if (!quotesByYear[year]) quotesByYear[year] = [];
        quotesByYear[year].push(q);
      }

      for (const year in quotesByYear) {
        let seq = 1;
        for (const q of quotesByYear[year]) {
          const newNumber = `${acronym}_DEV-${year}${seq.toString().padStart(5, "0")}`;
          await client.query("UPDATE quotes SET quote_number = $1 WHERE id = $2", [newNumber, q.id]);
          seq++;
        }
      }
      console.log(`Updated ${quotes.length} quotes.`);

      // --- DELIVERY ORDERS ---
      const { rows: orders } = await client.query(
        "SELECT id, created_at FROM delivery_orders WHERE company_id = $1 ORDER BY created_at ASC",
        [company.id]
      );

      const ordersByYear = {};
      for (const o of orders) {
        const year = new Date(o.created_at).getFullYear();
        if (!ordersByYear[year]) ordersByYear[year] = [];
        ordersByYear[year].push(o);
      }

      for (const year in ordersByYear) {
        let seq = 1;
        for (const o of ordersByYear[year]) {
          const newNumber = `${acronym}_CMD-${year}${seq.toString().padStart(5, "0")}`;
          await client.query("UPDATE delivery_orders SET order_number = $1 WHERE id = $2", [newNumber, o.id]);
          seq++;
        }
      }
      console.log(`Updated ${orders.length} orders.`);

      // --- INVOICES ---
      const { rows: invoices } = await client.query(
        "SELECT id, created_at FROM invoices WHERE company_id = $1 ORDER BY created_at ASC",
        [company.id]
      );

      const invoicesByYear = {};
      for (const i of invoices) {
        const year = new Date(i.created_at).getFullYear();
        if (!invoicesByYear[year]) invoicesByYear[year] = [];
        invoicesByYear[year].push(i);
      }

      for (const year in invoicesByYear) {
        let seq = 1;
        for (const i of invoicesByYear[year]) {
          const newNumber = `${acronym}_FACT-${year}${seq.toString().padStart(5, "0")}`;
          await client.query("UPDATE invoices SET invoice_number = $1 WHERE id = $2", [newNumber, i.id]);
          seq++;
        }
      }
      console.log(`Updated ${invoices.length} invoices.`);
    }

    console.log("All updates complete.");
  } catch (err) {
    console.error("Error updating numbering:", err);
  } finally {
    client.release();
    pool.end();
  }
}

fixNumbering();
