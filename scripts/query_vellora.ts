import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { db } from '../src/db/index';
import { clients } from '../src/db/schema';
import { like } from 'drizzle-orm';

async function main() {
  const vellora = await db.select().from(clients).where(like(clients.name, '%Vellora%'));
  console.log(vellora);
}
main();
