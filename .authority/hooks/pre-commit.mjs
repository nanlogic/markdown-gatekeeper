#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const rootResult = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
if (rootResult.status !== 0) process.exit(0);
const root = rootResult.stdout.trim();
const cli = path.join(root, "bin", "mdg.mjs");
const result = spawnSync(process.execPath, [cli, "check", root], { stdio: "inherit" });
process.exit(result.status ?? 1);
