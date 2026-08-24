#!/usr/bin/env node

import { readFileSync } from "node:fs";

const lockfilePath = new URL("../package-lock.json", import.meta.url);
const lockfile = JSON.parse(readFileSync(lockfilePath, "utf8"));
const resolvedUrls = [];

for (const [packagePath, packageInfo] of Object.entries(lockfile.packages ?? {})) {
  if (typeof packageInfo?.resolved === "string") {
    resolvedUrls.push({ packagePath, url: packageInfo.resolved });
  }
}

const invalidUrls = resolvedUrls.filter(({ url }) => {
  if (url.includes("package-firewall.replit.local")) return true;
  if (!url.startsWith("https://registry.npmjs.org/")) return true;
  return url.startsWith("https://registry.npmjs.org/npm/");
});

if (invalidUrls.length > 0) {
  console.error("Invalid package-lock.json tarball URL(s):");
  for (const { packagePath, url } of invalidUrls) {
    console.error(`- ${packagePath}: ${url}`);
  }
  process.exit(1);
}

console.log(
  `Validated ${resolvedUrls.length} package-lock.json tarball URL(s) against registry.npmjs.org`,
);