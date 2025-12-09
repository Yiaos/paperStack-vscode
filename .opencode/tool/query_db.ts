#!/usr/bin/env bun
import { query_db } from "../../packages/dev-tools/src/query-db-tool.ts";
export { query_db as default };

// CLI entry point
if (import.meta.main) {
	const cliArgs = process.argv.slice(2);

	if (cliArgs.length === 0) {
		console.error(
			'Usage: query_db.ts <sql_query> [--target <local|production>]\nExample: query_db.ts "SELECT * FROM referrals LIMIT 10" --target local',
		);
		process.exit(1);
	}

	const sql_query = cliArgs[0]!;
	let target_database: "local" | "production" = "local";

	const targetIndex = cliArgs.indexOf("--target");
	if (targetIndex !== -1 && cliArgs[targetIndex + 1]) {
		const targetValue = cliArgs[targetIndex + 1]!;
		if (targetValue !== "local" && targetValue !== "production") {
			console.error(
				"Invalid target. Must be 'local' or 'production'",
			);
			process.exit(1);
		}
		target_database = targetValue;
	}

	const result = await query_db.execute({ sql_query, target_database }, {} as any);
	console.log(result);
}
