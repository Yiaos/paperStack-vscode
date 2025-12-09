#!/usr/bin/env bun
import { web_search } from "../../packages/dev-tools/src/web-search-tool.ts";
export { web_search as default };

// CLI entry point
if (import.meta.main) {
	const cliArgs = process.argv.slice(2);

	if (cliArgs.length === 0) {
		console.error(
			"Usage: web_search.ts <query> [--num-results <number>]\nExample: web_search.ts 'latest TypeScript release' --num-results 5",
		);
		process.exit(1);
	}

	const query = cliArgs[0]!;
	let num_results = 5;

	const numIndex = cliArgs.indexOf("--num-results");
	if (numIndex !== -1 && cliArgs[numIndex + 1]) {
		num_results = parseInt(cliArgs[numIndex + 1]!, 10);
		if (isNaN(num_results)) {
			console.error("Invalid num-results value");
			process.exit(1);
		}
	}

	const result = await web_search.execute({ query, num_results }, {} as any);
	console.log(result);
}
