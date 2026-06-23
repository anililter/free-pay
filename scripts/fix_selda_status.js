const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env' });

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  
  await client.execute("UPDATE payments SET status = 'pending', amount = 0 WHERE client_id = 58 AND period = '2026-05'");
  console.log('Fixed Selda Center status');
}

main().catch(console.error);
