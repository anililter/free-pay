const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env' });

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  
  const activeClients = (await client.execute("SELECT * FROM clients WHERE status != 'pasif' AND (name LIKE '%Duygu%' OR name LIKE '%Turna%')")).rows;
  
  const period = '2026-07';
  for (const c of activeClients) {
    let [y, m] = period.split('-').map(Number);
    if (c.payment_type === 'net30') {
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    const last = new Date(y, m, 0).getDate();
    const day = Math.min(c.payment_day, last);
    const dueDate = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    console.log(`Client: ${c.name}, payment_day: ${c.payment_day}, payment_type: ${c.payment_type}, dueDate: ${dueDate}`);
  }
}

main().catch(console.error);
