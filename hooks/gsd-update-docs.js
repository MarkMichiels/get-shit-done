#!/usr/bin/env node
/**
 * GSD Update Docs Hook
 *
 * Regenerates FEATURES.md and COVERAGE.md after Claude finishes working.
 * Only runs if .planning/requirements/ exists (GSD project).
 *
 * Hook event: Stop
 *
 * This hook checks if code files were modified during the session,
 * and if so, queues a documentation update for the next session start
 * (to avoid blocking the current response).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Read hook input from stdin
let input = '';
try {
  input = fs.readFileSync(0, 'utf8');
} catch (e) {
  process.exit(0);
}

let data;
try {
  data = JSON.parse(input);
} catch (e) {
  process.exit(0);
}

const cwd = data.cwd || process.cwd();

// Check if this is a GSD project with requirements
const requirementsDir = path.join(cwd, '.planning', 'requirements');
if (!fs.existsSync(requirementsDir)) {
  process.exit(0); // Not a GSD project with requirements
}

// Check if any requirements exist
const reqFiles = fs.readdirSync(requirementsDir).filter(f => f.endsWith('.yaml'));
if (reqFiles.length === 0) {
  process.exit(0); // No requirements defined yet
}

// Mark that docs need updating (checked on next session or manually)
const cacheDir = path.join(os.homedir(), '.claude', 'cache');
const docsUpdateFile = path.join(cacheDir, 'gsd-docs-update-needed.json');

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Write marker file with project info
const updateInfo = {
  project: cwd,
  requirements_count: reqFiles.length,
  timestamp: new Date().toISOString(),
  reason: 'Session completed with requirements present'
};

fs.writeFileSync(docsUpdateFile, JSON.stringify(updateInfo, null, 2));

// Output message (shown to user in verbose mode)
console.log(`📝 Documentation update queued for ${reqFiles.length} requirements`);
console.log(`   Run /gsd:verify-traceability to regenerate FEATURES.md`);

process.exit(0);
