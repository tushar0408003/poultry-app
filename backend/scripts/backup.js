/**
 * Dumps every collection of the database to <outDir>/<collection>.ndjson
 * (one Extended-JSON document per line, so ObjectIds, Dates and Decimals keep their types)
 * plus manifest.json with document counts. Read-only: never modifies the database.
 *
 *   node scripts/backup.js                 # uses MONGODB_URI, writes ./backup-<date>
 *   node scripts/backup.js dump            # writes ./dump
 *
 * Restore with scripts/restore.js. Indexes are not dumped: Mongoose recreates them on API start.
 */
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { MongoClient, BSON } = require('mongoose').mongo;

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI');
const outDir = path.resolve(process.argv[2] ?? `backup-${new Date().toISOString().slice(0, 10)}`);

(async () => {
  const client = await MongoClient.connect(uri);
  try {
    const db = client.db();
    fs.mkdirSync(outDir, { recursive: true });
    const counts = {};
    for (const { name } of await db.listCollections({ type: 'collection' }, { nameOnly: true }).toArray()) {
      if (name.startsWith('system.')) continue;
      const out = fs.createWriteStream(path.join(outDir, `${name}.ndjson`));
      let n = 0;
      for await (const doc of db.collection(name).find()) {
        if (!out.write(BSON.EJSON.stringify(doc, { relaxed: false }) + '\n')) await once(out, 'drain');
        n++;
      }
      out.end();
      await once(out, 'finish');
      counts[name] = n;
    }
    const manifest = { database: db.databaseName, createdAt: new Date().toISOString(), counts };
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(`Backed up ${db.databaseName} to ${outDir}`, counts);
  } finally {
    await client.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
