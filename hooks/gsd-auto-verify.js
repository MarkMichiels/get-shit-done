#!/usr/bin/env node
/**
 * GSD Auto-Verify Hook
 *
 * Automatically runs tests after Edit/Write operations on code files.
 * Provides feedback to Claude if tests fail (exit code 2).
 *
 * Hook event: PostToolUse (matcher: Edit|Write)
 *
 * Configuration in ~/.claude/settings.json:
 * {
 *   "hooks": {
 *     "PostToolUse": [{
 *       "matcher": "Edit|Write",
 *       "hooks": [{
 *         "type": "command",
 *         "command": "node ~/.claude/hooks/gsd-auto-verify.js"
 *       }]
 *     }]
 *   }
 * }
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

// Read hook input from stdin
let input = '';
try {
  input = fs.readFileSync(0, 'utf8');
} catch (e) {
  process.exit(0); // No input, skip
}

let data;
try {
  data = JSON.parse(input);
} catch (e) {
  process.exit(0); // Invalid JSON, skip
}

const filePath = data.tool_input?.file_path || data.tool_input?.path || '';
const cwd = data.cwd || process.cwd();

// Skip if no file path
if (!filePath) {
  process.exit(0);
}

// Get file extension
const ext = path.extname(filePath).toLowerCase();

// Configuration: which extensions trigger which test commands
const testCommands = {
  // Flutter/Dart
  '.dart': {
    check: () => fs.existsSync(path.join(cwd, 'pubspec.yaml')),
    command: 'flutter test --reporter=compact',
    name: 'Flutter'
  },
  // Python
  '.py': {
    check: () => fs.existsSync(path.join(cwd, 'pyproject.toml')) ||
                 fs.existsSync(path.join(cwd, 'setup.py')) ||
                 fs.existsSync(path.join(cwd, 'pytest.ini')),
    command: 'python -m pytest -x -q',
    name: 'pytest'
  },
  // TypeScript/JavaScript
  '.ts': {
    check: () => fs.existsSync(path.join(cwd, 'package.json')),
    command: 'npm test --if-present',
    name: 'npm'
  },
  '.js': {
    check: () => fs.existsSync(path.join(cwd, 'package.json')),
    command: 'npm test --if-present',
    name: 'npm'
  }
};

// Check if this file type has a test command
const testConfig = testCommands[ext];
if (!testConfig) {
  process.exit(0); // No test command for this file type
}

// Check if we're in a project that supports this test command
if (!testConfig.check()) {
  process.exit(0); // Not in a compatible project
}

// Skip test files themselves (avoid infinite loops)
if (filePath.includes('_test.') || filePath.includes('.test.') ||
    filePath.includes('/test/') || filePath.includes('\\test\\')) {
  // Still run tests, but don't skip - test files should trigger test runs
}

// Skip generated files
if (filePath.includes('.g.dart') || filePath.includes('.freezed.dart')) {
  process.exit(0);
}

// Run tests
console.error(`\n🧪 Auto-verify: Running ${testConfig.name} tests...`);

try {
  const result = spawnSync(testConfig.command, {
    cwd: cwd,
    shell: true,
    encoding: 'utf8',
    timeout: 120000, // 2 minute timeout
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.status === 0) {
    // Tests passed
    console.error(`✅ Tests passed`);
    process.exit(0);
  } else {
    // Tests failed - provide feedback to Claude (exit code 2)
    const output = (result.stdout || '') + (result.stderr || '');

    // Truncate if too long
    const maxLength = 2000;
    const truncatedOutput = output.length > maxLength
      ? output.substring(0, maxLength) + '\n... (truncated)'
      : output;

    console.error(`\n❌ Tests failed after editing ${path.basename(filePath)}:\n`);
    console.error(truncatedOutput);
    console.error(`\n⚠️ Please fix the failing tests before continuing.`);

    // Exit code 2 = blocking error, stderr shown to Claude as feedback
    process.exit(2);
  }
} catch (e) {
  // Test command failed to run
  console.error(`⚠️ Could not run tests: ${e.message}`);
  process.exit(0); // Non-blocking, continue
}
