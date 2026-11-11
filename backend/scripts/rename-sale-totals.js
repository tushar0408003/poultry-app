/**
 * One-time migration: renames the sale payment cache fields
 *   cashPaidPaise -> cashPaid, onlinePaidPaise -> onlinePaid,
 *   totalPaidPaise -> totalPaid, remainingPaise -> remaining
 * converts weightGrams -> weight (kg, a double), drops the old ratePaise field (sales now store only weight + total price),
 * and replaces the old remainingPaise index. Values stay in integer paise.
 *
 *   node scripts/rename-sale-totals.js                     # uses MONGODB_URI
 *   node scripts/rename-sale-totals.js mongodb://127.0.0.1:27017/supplier_ledger
 *
 * Run with the API stopped. Safe to run more than once.
 */
const { MongoClient } = require('mongoose').mongo;

const uri = process.argv[2] ?? process.env.MONGODB_URI;
if (!uri) throw new Error('Pass the Mongo URI or set MONGODB_URI');

(async () => {
  const client = await MongoClient.connect(uri);
  try {
    const sales = client.db().collection('sales');
    const res = await sales.updateMany(
      { $or: [{ remainingPaise: { $exists: true } }, { ratePaise: { $exists: true } }] },
      {
        $unset: { ratePaise: '' },
        $rename: {
          cashPaidPaise: 'cashPaid',
          onlinePaidPaise: 'onlinePaid',
          totalPaidPaise: 'totalPaid',
          remainingPaise: 'remaining',
        },
      },
    );
    console.log(`Renamed fields on ${res.modifiedCount} sale(s)`);
    const kg = await sales.updateMany({ weightGrams: { $exists: true } }, [
      { $set: { weight: { $divide: ['$weightGrams', 1000] } } },
      { $unset: 'weightGrams' },
    ]);
    console.log(`Converted weight to kg on ${kg.modifiedCount} sale(s)`);
    if (await sales.indexExists('remainingPaise_1')) await sales.dropIndex('remainingPaise_1');
    await sales.createIndex({ remaining: 1 });
    console.log('Index remaining_1 ready');
  } finally {
    await client.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
