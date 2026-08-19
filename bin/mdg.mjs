#!/usr/bin/env node

import { runCli } from "../src/mdg.mjs";

runCli(process.argv.slice(2)).catch((error) => {
  console.error(`mdg: ${error.message}`);
  if (process.env.MDG_DEBUG === "1") {
    console.error(error.stack);
  }
  process.exitCode = 1;
});
