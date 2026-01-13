# External Tool Integrations

Reference for enhancing GSD workflows with external tools that outperform Claude's built-in search.

## Why External Tools?

Claude's built-in `web_search` is limited:
- Keyword-based, not semantic
- Often returns SEO-gamed results
- Misses niche technical content
- No answer synthesis

External tools like **Exa** provide significantly better results for research-phase.

---

## Exa (Neural Search)

**What:** Semantic/neural search engine that understands meaning, not just keywords.

**Why better than WebSearch:**
| Aspect | WebSearch | Exa |
|--------|-----------|-----|
| Query style | Keywords | Natural language |
| Technical content | Often misses | Excellent |
| Scientific papers | Hit or miss | Dedicated category |
| Answer quality | Just links | Synthesized + citations |

### Setup

1. **Get API key:** https://dashboard.exa.ai/api-keys (free tier: 1000 req/month)

2. **Install CLI:**
```bash
# Clone your tools repo or create exa_cli.py
# Credentials in private/credentials/exa.env:
EXA_API_KEY=your_key_here
```

3. **Test:**
```bash
exa answer "What are best practices for Three.js scene optimization 2025?"
```

### Usage in Research-Phase

When executing `/gsd:research-phase`, **replace WebSearch queries with Exa:**

**Standard WebSearch (what GSD does by default):**
```
# Claude's built-in - limited results
web_search("[technology] best practices 2025")
```

**Enhanced with Exa:**
```bash
# Much better for technical research
exa answer "[technology] best practices and common pitfalls 2025" --num 5

# For scientific/papers
exa search "[topic]" --category "research paper" --after 2024-01-01

# For ecosystem discovery
exa search "[framework] recommended libraries stack 2025" --text --highlights
```

### Exa Commands Reference

| Command | Use for | Cost |
|---------|---------|------|
| `exa answer "..."` | Synthesized answer + citations | ~$0.005 |
| `exa search "..." --text` | Discovery with content | ~$0.003 |
| `exa search "..." --category "research paper"` | Scientific papers | ~$0.003 |
| `exa research "..."` | Deep multi-source (expensive) | ~$5.00 |

### Integration Pattern

When running `/gsd:research-phase`, manually enhance with Exa:

```
/gsd:research-phase 2

# When Claude starts WebSearch queries, interrupt and say:
"Use exa instead of web_search for this research"

# Or run Exa queries yourself and paste results:
exa answer "Three.js scene optimization best practices 2025" --num 5
```

---

## Document Conversion

**What:** Convert PDF/DOCX to Markdown for importing into research context.

**Use case:** Technical specifications, academic papers, vendor docs.

### Setup

```bash
# If using marker-pdf:
pip install marker-pdf

# Or similar PDF-to-markdown tool
```

### Usage

```bash
# Convert technical spec to markdown for research context
marker_single input.pdf output.md --batch 1

# Then reference in research:
cat output.md  # Claude can read this for context
```

---

## When to Use Which Tool

| Research Need | Tool | Command |
|---------------|------|---------|
| Library docs (current) | Context7 | `mcp__context7__get-library-docs` |
| Ecosystem discovery | **Exa** | `exa answer "..." --num 5` |
| Scientific papers | **Exa** | `exa search "..." --category "research paper"` |
| Official docs | WebFetch | Fetch URL directly |
| PDF specs | Document conversion | `marker_single file.pdf` |
| General web | WebSearch | Built-in (fallback) |

---

## Creating Your Own Tool Integration

If you have specialized tools:

1. **Create CLI wrapper** - Shell-invokable
2. **Document in this file** - Add section
3. **Reference in research** - Tell Claude to use it

The key is that Claude Code can invoke any CLI tool you have available.
