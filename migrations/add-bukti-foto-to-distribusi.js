/**
 * Migration: Add bukti_foto column to distribusi_zakat table
 * Created: 2026-01-19
 * Description: Menambahkan kolom bukti_foto untuk menyimpan path/URL foto bukti distribusi
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'zakat'
  });

  try {
    console.log('🚀 Starting migration: Add bukti_foto column to distribusi_zakat table...');

    // Check if column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'distribusi_zakat' 
      AND COLUMN_NAME = 'bukti_foto'
    `, [process.env.DB_NAME || 'zakat']);

    if (columns.length > 0) {
      console.log('⚠️  Column bukti_foto already exists. Skipping migration.');
      return;
    }

    // Add bukti_foto column after status column
    await connection.execute(`
      ALTER TABLE distribusi_zakat 
      ADD COLUMN bukti_foto VARCHAR(255) NULL 
      AFTER status
    `);

    console.log('✅ Successfully added bukti_foto column to distribusi_zakat table');
    console.log('📝 Column details:');
    console.log('   - Name: bukti_foto');
    console.log('   - Type: VARCHAR(255)');
    console.log('   - Default: NULL');
    console.log('   - Position: After status column');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

// Rollback function
async function rollbackMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'zakat'
  });

  try {
    console.log('🔄 Rolling back migration: Remove bukti_foto column...');

    // Check if column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'distribusi_zakat' 
      AND COLUMN_NAME = 'bukti_foto'
    `, [process.env.DB_NAME || 'zakat']);

    if (columns.length === 0) {
      console.log('⚠️  Column bukti_foto does not exist. Nothing to rollback.');
      return;
    }

    // Remove bukti_foto column
    await connection.execute(`
      ALTER TABLE distribusi_zakat 
      DROP COLUMN bukti_foto
    `);

    console.log('✅ Successfully removed bukti_foto column from distribusi_zakat table');

  } catch (error) {
    console.error('❌ Rollback failed:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run migration or rollback based on command line argument
const args = process.argv.slice(2);
const isRollback = args.includes('--rollback');

if (isRollback) {
  rollbackMigration()
    .then(() => {
      console.log('✅ Rollback completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Rollback failed:', error);
      process.exit(1);
    });
} else {
  runMigration()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration, rollbackMigration };
