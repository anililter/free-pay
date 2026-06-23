const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env' });

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  
  const res = await client.execute("SELECT id, period, status, due_date FROM payments WHERE client_id = 25");
  console.log(JSON.stringify(res.rows, null, 2));
}

main().catch(console.error);
