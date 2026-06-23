const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env' });

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  
  console.log("Creating vault_transactions table...");
  await client.execute(`
    CREATE TABLE IF NOT EXISTS vault_transactions (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      account_name text NOT NULL,
      type text NOT NULL,
      amount real NOT NULL,
      currency text DEFAULT 'TRY' NOT NULL,
      date text NOT NULL,
      description text,
      client_name text,
      payment_id integer,
      created_at text NOT NULL
    )
  `);

  console.log("Migrating withdrawals...");
  const existingWithdrawals = await client.execute("SELECT * FROM withdrawals");
  for (const w of existingWithdrawals.rows) {
    await client.execute({
      sql: "INSERT INTO vault_transactions (account_name, type, amount, currency, date, description, created_at) VALUES (?, 'expense', ?, ?, ?, ?, ?)",
      args: [w.account_name, w.amount, w.currency, w.date, w.notes || 'Para Çekimi', w.created_at]
    });
  }

  console.log("Migrating paid payments...");
  const paidPayments = await client.execute("SELECT p.id, p.client_id, p.amount, p.currency, p.paid_date, p.account_info, c.name as client_name FROM payments p JOIN clients c ON p.client_id = c.id WHERE p.status = 'paid' AND p.account_info IS NOT NULL AND p.account_info != ''");
  
  let migratedCount = 0;
  for (const p of paidPayments.rows) {
    const dateStr = p.paid_date || new Date().toISOString().split('T')[0];
    await client.execute({
      sql: "INSERT INTO vault_transactions (account_name, type, amount, currency, date, description, client_name, payment_id, created_at) VALUES (?, 'income', ?, ?, ?, ?, ?, ?, ?)",
      args: [p.account_info, p.amount, p.currency, dateStr, `Tahsilat: ${p.client_name}`, p.client_name, p.id, new Date().toISOString()]
    });
    migratedCount++;
  }
  
  console.log(`Migrated ${existingWithdrawals.rows.length} withdrawals and ${migratedCount} paid payments.`);

  console.log("Dropping withdrawals table...");
  await client.execute("DROP TABLE withdrawals");

  console.log("Done.");
}

main().catch(console.error);
