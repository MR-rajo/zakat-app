/**
 * Migration: Add master_zakat table and update muzakki table
 * 
 * Creates:
 * - master_zakat table with fields: id, nama, harga, kg, created_at, updated_at, created_by, updated_by
 * - Adds master_zakat_id field to muzakki table
 * 
 * Usage:
 * Run this migration using your database client or migration tool
 */

const mysql = require('mysql2/promise');

// Database configuration - adjust according to your setup
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'zakat',
  multipleStatements: true
};

async function up() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🚀 Starting migration: Add master_zakat table and update muzakki table');
    
    // Start transaction
    await connection.beginTransaction();
    
    // 1. Create master_zakat table
    console.log('📋 Creating master_zakat table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS master_zakat (
        id INT PRIMARY KEY AUTO_INCREMENT,
        nama VARCHAR(100) NOT NULL COMMENT 'Nama jenis zakat (contoh: Beras Premium, Uang Standar)',
        harga DECIMAL(15, 2) NOT NULL DEFAULT 0 COMMENT 'Harga per satuan dalam Rupiah',
        kg DECIMAL(10, 2) NOT NULL DEFAULT 0 COMMENT 'Jumlah dalam kilogram (bisa desimal, contoh: 2.5, 3.5)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu data dibuat',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Waktu data terakhir diupdate',
        created_by INT NULL COMMENT 'User yang membuat data',
        updated_by INT NULL COMMENT 'User yang terakhir mengupdate data',
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
        INDEX idx_nama (nama),
        INDEX idx_created_by (created_by),
        INDEX idx_updated_by (updated_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Master data jenis zakat fitrah';
    `);
    console.log('✅ master_zakat table created successfully');
    
    // 2. Insert default data for master_zakat
    console.log('📝 Inserting default master_zakat data...');
    await connection.query(`
      INSERT INTO master_zakat (nama, harga, kg, created_by, updated_by) VALUES
      ('Beras Standar', 45000, 2.5, 1, 1),
      ('Uang Standar', 45000, 0, 1, 1)
      ON DUPLICATE KEY UPDATE nama = nama;
    `);
    console.log('✅ Default master_zakat data inserted');
    
    // 3. Check if master_zakat_id column already exists in muzakki table
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'muzakki' 
      AND COLUMN_NAME = 'master_zakat_id'
    `, [dbConfig.database]);
    
    if (columns.length === 0) {
      // 4. Add master_zakat_id column to muzakki table
      console.log('📋 Adding master_zakat_id column to muzakki table...');
      await connection.query(`
        ALTER TABLE muzakki
        ADD COLUMN master_zakat_id INT NULL COMMENT 'Relasi ke master_zakat untuk jenis zakat yang dipilih' AFTER jenis_zakat,
        ADD FOREIGN KEY (master_zakat_id) REFERENCES master_zakat(id) ON DELETE SET NULL ON UPDATE CASCADE,
        ADD INDEX idx_master_zakat_id (master_zakat_id);
      `);
      console.log('✅ master_zakat_id column added to muzakki table');
    } else {
      console.log('ℹ️  master_zakat_id column already exists in muzakki table, skipping...');
    }
    
    // 5. Update existing muzakki records to link with master_zakat (optional)
    console.log('🔄 Updating existing muzakki records with master_zakat_id...');
    
    // Update records with jenis_zakat = 'beras' to link with 'Beras Standar'
    await connection.query(`
      UPDATE muzakki 
      SET master_zakat_id = (SELECT id FROM master_zakat WHERE nama = 'Beras Standar' LIMIT 1)
      WHERE jenis_zakat = 'beras' AND master_zakat_id IS NULL;
    `);
    
    // Update records with jenis_zakat = 'uang' to link with 'Uang Standar'
    await connection.query(`
      UPDATE muzakki 
      SET master_zakat_id = (SELECT id FROM master_zakat WHERE nama = 'Uang Standar' LIMIT 1)
      WHERE jenis_zakat = 'uang' AND master_zakat_id IS NULL;
    `);
    console.log('✅ Existing muzakki records updated');
    
    // Commit transaction
    await connection.commit();
    
    console.log('');
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log('   ✓ master_zakat table created');
    console.log('   ✓ Default master_zakat data inserted');
    console.log('   ✓ master_zakat_id column added to muzakki table');
    console.log('   ✓ Existing muzakki records updated with master_zakat_id');
    console.log('');
    
  } catch (error) {
    // Rollback on error
    if (connection) {
      await connection.rollback();
    }
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    // Close connection
    if (connection) {
      await connection.end();
    }
  }
}

async function down() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🔄 Rolling back migration: Add master_zakat table and update muzakki table');
    
    // Start transaction
    await connection.beginTransaction();
    
    // 1. Remove master_zakat_id column from muzakki table
    console.log('📋 Removing master_zakat_id column from muzakki table...');
    
    // First, drop the foreign key constraint
    const [constraints] = await connection.query(`
      SELECT CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'muzakki' 
      AND COLUMN_NAME = 'master_zakat_id' 
      AND REFERENCED_TABLE_NAME = 'master_zakat'
    `, [dbConfig.database]);
    
    if (constraints.length > 0) {
      const constraintName = constraints[0].CONSTRAINT_NAME;
      await connection.query(`ALTER TABLE muzakki DROP FOREIGN KEY ${constraintName}`);
      console.log('✅ Foreign key constraint dropped');
    }
    
    // Then drop the column
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'muzakki' 
      AND COLUMN_NAME = 'master_zakat_id'
    `, [dbConfig.database]);
    
    if (columns.length > 0) {
      await connection.query(`ALTER TABLE muzakki DROP COLUMN master_zakat_id`);
      console.log('✅ master_zakat_id column removed from muzakki table');
    }
    
    // 2. Drop master_zakat table
    console.log('📋 Dropping master_zakat table...');
    await connection.query(`DROP TABLE IF EXISTS master_zakat`);
    console.log('✅ master_zakat table dropped');
    
    // Commit transaction
    await connection.commit();
    
    console.log('');
    console.log('🎉 Rollback completed successfully!');
    console.log('');
    
  } catch (error) {
    // Rollback on error
    if (connection) {
      await connection.rollback();
    }
    console.error('❌ Rollback failed:', error.message);
    throw error;
  } finally {
    // Close connection
    if (connection) {
      await connection.end();
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'down' || command === 'rollback') {
    down()
      .then(() => process.exit(0))
      .catch(err => {
        console.error(err);
        process.exit(1);
      });
  } else {
    up()
      .then(() => process.exit(0))
      .catch(err => {
        console.error(err);
        process.exit(1);
      });
  }
}

module.exports = { up, down };
