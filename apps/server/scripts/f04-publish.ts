/** F04 helper: publish/unpublish challenges (owner sign-off gate). Usage: npx tsx scripts/f04-publish.ts all|<slug> [--off] */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { createDb } from '../src/db/index.js';
import { challenges } from '../src/db/schema.js';

const target = process.argv[2];
const off = process.argv.includes('--off');
if (!target) throw new Error('usage: f04-publish.ts all|<slug> [--off]');

const db = createDb(process.env.DATABASE_URL!).db;

const rows =
  target === 'all'
    ? await db.select({ id: challenges.id, slug: challenges.slug }).from(challenges)
    : await db.select({ id: challenges.id, slug: challenges.slug }).from(challenges).where(eq(challenges.slug, target));

if (rows.length === 0) throw new Error(`no challenge matches: ${target}`);

for (const row of rows) {
  await db.update(challenges).set({ isPublished: !off, updatedAt: new Date() }).where(eq(challenges.id, row.id));
  console.log(`${row.slug}: ${off ? 'unpublished' : 'published'}`);
}
process.exit(0);
