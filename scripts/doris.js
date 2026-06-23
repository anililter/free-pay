const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env' });

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  
  const res = await client.execute("SELECT * FROM payments WHERE client_id IN (54, 68)");
  console.log(JSON.stringify(res.rows, null, 2));
}

main().catch(console.error);
