import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set in the environment.');
}

const url = new URL(databaseUrl);
const dbName = url.pathname.replace(/^\//, '');

if (!dbName) {
  throw new Error('DATABASE_URL must include a database name.');
}

const port = url.port ? parseInt(url.port, 10) : 3306;
const user = decodeURIComponent(url.username || '');
const password = decodeURIComponent(url.password || '');

const schemaPath = path.resolve(process.cwd(), 'db', 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

const connection = await mysql.createConnection({
  host: url.hostname,
  port,
  user,
  password,
  multipleStatements: true,
});

try {
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await connection.query(`USE \`${dbName}\``);
  await connection.query(schemaSql);
  console.log(`Database schema initialized for ${dbName}.`);
} finally {
  await connection.end();
}
