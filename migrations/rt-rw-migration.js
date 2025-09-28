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

        // Check if RW 01 already exists
        const [existingRw] = await connection.query(`
            SELECT id FROM \`rw\` WHERE \`nomor_rw\` = 'RW 01'
        `);

        if (existingRw.length === 0) {
            // Insert sample RW data
            await connection.query(`
                INSERT INTO \`rw\` (\`nomor_rw\`, \`ketua_rw\`) VALUES ('RW 01', 'Budi Santoso');
            `);
            console.log('✅ Inserted sample RW data');
        } else {
            console.log('RW 01 already exists, skipping INSERT');
        }

        // Check if rw_id column already exists in rt table
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = 'rt'
            AND COLUMN_NAME = 'rw_id'
        `, [process.env.DB_NAME]);

        if (columns.length === 0) {
            // Add rw_id column and foreign key
            await connection.query(`
                ALTER TABLE \`rt\`
                ADD COLUMN \`rw_id\` INT DEFAULT 1,
                ADD CONSTRAINT \`rt_ibfk_2\` FOREIGN KEY (\`rw_id\`) REFERENCES \`rw\` (\`id\`);
            `);
            console.log('✅ Added rw_id column and foreign key to rt table');
        } else {
            console.log('rw_id column already exists in rt table, skipping ALTER');
        }

        await connection.commit();
        console.log('✅ Migration completed successfully');

        const [rwCount] = await connection.query('SELECT COUNT(*) as total FROM rw');
        console.log(`📊 Total records in rw: ${rwCount[0].total}`);

        const [rtCount] = await connection.query('SELECT COUNT(*) as total FROM rt');
        console.log(`📊 Total records in rt: ${rtCount[0].total}`);

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
        console.log('✅ RT-RW migration script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ RT-RW migration failed:', error);
        process.exit(1);
    });