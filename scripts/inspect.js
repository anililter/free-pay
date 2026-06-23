const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env' });

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  
  const names = [
    'Sonax', 'Köksal Yüca', 'Tatil Lideri', 'Urla Gezi Fırsatı',
    'buse genç', 'Abdurrahman Kendirci', 'Xoom', 'ali safa sayım',
    'academy', 'Defence', 'Doris'
  ];
  
  for (const name of names) {
    const res = await client.execute({
      sql: "SELECT id, name, status, payment_type, start_date FROM clients WHERE name LIKE ?",
      args: [`%${name}%`]
    });
    console.log(`-- ${name} --`);
    console.log(JSON.stringify(res.rows, null, 2));
  }
}

main().catch(console.error);
