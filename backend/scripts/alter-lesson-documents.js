import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set in the environment.');
}

const url = new URL(databaseUrl);
const dbName = url.pathname.replace(/^\//, '');

const port = url.port ? parseInt(url.port, 10) : 3306;
const user = decodeURIComponent(url.username || '');
const password = decodeURIComponent(url.password || '');

const connection = await mysql.createConnection({
  host: url.hostname,
  port,
  user,
  password,
  database: dbName,
});

try {
  console.log(`Altering table course_lessons in ${dbName}...`);
  await connection.query(`ALTER TABLE course_lessons ADD COLUMN documents JSON NULL;`);
  console.log('Successfully added documents column.');
} catch (e) {
  if (e.code === 'ER_DUP_FIELDNAME') {
    console.log('Column already exists.');
  } else {
    console.error('Migration failed:');
    console.error(e);
  }
} finally {
  await connection.end();
}
