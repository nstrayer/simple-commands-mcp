/**
 * File-based logging for MCP server
 * IMPORTANT: Never log to stdout/stderr as it breaks the MCP protocol
 */

import winston from 'winston';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure the logger to write to a file
const logFile = path.join(__dirname, '..', 'server.log');

export const logger = winston.createLogger({
	level: 'debug',
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.errors({ stack: true }),
		winston.format.printf(({ timestamp, level, message, stack }) => {
			if (stack) {
				return `${timestamp} - ${level.toUpperCase()} - ${message}\n${stack}`;
			}
			return `${timestamp} - ${level.toUpperCase()} - ${message}`;
		})
	),
	transports: [
		new winston.transports.File({ filename: logFile })
	]
});

// Log separator for new sessions
export function logSessionStart(): void {
	logger.info('='.repeat(50));
	logger.info(`Starting Positron Dev Tools MCP Server at ${new Date().toISOString()}`);
	logger.info('='.repeat(50));
}