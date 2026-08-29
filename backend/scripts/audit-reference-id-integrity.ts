import { MongoClient } from "mongodb";
import {
  getMongoUri,
  printAudit,
  runAudit,
} from "./reference-id-integrity.shared";

async function main() {
  const client = new MongoClient(getMongoUri());
  await client.connect();
  try {
    const db = client.db();
    console.log(`Database: ${db.databaseName}`);
    console.log("Mode: READ ONLY\n");
    const results = await runAudit(db);
    printAudit(results);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Reference ID audit failed:", error);
  process.exitCode = 1;
});
