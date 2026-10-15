
"use strict";

// Run BookMySeat database scripts using the SAME
// MongoDB connection settings as backend/server.js.
//
// Usage:
// node runWithAppDatabase.js setupFiveCinemas
// node runWithAppDatabase.js setupFiveCinemas --apply
// node runWithAppDatabase.js cinemaPlan

require("dotenv").config();

const path = require("path");

const allowedScripts = [
  "setupFiveCinemas",
  "cinemaPlan",
];

const scriptName = process.argv[2];

if (!allowedScripts.includes(scriptName)) {
  console.error("Invalid script name.");
  process.exit(1);
}

const mongoUrl = process.env.MONGO_URL;
const dbName = process.env.DB_NAME;

if (!mongoUrl || !dbName) {
  console.error(
    "MONGO_URL or DB_NAME is missing. Nothing changed."
  );
  process.exit(1);
}

// Match the connection format used by server.js.
// This takes priority over the older script settings.
process.env.MONGO_URI =
  `${mongoUrl.replace(/\/$/, "")}/${dbName}`;

console.log(`Application database: ${dbName}`);
console.log(`Running: ${scriptName}`);

const scriptPath = path.join(
  __dirname,
  `${scriptName}.js`
);

// Preserve --apply when explicitly requested.
process.argv = [
  process.argv[0],
  scriptPath,
  ...process.argv.slice(3),
];

require(scriptPath);
