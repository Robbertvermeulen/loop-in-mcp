import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';

const url = process.env.DATABASE_URL ?? 'file:./loop.db';
const authToken = process.env.DATABASE_AUTH_TOKEN;
const client = createClient(authToken ? { url, authToken } : { url });
const db = drizzle(client);

await migrate(db, { migrationsFolder: './migrations' });
console.log('Migrations applied.');
