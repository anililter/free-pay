const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env' });

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  
  await client.execute("UPDATE payments SET due_date = '2026-07-25' WHERE client_id IN (39, 43) AND period = '2026-06'");
  console.log('Fixed due dates for 2026-06 to be 2026-07-25.');
}

main().catch(console.error);
