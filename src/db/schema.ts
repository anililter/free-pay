import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const clients = sqliteTable('clients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  projectName: text('project_name').notNull(),
  agreedAmount: real('agreed_amount').notNull(),
  currency: text('currency').notNull().default('TRY'),
  paymentDay: integer('payment_day').notNull(),
  paymentType: text('payment_type').notNull().default('upfront'),
  accountInfo: text('account_info').notNull(),
  status: text('status').notNull().default('aktif'),
  agreementDate: text('agreement_date').notNull(),
  startDate: text('start_date').notNull(),
  notes: text('notes'),
  source: text('source').notNull().default('Meta'),
  referredById: integer('referred_by_id'),
  gracePeriodDays: integer('grace_period_days').notNull().default(5),
  endDate: text('end_date'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: integer('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  period: text('period').notNull(),
  expectedAmount: real('expected_amount'),
  amount: real('amount').notNull(),
  currency: text('currency').notNull(),
  status: text('status').notNull().default('pending'),
  paidDate: text('paid_date'),
  periodNotes: text('period_notes'),
  dueDate: text('due_date').notNull(),
  accountInfo: text('account_info'),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});

export const withdrawals = sqliteTable('withdrawals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accountName: text('account_name').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('TRY'),
  date: text('date').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});
