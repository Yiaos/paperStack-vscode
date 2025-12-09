#!/usr/bin/env bun
import { tool } from "@opencode-ai/plugin";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Truncate string in the middle, preserving start and end
 */
function truncateMiddle(str: string, maxLength: number): string {
	if (str.length <= maxLength) return str;

	const charsToShow = maxLength - 30; // Reserve space for truncation message
	const prefixLength = Math.ceil(charsToShow / 2);
	const suffixLength = Math.floor(charsToShow / 2);
	const truncatedCount = str.length - charsToShow;

	return (
		str.slice(0, prefixLength) +
		` ... [${truncatedCount} chars truncated] ... ` +
		str.slice(-suffixLength)
	);
}

export default tool({
	description: `Query Google Cloud Platform logs for debugging and investigation.

This tool queries GCP logs using gcloud CLI to find relevant log entries. All logs are structured JSON with jsonPayload containing the log data.

Logs are stored in two main streams:
- projects/saffron-health/logs/api - API server logs
- projects/saffron-health/logs/browser-agent - Browser automation job logs

Common jsonPayload fields include: message, requestId, sessionId, userId, email, taskId, patientId, jobId, jobType, duration, error

WHEN TO USE THIS TOOL:
- When debugging production issues or errors
- When investigating user-reported problems
- When tracing request flows or task execution
- When analyzing performance issues or slow requests
- When finding logs related to specific entities (users, tasks, patients, jobs)

WHEN NOT TO USE THIS TOOL:
- When you need to modify code or fix bugs
- When searching the codebase for code patterns (use grep/glob)
- When you need to read local files (use read tool)

FILTER QUERY FORMAT:
Use GCP Logging filter syntax:
- Filter by log name: logName="projects/saffron-health/logs/api"
- Filter by timestamp: timestamp >= "2025-10-06T00:00:00Z"
- Filter by jsonPayload fields: jsonPayload.userId = "user-123"
- Filter by severity: severity = "ERROR"
- Combine filters with AND: logName="..." AND timestamp >= "..." AND jsonPayload.taskId="..."

SITUATIONS WHERE FILTERING BY SPECIFIC FIELDS IS HELPFUL:
- When looking for logs to see how the referral agent processed all the steps for a specific task, it's helpful to filter by the taskId
- When looking for more information about a specific browser agent job, it's helpful to filter by the jobId
- When there is an error in a Browser agent job, there will be a log with the message "Error artifacts for task execution failure" which is associated with that specific jobId. This log will contain gcloud storage links to screenshots, DOM snapshots, and error messages that can be used to debug the error.

EXAMPLES:

// Find all errors in the last hour from API logs
logName="projects/saffron-health/logs/api" AND severity="ERROR" AND timestamp >= "2025-10-06T14:00:00Z"

// Find logs for specific task
jsonPayload.taskId="task-123" AND timestamp >= "2025-10-06T00:00:00Z"

// Find logs for specific user
jsonPayload.email="user@example.com" AND timestamp >= "2025-10-06T00:00:00Z"

// Find logs for specific job type
logName="projects/saffron-health/logs/browser-agent" AND jsonPayload.jobType="pull-open-referrals" AND timestamp >= "2025-10-06T00:00:00Z"`,
	args: {
		filter: tool.schema
			.string()
			.describe(
				"GCP Logging filter query. Always include timestamp ranges for performance. Use logName, timestamp, jsonPayload.*, severity filters.",
			),
		limit: tool.schema
			.number()
			.default(50)
			.describe("Maximum number of log entries to return (default: 50)"),
	},
	async execute(args) {
		try {
			// Build gcloud command
			const cmd = [
				"gcloud",
				"logging",
				"read",
				`"${args.filter.replace(/"/g, '\\"')}"`,
				"--project=saffron-health",
				`--limit=${args.limit}`,
				"--format=json",
			].join(" ");

			const { stdout, stderr } = await execAsync(cmd);

			if (stderr) {
				return `Warning: ${stderr}\n\nOutput: ${stdout}`;
			}

			const entries = JSON.parse(stdout);

			if (!Array.isArray(entries) || entries.length === 0) {
				return "No log entries found matching the filter criteria.";
			}

			const formattedEntries = entries.map((entry: any) => {
				const timestamp = entry.timestamp || "";
				const severity = entry.severity || "INFO";
				const logName = entry.logName || "";

				// Format jsonPayload
				const jsonPayload = entry.jsonPayload || {};
				const payload = Object.entries(jsonPayload)
					.map(([key, value]) => {
						if (typeof value === "object" && value !== null) {
							return `${key}: ${JSON.stringify(value)}`;
						}
						return `${key}: ${value}`;
					})
					.join(" | ");

				// Short log name (last part after /)
				const shortLogName = logName.split("/").pop() || logName;

				let formattedEntry = `[${timestamp}] [${severity}] [${shortLogName}]\n${payload}`;

				// Truncate entire entry in the middle if too long
				if (formattedEntry.length > 3000) {
					formattedEntry = truncateMiddle(formattedEntry, 3000);
				}

				return formattedEntry;
			});

			let result = `Found ${entries.length} log entries:\n\n${formattedEntries.join("\n\n")}`;

			// Truncate final output in the middle if too long
			if (result.length > 50000) {
				result = truncateMiddle(result, 50000);
			}

			return result;
		} catch (error) {
			if (error instanceof Error) {
				return `Error querying logs: ${error.message}`;
			}
			return `Error querying logs: ${String(error)}`;
		}
	},
});

// CLI entry point
if (import.meta.main) {
	const cliArgs = process.argv.slice(2);

	if (cliArgs.length === 0) {
		console.error(
			'Usage: logs.ts <filter> [--limit <number>]\nExample: logs.ts \'logName="projects/saffron-health/logs/api" AND timestamp >= "2025-10-06T00:00:00Z"\' --limit 10',
		);
		process.exit(1);
	}

	const filter = cliArgs[0]!;
	let limit = 50;

	const limitIndex = cliArgs.indexOf("--limit");
	if (limitIndex !== -1 && cliArgs[limitIndex + 1]) {
		limit = parseInt(cliArgs[limitIndex + 1]!, 10);
		if (isNaN(limit)) {
			console.error("Invalid limit value");
			process.exit(1);
		}
	}

	const toolModule = await import("./logs.ts");
	const result = await toolModule.default.execute({ filter, limit }, {} as any);
	console.log(result);
}
