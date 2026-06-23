const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env' });

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  
  console.log("Wiping vault_transactions table...");
  await client.execute("DELETE FROM vault_transactions");
  console.log("Done wiping.");
}
main().catch(console.error);
