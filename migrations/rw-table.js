const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            multipleStatements: true
        });

        console.log('Connected to database');
        await connection.beginTransaction();

        // Check if table already exists
        const [tables] = await connection.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME = 'rw'
        `, [process.env.DB_NAME]);

        if (tables.length > 0) {
            console.log('Table rw already exists, skipping migration');
            await connection.commit();
            return;
        }

        // Create table
        await connection.query(`
            CREATE TABLE \`rw\` (
              \`id\` int NOT NULL AUTO_INCREMENT,
              \`nomor_rw\` varchar(10) NOT NULL,
              \`ketua_rw\` varchar(100) NOT NULL,
              \`keterangan\` varchar(100) DEFAULT NULL,
              \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              UNIQUE KEY \`nomor_rw\` (\`nomor_rw\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        console.log('✅ Created rw table');

        await connection.commit();
        console.log('✅ Migration completed successfully');

        const [count] = await connection.query('SELECT COUNT(*) as total FROM rw');
        console.log(`📊 Total records in rw: ${count[0].total}`);

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('❌ Error during migration:', error);
        console.error('Stack trace:', error.stack);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed');
        }
    }
}

runMigration()
    .then(() => {
        console.log('✅ RW migration script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ RW migration failed:', error);
        process.exit(1);
    });
