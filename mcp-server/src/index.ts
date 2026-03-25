#!/usr/bin/env node
/**
 * Main entry point for DigiKey MCP Server
 */
import { config as loadEnv } from 'dotenv';
loadEnv();

import { loadConfig } from './config.js';
import { parseArgs } from './cli.js';
import { DigiKeyServer } from './server.js';
import { runStdioTransport, startHttpTransport } from './transport/index.js';

/**
 * Transport selection logic:
 * 1. --stdio flag forces STDIO transport
 * 2. Default: HTTP transport for production compatibility
 */
async function main() {
  try {
    const config = loadConfig();
    const cliOptions = parseArgs();

    if (cliOptions.stdio) {
      // STDIO transport for local development
      const server = new DigiKeyServer(config.clientId, config.clientSecret);
      await runStdioTransport(server.getServer());
    } else {
      // HTTP transport for production/cloud deployment
      const port = cliOptions.port || config.port;
      startHttpTransport({ ...config, port });
    }
  } catch (error) {
    console.error('Fatal error running DigiKey server:', error);
    process.exit(1);
  }
}

main();
