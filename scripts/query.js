const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env' });

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  
  const res = await client.execute("SELECT id, name, status, start_date, end_date FROM clients WHERE name LIKE '%Duygu Sönmez%' OR name LIKE '%Turna%'");
  console.log(JSON.stringify(res.rows, null, 2));
}

main().catch(console.error);
