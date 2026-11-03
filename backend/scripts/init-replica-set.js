/**
 * One-time helper: turns a MongoDB server started with `replication.replSetName: rs0`
 * into a working single-node replica set (enables transactions).
 *
 *   node scripts/init-replica-set.js                       # localhost:27017
 *   node scripts/init-replica-set.js 127.0.0.1:27017 rs0
 *
 * Safe to run more than once.
 */
const { MongoClient } = require('mongodb');

const host = process.argv[2] ?? '127.0.0.1:27017';
const setName = process.argv[3] ?? 'rs0';

(async () => {
  const client = new MongoClient(`mongodb://${host}/?directConnection=true`, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const admin = client.db('admin');
    try {
      await admin.command({ replSetInitiate: { _id: setName, members: [{ _id: 0, host }] } });
      console.log(`Initiated replica set "${setName}" on ${host}`);
    } catch (e) {
      if (e.codeName === 'AlreadyInitialized') console.log('Replica set already initiated');
      else if (e.codeName === 'NoReplicationEnabled') {
        console.error('This server was not started with a replica set name. Add to mongod.cfg:\n\nreplication:\n  replSetName: rs0\n\nthen restart MongoDB and run this script again.');
        process.exitCode = 1;
        return;
      } else throw e;
    }
    for (let i = 0; i < 30; i++) {
      const hello = await admin.command({ hello: 1 });
      if (hello.isWritablePrimary) {
        console.log(`Ready. Use: MONGODB_URI=mongodb://${host}/supplier_ledger?replicaSet=${hello.setName}`);
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    console.error('Timed out waiting for the node to become primary');
    process.exitCode = 1;
  } finally {
    await client.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
