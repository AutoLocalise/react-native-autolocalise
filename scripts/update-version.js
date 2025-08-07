#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Read package.json
const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

// Update version.ts
const versionFilePath = path.join(__dirname, "..", "src", "version.ts");
const versionContent = `// This file is auto-generated during build
// Update this manually or via build script
export const VERSION = "${packageJson.version}";
`;

fs.writeFileSync(versionFilePath, versionContent);
console.log(`Updated version.ts with version ${packageJson.version}`);
