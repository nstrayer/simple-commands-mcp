/**
 * Command execution logic for tools
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolConfig } from './types.js';
import { processManager } from './processManager.js';
import { logger } from './logger.js';

const execAsync = promisify(exec);

export class ToolExecutor {
	private projectRoot: string;

	constructor(projectRoot: string) {
		this.projectRoot = projectRoot;
	}

	/**
	 * Execute a tool based on its configuration
	 */
	async executeTool(toolConfig: ToolConfig | null, toolName: string, args?: any): Promise<{ success: boolean; output: string }> {
		// Handle auto-generated control tools
		if (!toolConfig) {
			// Check if this is an auto-generated tool
			if (toolName.endsWith('_start')) {
				// This shouldn't happen as _start tools should have config
				return {
					success: false,
					output: `Configuration not found for tool: ${toolName}`
				};
			} else if (toolName.endsWith('_status')) {
				const daemonName = toolName.replace('_status', '');
				return this.getProcessStatus(daemonName);
			} else if (toolName.endsWith('_stop')) {
				const daemonName = toolName.replace('_stop', '');
				const result = processManager.stopDaemon(daemonName);
				return {
					success: result.success,
					output: result.message
				};
			} else if (toolName.endsWith('_logs')) {
				const daemonName = toolName.replace('_logs', '');
				const lines = args?.lines || 50;
				return this.getProcessLogs(daemonName, lines);
			}
			
			return {
				success: false,
				output: `Unknown tool: ${toolName}`
			};
		}

		const { name, command, daemon = false } = toolConfig;

		// For daemon tools called with _start suffix, use the base name
		const processName = toolName.endsWith('_start') ? toolName.replace('_start', '') : name;

		logger.info(`Executing tool: ${processName}, daemon: ${daemon}, command: ${command}`);

		try {
			if (daemon) {
				// Start a daemon (using the base name for process tracking)
				const result = await processManager.startDaemon(processName, command, this.projectRoot);
				return {
					success: result.success,
					output: result.message
				};
			} else {
				// Run a regular command
				const result = await this.runCommand(command);
				return result;
			}
		} catch (error) {
			logger.error(`Error executing tool '${processName}': ${error}`, error);
			return {
				success: false,
				output: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	/**
	 * Get status of a specific daemon
	 */
	private getProcessStatus(daemonName: string): { success: boolean; output: string } {
		const status = processManager.getProcessStatus(daemonName);
		
		if (!status) {
			return {
				success: false,
				output: `Daemon '${daemonName}' is not running`
			};
		}

		let output = `Daemon: ${status.name}\n`;
		output += `Status: ${status.state}\n`;
		output += `PID: ${status.pid}\n`;
		output += `Uptime: ${status.uptime} seconds\n`;
		output += `Started: ${status.startTime.toISOString()}\n`;
		
		if (status.recentOutput && status.recentOutput.length > 0) {
			output += '\nRecent output:\n';
			output += status.recentOutput.join('\n');
		}

		return {
			success: true,
			output
		};
	}

	/**
	 * Get logs from a specific daemon
	 */
	private getProcessLogs(daemonName: string, lines: number): { success: boolean; output: string } {
		const logs = processManager.getProcessLogs(daemonName, lines);
		
		if (!logs) {
			return {
				success: false,
				output: `Daemon '${daemonName}' is not running or has no logs`
			};
		}

		let output = `=== Logs for ${daemonName} (last ${lines} lines) ===\n\n`;
		
		if (logs.stdout.length > 0) {
			output += '--- STDOUT ---\n';
			output += logs.stdout.join('\n');
			output += '\n\n';
		}
		
		if (logs.stderr.length > 0) {
			output += '--- STDERR ---\n';
			output += logs.stderr.join('\n');
			output += '\n';
		}
		
		if (logs.stdout.length === 0 && logs.stderr.length === 0) {
			output += 'No output captured yet.';
		}

		return {
			success: true,
			output
		};
	}

	/**
	 * Run a command and return its output
	 */
	private async runCommand(command: string): Promise<{ success: boolean; output: string }> {
		logger.debug(`Running command: ${command}`);

		try {
			const { stdout, stderr } = await execAsync(command, {
				cwd: this.projectRoot,
				maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
				timeout: 60000, // 60 second timeout
			});

			let output = stdout;
			if (stderr) {
				output += stderr ? `\nStderr:\n${stderr}` : '';
			}

			return {
				success: true,
				output: output || 'Command completed successfully'
			};
		} catch (error: any) {
			logger.warning(`Command failed: ${error.message}`);

			// Even if command fails, we might have useful output
			let output = '';
			if (error.stdout) {
				output += error.stdout;
			}
			if (error.stderr) {
				output += output ? `\n${error.stderr}` : error.stderr;
			}
			if (error.code !== undefined) {
				output = `Command failed with exit code ${error.code}:\n${output}`;
			}

			return {
				success: false,
				output: output || `Failed to run command: ${error.message}`
			};
		}
	}

	/**
	 * Get status of running daemons
	 */
	getDaemonStatus(): string {
		const daemons = processManager.getRunningDaemons();
		if (daemons.length === 0) {
			return 'No daemons are currently running';
		}

		let status = 'Running daemons:\n';
		for (const daemon of daemons) {
			const runtime = Math.floor((Date.now() - daemon.startTime.getTime()) / 1000);
			status += `  - ${daemon.name} (PID: ${daemon.pid}, running for ${runtime}s)\n`;
		}
		return status;
	}
}