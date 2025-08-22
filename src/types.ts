/**
 * Type definitions for the Positron Developer Tools MCP Server
 */

export interface ToolConfig {
	name: string;
	description: string;
	command: string;
	daemon?: boolean;
}

export interface Config {
	tools: ToolConfig[];
}

export enum ProcessState {
	STARTING = 'starting',
	RUNNING = 'running',
	STOPPED = 'stopped',
	FAILED = 'failed'
}

export interface ProcessOutputBuffer {
	stdout: string[];
	stderr: string[];
	maxLines: number;
}

export interface RunningProcess {
	name: string;
	process: any; // Will be ChildProcess type
	pid: number;
	startTime: Date;
	state: ProcessState;
	outputBuffer: ProcessOutputBuffer;
}

export interface ProcessStatus {
	name: string;
	pid: number;
	state: ProcessState;
	startTime: Date;
	uptime: number; // in seconds
	recentOutput?: string[];
}