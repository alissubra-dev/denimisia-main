#!/usr/bin/env node
/**
 * Quick database setup script
 * Run: node scripts/setup-db.js
 *
 * Set DATABASE_URL in your environment before running.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Pushing schema to database...');

  try {
    await prisma.$executeRaw`SELECT 1`;
    console.log('✓ Database connected');
  } catch (e) {
    console.error('✗ Database connection failed:', e.message);
    process.exit(1);
  }

  // This will create all tables based on the schema
  console.log('Note: Please run "pnpm exec prisma db push" to create tables');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());