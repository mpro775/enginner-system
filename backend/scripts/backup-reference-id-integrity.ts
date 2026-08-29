import { spawnSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { MongoClient } from "mongodb";
import {
  getMongoUri,
  MACHINE_COLLECTION,
  REQUEST_COLLECTION,
} from "./reference-id-integrity.shared";

async function main() {
  const uri = getMongoUri();
  const client = new MongoClient(uri);
  await client.connect();
  const database = client.db().databaseName;
  await client.close();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = resolve(
    __dirname,
    "../../backups/reference-id-integrity",
    timestamp,
  );
  mkdirSync(backupRoot, { recursive: true });

  for (const collection of [REQUEST_COLLECTION, MACHINE_COLLECTION]) {
    const result = spawnSync(
      "mongodump",
      [
        `--uri=${uri}`,
        `--db=${database}`,
        `--collection=${collection}`,
        `--out=${backupRoot}`,
        "--gzip",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    if (result.status !== 0) {
      throw new Error(
        `mongodump failed for ${collection}: ${result.stderr || result.stdout}`,
      );
    }
  }

  const expectedFiles = [
    resolve(backupRoot, database, `${REQUEST_COLLECTION}.bson.gz`),
    resolve(backupRoot, database, `${MACHINE_COLLECTION}.bson.gz`),
  ];
  if (!expectedFiles.every(existsSync)) {
    throw new Error(
      "mongodump completed but expected collection backups are missing",
    );
  }

  const manifest = {
    database,
    backupTimestamp: new Date().toISOString(),
    backupMethod: "mongodump --gzip",
    collections: [REQUEST_COLLECTION, MACHINE_COLLECTION],
    backupPath: backupRoot,
  };
  const manifestPath = resolve(backupRoot, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log("REFERENCE ID BACKUP COMPLETE");
  console.log(`Database: ${database}`);
  console.log(`Collections: ${manifest.collections.join(", ")}`);
  console.log(`Backup path: ${backupRoot}`);
  console.log(`Manifest: ${manifestPath}`);
}

main().catch((error) => {
  console.error("Reference ID backup failed:", error);
  process.exitCode = 1;
});
