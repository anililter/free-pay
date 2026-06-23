const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env' });

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  
  const res = await client.execute("SELECT id, name FROM clients WHERE LOWER(name) LIKE '%buse%' OR LOWER(name) LIKE '%ali%' OR LOWER(name) LIKE '%safa%'");
  console.log(JSON.stringify(res.rows, null, 2));
}

main().catch(console.error);
