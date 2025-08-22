/**
 * Process management for daemon processes
 */

import { ChildProcess, spawn } from 'child_process';
import { RunningProcess, ProcessState, ProcessOutputBuffer, ProcessStatus } from './types.js';
import { logger } from './logger.js';

class ProcessManager {
	private runningProcesses: Map<string, RunningProcess> = new Map();
	private readonly MAX_OUTPUT_LINES = 1000;

	/**
	 * Create an output buffer for a process
	 */
	private createOutputBuffer(): ProcessOutputBuffer {
		return {
			stdout: [],
			stderr: [],
			maxLines: this.MAX_OUTPUT_LINES
		};
	}

	/**
	 * Add a line to the output buffer (circular buffer behavior)
	 */
	private addToBuffer(buffer: string[], line: string, maxLines: number): void {
		buffer.push(line);
		if (buffer.length > maxLines) {
			buffer.shift(); // Remove oldest line
		}
	}

	/**
	 * Start a daemon process
	 */
	async startDaemon(name: string, command: string, cwd: string): Promise<{ success: boolean; message: string }> {
		// Check if daemon is already running
		if (this.runningProcesses.has(name)) {
			const existing = this.runningProcesses.get(name)!;
			logger.info(`Daemon ${name} is already running with PID ${existing.pid}`);
			return {
				success: false,
				message: `Daemon '${name}' is already running (PID: ${existing.pid})`
			};
		}

		logger.debug(`Starting daemon ${name}: ${command}`);

		try {
			// Start the process using shell to handle complex commands
			const child = spawn(command, [], {
				shell: true,
				cwd,
				detached: false,
				stdio: ['ignore', 'pipe', 'pipe']
			});

			const outputBuffer = this.createOutputBuffer();

			// Store the process
			const runningProcess: RunningProcess = {
				name,
				process: child,
				pid: child.pid!,
				startTime: new Date(),
				state: ProcessState.STARTING,
				outputBuffer
			};
			this.runningProcesses.set(name, runningProcess);

			// Set up output handlers
			child.stdout?.on('data', (data) => {
				const lines = data.toString().split('\n').filter(line => line.trim());
				lines.forEach(line => {
					this.addToBuffer(outputBuffer.stdout, line, outputBuffer.maxLines);
					logger.debug(`[${name}:stdout] ${line}`);
				});
			});

			child.stderr?.on('data', (data) => {
				const lines = data.toString().split('\n').filter(line => line.trim());
				lines.forEach(line => {
					this.addToBuffer(outputBuffer.stderr, line, outputBuffer.maxLines);
					logger.debug(`[${name}:stderr] ${line}`);
				});
			});

			// Give it a moment to ensure it starts properly
			await new Promise(resolve => setTimeout(resolve, 1000));

			// Check if process is still running
			if (child.killed || child.exitCode !== null) {
				this.runningProcesses.delete(name);

				// Collect any error output
				const errorOutput = outputBuffer.stderr.join('\n') || 'Process exited immediately';

				logger.error(`Daemon ${name} failed to start: ${errorOutput}`);
				return {
					success: false,
					message: `Error: Daemon failed to start:\n${errorOutput}`
				};
			}

			// Mark as running
			runningProcess.state = ProcessState.RUNNING;

			// Set up handlers for when the process exits
			child.on('exit', (code, signal) => {
				logger.info(`Daemon ${name} exited with code ${code} and signal ${signal}`);
				const proc = this.runningProcesses.get(name);
				if (proc) {
					proc.state = code === 0 ? ProcessState.STOPPED : ProcessState.FAILED;
					// Keep the process in the map briefly for status queries
					setTimeout(() => this.runningProcesses.delete(name), 5000);
				}
			});

			child.on('error', (err) => {
				logger.error(`Daemon ${name} error: ${err.message}`);
				const proc = this.runningProcesses.get(name);
				if (proc) {
					proc.state = ProcessState.FAILED;
					this.addToBuffer(proc.outputBuffer.stderr, `Error: ${err.message}`, proc.outputBuffer.maxLines);
				}
				// Keep the process in the map briefly for status queries
				setTimeout(() => this.runningProcesses.delete(name), 5000);
			});

			logger.info(`Started daemon ${name} with PID ${child.pid}`);
			return {
				success: true,
				message: `Started daemon '${name}' (PID: ${child.pid})`
			};

		} catch (error) {
			logger.error(`Failed to start daemon ${name}: ${error}`);
			return {
				success: false,
				message: `Failed to start daemon: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	/**
	 * Stop a specific daemon process
	 */
	stopDaemon(name: string): { success: boolean; message: string } {
		const running = this.runningProcesses.get(name);
		if (!running) {
			return {
				success: false,
				message: `Daemon '${name}' is not running`
			};
		}

		try {
			logger.info(`Stopping daemon ${name} (PID: ${running.pid})`);
			running.process.kill('SIGTERM');
			this.runningProcesses.delete(name);

			return {
				success: true,
				message: `Stopped daemon '${name}' (PID: ${running.pid})`
			};
		} catch (error) {
			logger.error(`Failed to stop daemon ${name}: ${error}`);
			return {
				success: false,
				message: `Failed to stop daemon: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	/**
	 * Check if a daemon is running
	 */
	isDaemonRunning(name: string): boolean {
		const proc = this.runningProcesses.get(name);
		return proc !== undefined && proc.state === ProcessState.RUNNING;
	}

	/**
	 * Get detailed status of a specific daemon
	 */
	getProcessStatus(name: string): ProcessStatus | null {
		const proc = this.runningProcesses.get(name);
		if (!proc) {
			return null;
		}

		const uptime = Math.floor((Date.now() - proc.startTime.getTime()) / 1000);
		const recentOutput = [
			...proc.outputBuffer.stdout.slice(-10),
			...proc.outputBuffer.stderr.slice(-5).map(line => `[stderr] ${line}`)
		];

		return {
			name: proc.name,
			pid: proc.pid,
			state: proc.state,
			startTime: proc.startTime,
			uptime,
			recentOutput
		};
	}

	/**
	 * Get logs from a specific daemon
	 */
	getProcessLogs(name: string, lines: number = 50): { stdout: string[]; stderr: string[] } | null {
		const proc = this.runningProcesses.get(name);
		if (!proc) {
			return null;
		}

		return {
			stdout: proc.outputBuffer.stdout.slice(-lines),
			stderr: proc.outputBuffer.stderr.slice(-lines)
		};
	}

	/**
	 * Get information about running daemons
	 */
	getRunningDaemons(): Array<{ name: string; pid: number; startTime: Date; state: ProcessState }> {
		return Array.from(this.runningProcesses.values()).map(p => ({
			name: p.name,
			pid: p.pid,
			startTime: p.startTime,
			state: p.state
		}));
	}

	/**
	 * Clean up all running processes
	 */
	cleanup(): void {
		logger.info(`Cleaning up ${this.runningProcesses.size} running processes`);

		for (const [name, proc] of this.runningProcesses) {
			try {
				logger.info(`Terminating daemon '${name}' (PID: ${proc.pid})`);
				proc.process.kill('SIGTERM');

				// Give it time to terminate gracefully
				setTimeout(() => {
					if (!proc.process.killed) {
						logger.warn(`Force killing daemon '${name}'`);
						proc.process.kill('SIGKILL');
					}
				}, 5000);
			} catch (error) {
				logger.error(`Error terminating daemon '${name}': ${error}`);
			}
		}

		this.runningProcesses.clear();
	}
}

// Export singleton instance
export const processManager = new ProcessManager();

// Set up cleanup on process exit
process.on('SIGINT', () => {
	logger.info('Received SIGINT, cleaning up processes...');
	processManager.cleanup();
	process.exit(0);
});

process.on('SIGTERM', () => {
	logger.info('Received SIGTERM, cleaning up processes...');
	processManager.cleanup();
	process.exit(0);
});

process.on('exit', () => {
	processManager.cleanup();
});