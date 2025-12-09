import type { Plugin } from "@opencode-ai/plugin";

const SCHEMA_FILES = [
	"packages/db/src/schema/customerSchema.ts",
	"packages/db/src/schema/globalSchema.ts",
];

export const DbSchemaGuard: Plugin = async ({ directory }) => {
	const readSchemaFiles = new Set<string>();
	let currentSessionID: string | null = null;

	return {
		"tool.execute.before": async (input, output) => {
			// Reset state when session changes
			if (currentSessionID !== input.sessionID) {
				currentSessionID = input.sessionID;
				readSchemaFiles.clear();
			}

			if (input.tool === "query_db") {
				// Check if all schema files have been read
				const unreadSchemas = SCHEMA_FILES.filter(
					(schema) => !readSchemaFiles.has(schema),
				);

				if (unreadSchemas.length > 0) {
					throw new Error(
						`Expected database schema files to be read before executing query, but the following schema files have not been read: ${unreadSchemas.join(", ")}. Please read these files first using the read tool.`,
					);
				}
			}

			// Track when schema files are read
			if (input.tool === "read" && output.args?.filePath) {
				const relativePath = output.args.filePath.replace(`${directory}/`, "");
				if (SCHEMA_FILES.includes(relativePath)) {
					readSchemaFiles.add(relativePath);
				}
			}
		},
	};
};
