#!/usr/bin/env node
import { createRequire } from "module";const require = createRequire(import.meta.url);

// src/cli.ts
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve, isAbsolute } from "path";
import fs from "fs";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
function printUsage() {
  console.error("Usage: npx simple-commands-mcp @<config-file>");
  console.error("");
  console.error("Example:");
  console.error("  npx simple-commands-mcp @config.json");
  console.error("  npx simple-commands-mcp @./my-tools.json");
  console.error("  npx simple-commands-mcp @/absolute/path/to/config.json");
  process.exit(1);
}
function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
  }
  const configArg = args[0];
  if (!configArg.startsWith("@")) {
    console.error("Error: Config file must be prefixed with @ (e.g., @config.json)");
    printUsage();
  }
  const configPath = configArg.slice(1);
  const resolvedConfigPath = isAbsolute(configPath) ? configPath : resolve(process.cwd(), configPath);
  if (!fs.existsSync(resolvedConfigPath)) {
    console.error(`Error: Config file not found: ${resolvedConfigPath}`);
    process.exit(1);
  }
  try {
    const configContent = fs.readFileSync(resolvedConfigPath, "utf-8");
    JSON.parse(configContent);
  } catch (error) {
    console.error(`Error: Invalid JSON in config file: ${resolvedConfigPath}`);
    console.error(error);
    process.exit(1);
  }
  const serverPath = resolve(__dirname, "server.js");
  const env = {
    ...process.env,
    MCP_CONFIG_PATH: resolvedConfigPath,
    MCP_PROJECT_ROOT: process.cwd()
  };
  const child = spawn("node", [serverPath], {
    env,
    stdio: "inherit"
  });
  child.on("error", (error) => {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  });
  child.on("exit", (code) => {
    process.exit(code || 0);
  });
  process.on("SIGINT", () => {
    child.kill("SIGINT");
  });
  process.on("SIGTERM", () => {
    child.kill("SIGTERM");
  });
}
main();
//# sourceMappingURL=cli.js.map
