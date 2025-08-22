# Simple Commands MCP Server

A configuration-driven Model Context Protocol (MCP) server that provides tools for executing developer commands and managing long-running processes. This server allows AI assistants to run predefined commands through a simple JSON configuration file.

## Features

- **Configuration-driven**: Add new tools by simply updating a JSON config file
- **Daemon Management**: Handle long-running processes with automatic start/stop/status/logs commands
- **Auto-generated Controls**: Each daemon automatically gets `_start`, `_status`, `_stop`, and `_logs` commands
- **Process Monitoring**: Track PID, uptime, state, and capture output for all daemons
- **Automatic Cleanup**: All processes are terminated when the MCP client disconnects
- **Cross-platform**: Works on macOS, Linux, and Windows

## Installation

### Using npx (recommended)

No installation needed! Just run directly:

```bash
npx simple-commands-mcp @config.json
```

### Global Installation

```bash
npm install -g simple-commands-mcp
simple-commands-mcp @config.json
```

### Local Development

```bash
git clone https://github.com/yourusername/simple-commands-mcp.git
cd simple-commands-mcp
npm install
npm run build
npm link
simple-commands-mcp @config.json
```

## Usage

### Basic Usage

Create a `config.json` file with your tool definitions:

```json
{
  "tools": [
    {
      "name": "list_files",
      "description": "List files in current directory",
      "command": "ls -la",
      "daemon": false
    },
    {
      "name": "dev_server",
      "description": "Start development server",
      "command": "npm run dev",
      "daemon": true
    }
  ]
}
```

Then run the MCP server:

```bash
npx simple-commands-mcp @config.json
```

### Configuration Options

Each tool in the configuration has the following properties:

- `name` (string, required): Unique identifier for the tool
- `description` (string, required): Human-readable description of what the tool does
- `command` (string, required): The shell command to execute
- `daemon` (boolean, required): Set to `true` for long-running processes, `false` for one-shot commands

### Daemon Tools

When you set `daemon: true` for a tool, the server automatically creates four commands:

- `{name}_start`: Start the daemon process
- `{name}_status`: Get current status, PID, uptime, and recent output
- `{name}_stop`: Stop the daemon process
- `{name}_logs`: Get the last N lines of output (default: 50)

Example: A tool named `dev_server` with `daemon: true` will create:
- `dev_server_start`
- `dev_server_status`
- `dev_server_stop`
- `dev_server_logs`

## Examples

### Simple Commands Configuration

```json
{
  "tools": [
    {
      "name": "git_status",
      "description": "Show git repository status",
      "command": "git status",
      "daemon": false
    },
    {
      "name": "run_tests",
      "description": "Run test suite",
      "command": "npm test",
      "daemon": false
    },
    {
      "name": "build_project",
      "description": "Build the project",
      "command": "npm run build",
      "daemon": false
    }
  ]
}
```

### Development Environment Configuration

```json
{
  "tools": [
    {
      "name": "frontend",
      "description": "Frontend development server with hot reload",
      "command": "npm run dev:frontend",
      "daemon": true
    },
    {
      "name": "backend",
      "description": "Backend API server",
      "command": "npm run dev:backend",
      "daemon": true
    },
    {
      "name": "database",
      "description": "Local database server",
      "command": "docker-compose up db",
      "daemon": true
    },
    {
      "name": "migrate",
      "description": "Run database migrations",
      "command": "npm run db:migrate",
      "daemon": false
    }
  ]
}
```

### MCP Client Configuration

To use this server with an MCP client (like Claude Desktop), add it to your MCP settings:

```json
{
  "mcpServers": {
    "simple-commands": {
      "command": "npx",
      "args": ["simple-commands-mcp", "@/path/to/your/config.json"]
    }
  }
}
```

## Working Directory

Commands are executed in the directory where you run the MCP server. To run commands in a specific directory:

1. Start the server from that directory:
   ```bash
   cd /path/to/project
   npx simple-commands-mcp @config.json
   ```

2. Or use absolute paths in your commands:
   ```json
   {
     "name": "project_build",
     "description": "Build the project",
     "command": "cd /path/to/project && npm run build",
     "daemon": false
   }
   ```

## Troubleshooting

### Server won't start
- Ensure Node.js 18+ is installed: `node --version`
- Check that your config file is valid JSON
- Make sure the config file path is correct and prefixed with `@`

### Commands fail to execute
- Verify commands work when run manually from the same directory
- Check that required dependencies are in PATH
- Review the server logs for error messages

### Daemon processes not stopping
- The server automatically tracks and terminates all daemon processes when:
  - The MCP client disconnects
  - The server receives SIGINT/SIGTERM
  - You use the `{name}_stop` command
- Use Ctrl+C to gracefully shutdown the server and all daemons

## Development

### Building from Source

```bash
npm install
npm run build
```

### Running in Development Mode

```bash
npm run dev
```

### Project Structure

```
simple-commands-mcp/
├── src/
│   ├── cli.ts           # CLI entry point for npx
│   ├── server.ts        # Main MCP server
│   ├── types.ts         # TypeScript type definitions
│   ├── logger.ts        # Logging utilities
│   ├── processManager.ts # Daemon process management
│   └── toolExecutor.ts  # Command execution logic
├── dist/                # Compiled JavaScript (generated)
├── config.json          # Example configuration
├── package.json         # Package metadata and scripts
└── tsconfig.json        # TypeScript configuration
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/yourusername/simple-commands-mcp/issues) page.