/**
 * Restores a dump made by scripts/backup.js.
 *
 *   node scripts/restore.js <dumpDir>            # into MONGODB_URI; refuses if any target collection has data
 *   node scripts/restore.js <dumpDir> --drop     # replaces those collections (DESTROYS current data in them)
 *
 * Tip: point MONGODB_URI at a new database name first (…/khata_restore) to inspect a backup safely.
 * Start the API afterwards so Mongoose recreates the indexes.
 */
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { MongoClient, BSON } = require('mongoose').mongo;

const uri = process.env.MONGODB_URI;
const dir = process.argv[2];
const drop = process.argv.includes('--drop');
if (!uri) throw new Error('Set MONGODB_URI');
if (!dir || dir.startsWith('--')) throw new Error('Usage: node scripts/restore.js <dumpDir> [--drop]');

const BATCH = 1000;

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const names = Object.keys(manifest.counts);
  const client = await MongoClient.connect(uri);
  try {
    const db = client.db();
    // Check everything before touching anything, so a refusal leaves the database untouched.
    const nonEmpty = [];
    for (const name of names) if (await db.collection(name).estimatedDocumentCount()) nonEmpty.push(name);
    if (nonEmpty.length && !drop) {
      throw new Error(`Database "${db.databaseName}" already has data in: ${nonEmpty.join(', ')}. Re-run with --drop to replace it.`);
    }

    for (const name of names) {
      const col = db.collection(name);
      if (drop) await col.deleteMany({});
      const lines = readline.createInterface({ input: fs.createReadStream(path.join(dir, `${name}.ndjson`)), crlfDelay: Infinity });
      let batch = [];
      let n = 0;
      for await (const line of lines) {
        if (!line) continue;
        batch.push(BSON.EJSON.parse(line, { relaxed: false }));
        if (batch.length === BATCH) {
          await col.insertMany(batch, { ordered: true });
          n += batch.length;
          batch = [];
        }
      }
      if (batch.length) await col.insertMany(batch, { ordered: true });
      n += batch.length;
      if (n !== manifest.counts[name]) throw new Error(`${name}: restored ${n} but backup lists ${manifest.counts[name]}`);
      console.log(`${name}: ${n}`);
    }
    console.log(`Restored backup from ${manifest.createdAt} into ${db.databaseName}`);
  } finally {
    await client.close();
  }
})().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
