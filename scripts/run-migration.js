// Quick migration runner - run with: node scripts/run-migration.js
// This adds courier fields to the Order table

const { Client } = require('pg');

async function main() {
  const connStr = 'postgresql://postgres:*Denimisia*@db.osrmngoqdsmgbqrluare.supabase.co:5432/postgres?sslmode=require';
  const client = new Client(connStr);

  await client.connect();

  try {
    // Add new columns to Order table
    await client.query(`
      ALTER TABLE "Order"
      ADD COLUMN IF NOT EXISTS courier TEXT,
      ADD COLUMN IF NOT EXISTS "consignmentId" TEXT,
      ADD COLUMN IF NOT EXISTS "deliveryStatus" TEXT;
    `);
    console.log('✅ Migration completed successfully');
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️ Columns already exist');
    } else {
      console.error('❌ Migration failed:', error.message);
    }
  } finally {
    await client.end();
  }
}

main();