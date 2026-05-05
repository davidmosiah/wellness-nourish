#!/usr/bin/env node

import { SERVER_NAME, SERVER_VERSION } from "./constants.js";

const message =
  "Nourish MCP entrypoint is installed; MCP transport wiring lands in the next implementation task.";

if (process.argv.includes("--version")) {
  console.log(`${SERVER_NAME} ${SERVER_VERSION}`);
} else {
  console.log(message);
}
