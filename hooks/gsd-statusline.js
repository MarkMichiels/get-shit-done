#!/usr/bin/env node
// gsd-hook-version: {{GSD_VERSION}}
// Claude Code Statusline - GSD Edition
// Shows: model | current task | directory | context usage

const fs = require('fs');
const path = require('path');
const os = require('os');

// Read JSON from stdin
let input = '';
// Timeout guard: if stdin doesn't close within 3s (e.g. pipe issues on
// Windows/Git Bash), exit silently instead of hanging. See #775.
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const model = (data.model?.display_name || 'Claude').replace(/\s*\([^)]*\)\s*$/, '');
    const dir = data.workspace?.current_dir || process.cwd();
    const session = data.session_id || '';
    const remaining = data.context_window?.remaining_percentage;

    // Context window display (shows USED percentage scaled to usable context)
    // Claude Code reserves ~16.5% for autocompact buffer, so usable context
    // is 83.5% of the total window. We normalize to show 100% at that point.
    const AUTO_COMPACT_BUFFER_PCT = 16.5;
    let ctx = '';
    if (remaining != null) {
      // Normalize: subtract buffer from remaining, scale to usable range
      const usableRemaining = Math.max(0, ((remaining - AUTO_COMPACT_BUFFER_PCT) / (100 - AUTO_COMPACT_BUFFER_PCT)) * 100);
      const used = Math.max(0, Math.min(100, Math.round(100 - usableRemaining)));

      // Write context metrics to bridge file for the context-monitor PostToolUse hook.
      // The monitor reads this file to inject agent-facing warnings when context is low.
      if (session) {
        try {
          const bridgePath = path.join(os.tmpdir(), `claude-ctx-${session}.json`);
          const bridgeData = JSON.stringify({
            session_id: session,
            remaining_percentage: remaining,
            used_pct: used,
            timestamp: Math.floor(Date.now() / 1000)
          });
          fs.writeFileSync(bridgePath, bridgeData);
        } catch (e) {
          // Silent fail -- bridge is best-effort, don't break statusline
        }
      }

      // Color based on usable context thresholds (percentage only, no bar)
      if (used < 50) {
        ctx = ` \x1b[32mctx${used}%\x1b[0m`;
      } else if (used < 65) {
        ctx = ` \x1b[33mctx${used}%\x1b[0m`;
      } else if (used < 80) {
        ctx = ` \x1b[38;5;208mctx${used}%\x1b[0m`;
      } else {
        ctx = ` \x1b[5;31m💀ctx${used}%\x1b[0m`;
      }
    }

    // Current task from todos
    let task = '';
    const homeDir = os.homedir();
    // Respect CLAUDE_CONFIG_DIR for custom config directory setups (#870)
    const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(homeDir, '.claude');
    const todosDir = path.join(claudeDir, 'todos');
    if (session && fs.existsSync(todosDir)) {
      try {
        const files = fs.readdirSync(todosDir)
          .filter(f => f.startsWith(session) && f.includes('-agent-') && f.endsWith('.json'))
          .map(f => ({ name: f, mtime: fs.statSync(path.join(todosDir, f)).mtime }))
          .sort((a, b) => b.mtime - a.mtime);

        if (files.length > 0) {
          try {
            const todos = JSON.parse(fs.readFileSync(path.join(todosDir, files[0].name), 'utf8'));
            const inProgress = todos.find(t => t.status === 'in_progress');
            if (inProgress) task = inProgress.activeForm || '';
          } catch (e) {}
        }
      } catch (e) {
        // Silently fail on file system errors - don't break statusline
      }
    }

    // Stale hooks warning (kept — genuinely critical). GSD update banner removed per user pref.
    let gsdUpdate = '';
    const cacheFile = path.join(claudeDir, 'cache', 'gsd-update-check.json');
    if (fs.existsSync(cacheFile)) {
      try {
        const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        if (cache.stale_hooks && cache.stale_hooks.length > 0) {
          gsdUpdate = '\x1b[31m⚠ stale hooks — run /gsd:update\x1b[0m │ ';
        }
      } catch (e) {}
    }

    // Per-session API cost estimate (what this window would have cost on pay-per-token).
    // Loads pricing config from ~/.claude/pricing.json (symlinked from mark-private).
    // Falls back to safe Opus 4.7 defaults if config missing — keeps hook portable for
    // other GSD users who don't have the mark-private layer.
    let pricingCfg = null;
    try {
      pricingCfg = JSON.parse(fs.readFileSync(path.join(claudeDir, 'pricing.json'), 'utf8'));
    } catch (e) {}
    const DEFAULT_PRICING = {
      eur_rate: 0.92,
      color_thresholds_eur: { yellow: 5, orange: 20, red: 50 },
      models: { "opus-4.7": { input: 5, output: 25, cache_write_5m: 6.25, cache_read: 0.50 } },
      family_fallback: { haiku: "opus-4.7", sonnet: "opus-4.7", opus: "opus-4.7" },
    };
    const cfg = pricingCfg || DEFAULT_PRICING;
    // Model resolution: exact match first (normalised), then family regex fallback.
    const modelNorm = (model || '').toLowerCase().replace(/\s+/, '-');
    let p = cfg.models[modelNorm];
    if (!p) {
      const family = /haiku/i.test(model) ? 'haiku'
                   : /sonnet/i.test(model) ? 'sonnet'
                   : /opus/i.test(model) ? 'opus'
                   : 'opus';
      const fallbackKey = cfg.family_fallback?.[family] || 'opus-4.7';
      p = cfg.models[fallbackKey] || DEFAULT_PRICING.models["opus-4.7"];
    }

    let sessCost = null;
    if (session) {
      try {
        const projectsDir = path.join(claudeDir, 'projects');
        if (fs.existsSync(projectsDir)) {
          for (const d of fs.readdirSync(projectsDir)) {
            const candidate = path.join(projectsDir, d, `${session}.jsonl`);
            if (!fs.existsSync(candidate)) continue;
            const raw = fs.readFileSync(candidate, 'utf8');
            let cost = 0;
            for (const line of raw.split('\n')) {
              if (!line.includes('"usage"')) continue;
              try {
                const obj = JSON.parse(line);
                if (obj.type === 'assistant') {
                  const u = obj.message?.usage;
                  if (u) {
                    cost += ((u.input_tokens || 0) * p.input
                          + (u.output_tokens || 0) * p.output
                          + (u.cache_creation_input_tokens || 0) * p.cache_write_5m
                          + (u.cache_read_input_tokens || 0) * p.cache_read) / 1e6;
                  }
                }
              } catch (e) {}
            }
            sessCost = cost;
            break;
          }
        }
      } catch (e) {}
    }

    // Account + quota indicator (5-hour burst + 7-day rolling window)
    const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(homeDir, '.claude');
    const acctName = configDir.includes('claude-background') ? 'bg' : 'main';
    let weekPct = data.rate_limits?.seven_day?.used_percentage;
    let burstPct = data.rate_limits?.five_hour?.used_percentage;
    // Fallback: read from shared file cache when rate_limits not yet available
    if (weekPct == null || burstPct == null) {
      try {
        const cache = JSON.parse(fs.readFileSync('/tmp/claude_quota_cache.json', 'utf8'));
        const entry = cache[configDir];
        if (weekPct == null && entry?._response?.seven_day?.utilization != null) {
          weekPct = entry._response.seven_day.utilization;
        }
        if (burstPct == null && entry?._response?.five_hour?.utilization != null) {
          burstPct = entry._response.five_hour.utilization;
        }
      } catch (e) {}
    }
    const colorFor = pct => pct > 80 ? '\x1b[31m' : pct > 60 ? '\x1b[33m' : '\x1b[32m';
    const parts = [];
    if (burstPct != null) {
      parts.push(`${colorFor(burstPct)}5h${Math.round(burstPct)}%\x1b[0m`);
    }
    if (weekPct != null) {
      parts.push(`${colorFor(weekPct)}7d${Math.round(weekPct)}%\x1b[0m`);
    }
    if (sessCost != null && sessCost > 0) {
      const eur = sessCost * (cfg.eur_rate || DEFAULT_PRICING.eur_rate);
      const label = eur < 1 ? `€${eur.toFixed(2)}` : `€${Math.round(eur)}`;
      const t = cfg.color_thresholds_eur || DEFAULT_PRICING.color_thresholds_eur;
      const sessColor = eur > t.red ? '\x1b[31m'
                      : eur > t.orange ? '\x1b[38;5;208m'
                      : eur > t.yellow ? '\x1b[33m'
                      : '\x1b[32m';
      parts.push(`${sessColor}${label}\x1b[0m`);
    }
    // Account label: only show when non-default (bg), skip for main to save space
    const acctPrefix = acctName === 'bg' ? `\x1b[2mbg\x1b[0m ` : '';
    let acct;
    if (parts.length > 0) {
      acct = `${acctPrefix}${parts.join('·')}`;
    } else {
      acct = `${acctPrefix}\x1b[2m${acctName}\x1b[0m`;
    }

    // Output — critical-first order so narrow windows keep quota + context visible.
    // Right-side fields (model, gsd update hint) get truncated first.
    // Dirname kept because agents/worktrees run in different basedirs.
    const dirname = path.basename(dir);
    const ctxTrimmed = ctx.replace(/^ /, '');  // remove leading space for first-position use
    const trailing = [];
    if (task) trailing.push(`\x1b[1m${task}\x1b[0m`);
    trailing.push(`\x1b[2m${dirname}\x1b[0m`);
    trailing.push(`\x1b[2m${model}\x1b[0m`);
    if (gsdUpdate) trailing.push(gsdUpdate.replace(/ │ $/, ''));
    process.stdout.write(`${acct} ${ctxTrimmed} │ ${trailing.join(' │ ')}`);
  } catch (e) {
    // Silent fail - don't break statusline on parse errors
  }
});
