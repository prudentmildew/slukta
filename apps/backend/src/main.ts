import { openDatabase } from "./database.js";

const dbPath = process.env.SLUKTA_DB_PATH ?? "data/poc.sqlite";
const db = openDatabase(dbPath);

console.log(`Database opened at ${dbPath}`);

process.on("SIGINT", () => {
	db.close();
	process.exit(0);
});
