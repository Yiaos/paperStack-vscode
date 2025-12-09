#!/usr/bin/env bun
import { enrich_profile } from "../../packages/dev-tools/src/enrich-profile-tool";
export { enrich_profile as default };

// CLI entry point
if (import.meta.main) {
	const cliArgs = process.argv.slice(2);

	if (cliArgs.length === 0) {
		console.error(
			'Usage: enrich_profile.ts <linkedin_url> [--detail-level <minimal|standard|full>]\nExample: enrich_profile.ts "linkedin.com/in/seanthorne" --detail-level minimal',
		);
		process.exit(1);
	}

	const linkedin_url = cliArgs[0]!;
	let detail_level: "minimal" | "standard" | "full" = "minimal";

	const detailIndex = cliArgs.indexOf("--detail-level");
	if (detailIndex !== -1 && cliArgs[detailIndex + 1]) {
		const detailValue = cliArgs[detailIndex + 1]!;
		if (
			detailValue !== "minimal" &&
			detailValue !== "standard" &&
			detailValue !== "full"
		) {
			console.error(
				"Invalid detail-level. Must be 'minimal', 'standard', or 'full'",
			);
			process.exit(1);
		}
		detail_level = detailValue;
	}

	const result = await enrich_profile.execute(
		{ linkedin_url, detail_level },
		{} as any,
	);
	console.log(result);
}
