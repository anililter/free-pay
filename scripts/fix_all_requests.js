const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env' });

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  
  // 1. Delete pending payments to fix net30 offsets
  const fixClients = [13, 25, 52, 29, 47, 40, 51, 61, 38];
  await client.execute(`DELETE FROM payments WHERE client_id IN (${fixClients.join(',')}) AND status = 'pending'`);
  console.log('Fixed net30 offsets');

  // 2. Merge Tatil Lideri (62) to Urla Gezi Fırsatı (38)
  await client.execute("UPDATE payments SET client_id = 38 WHERE client_id = 62");
  await client.execute("DELETE FROM clients WHERE id = 62");
  await client.execute("UPDATE clients SET name = 'Urla Gezi Fırsatı' WHERE id = 38");
  console.log('Merged Tatil Lideri & Urla Gezi Fırsatı');

  // 3. Fix Doris (54 and 68)
  await client.execute("DELETE FROM payments WHERE client_id = 54");
  await client.execute("DELETE FROM clients WHERE id = 54");
  await client.execute("UPDATE clients SET start_date = '2026-02-02' WHERE id = 68");
  console.log('Fixed Doris');

  // 4. Selda Center (58)
  await client.execute("UPDATE clients SET status = 'aktif', end_date = '2026-05-21' WHERE id = 58");
  await client.execute(`
    INSERT INTO payments (client_id, period, amount, currency, status, due_date, expected_amount, period_notes, account_info)
    VALUES (58, '2026-05', 17500, 'TRY', 'pending', '2026-05-21', 17500, '21 günlük son ödeme', 'Banka Hesabı')
  `);
  console.log('Fixed Selda Center');
}

main().catch(console.error);
