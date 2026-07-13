// Quick migration runner - run with: node scripts/run-migration.js
// Set DATABASE_URL environment variable first

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set!');
    console.log('Set it with: set DATABASE_URL=your_supabase_url');
    process.exit(1);
  }

  console.log('🔌 Connecting to database...');

  try {
    await prisma.$connect();
    console.log('✅ Connected successfully!');
  } catch (e) {
    console.error('❌ Connection failed:', e.message);
    process.exit(1);
  }

  console.log('📦 Creating tables (prisma db push)...');

  // This creates/updates the schema
  const { execSync } = require('child_process');

  try {
    execSync('npx prisma db push --force-reset', {
      stdio: 'inherit',
      cwd: './packages/database'
    });
    console.log('✅ Tables created successfully!');
  } catch (e) {
    console.error('❌ Failed to create tables:', e.message);
  }

  await prisma.$disconnect();
}

main();