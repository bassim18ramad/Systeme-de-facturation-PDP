const fs = require('fs');
const path = require('path');
const { pool } = require('./db');
require('dotenv').config();

const migrationsDir = path.join(__dirname, '../supabase/migrations');
const initScript = path.join(__dirname, 'init_mock_supabase.sql');

async function runSqlFile(filePath) {
    console.log(`Running ${path.basename(filePath)}...`);
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
        await pool.query(sql);
        console.log(`✅ Success`);
    } catch (error) {
        console.error(`❌ Error in ${path.basename(filePath)}:`);
        console.error(error.message);
        // Note: We continue even if error, as some scripts might be idempotent or fix previous issues
    }
}

async function migrate() {
    try {
        console.log('Starting migration...');

        // 1. Run Init Mock Supabase (Auth & Storage schemas)
        if (fs.existsSync(initScript)) {
            await runSqlFile(initScript);
        } else {
            console.error('init_mock_supabase.sql not found!');
        }

        // 2. Run Supabase Migrations
        if (fs.existsSync(migrationsDir)) {
            const files = fs.readdirSync(migrationsDir)
                .filter(file => file.endsWith('.sql'))
                .sort(); // Ensure order

            for (const file of files) {
                await runSqlFile(path.join(migrationsDir, file));
            }
        } else {
            console.log('No migrations folder found.');
        }

        console.log('Migration completed.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
