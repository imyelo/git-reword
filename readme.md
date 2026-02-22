# git-reword

> 📝 AI-powered Git commit message rewriter.

<img src="./assets/logo.png" width="360">

## Features

- 📚 **Batch Rewording**: Reword multiple commits at once
- 🤖 **AI-Powered**: Generate professional commit messages using AI
- 🔌 **Multi-Provider**: Support OpenAI, Anthropic, Google, MiniMax, and more
- 💬 **Interactive UI**: Review and accept/skip/regenerate suggestions
- 🎯 **Flexible Targeting**: Support `--last`, `--since`, range, and single commit
- 🤖 **Agent Friendly**: First-class integration for AI agents with `--format jsonl`

### Comparison

| Tool                                                                                                                                            | Limitation                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Most AI commit message tools (e.g., [aicommits](https://github.com/Nutlope/aicommits), [opencommit](https://github.com/di-sukharev/opencommit)) | Only handles the most recent commit                            |
| AI coding assistants (Claude Code, etc.)                                                                                                        | Inconvenient for processing batches of commits in conversation |
| Manual rebase                                                                                                                                   | Tedious for multiple commits                                   |

## Getting Started

### Installation

```bash
npm i -g git-reword
# or
bun add -g git-reword
```

### Quick Start

```bash
# Reword the last commit (default)
git-reword

# Reword the last N commits
git-reword --last 5

# Reword commits from a specific ref
git-reword --since abc1234

# Reword commits in range
git-reword HEAD~3..HEAD

# Reword a specific commit
git-reword abc1234

# Generate commit message for staged changes
git-reword --staged
```

## Usage

### Reword Commits

#### Interactive Mode

Interactive UI displays commits with AI-generated suggestions. For each commit, you can:

- **Accept**: Use AI-generated message
- **Skip**: Keep original message
- **Regenerate**: Request new AI message
- **Abort**: Cancel entire operation

```bash
# Interactive mode (default)
git-reword --last 3

# Skip confirmation - apply all changes automatically
git-reword --yes --last 3
```

#### AI Commit (Staged Changes)

Generate a commit message for staged changes:

```bash
# Stage your changes first
git add .

# Generate and apply commit message
git-reword --staged

# Output:
# Suggested message:
# feat(api): add user authentication middleware
#
# Apply? [y/n]
# y: git commit with suggested message
# n: cancel, no commit
```

### Options

| Option               | Description                                   |
| -------------------- | --------------------------------------------- |
| `--last <n>`         | Reword the last N commits                     |
| `--since <ref>`      | Reword commits from ref's next commit to HEAD |
| `--dry-run`          | Preview without executing rebase              |
| `--yes`, `-y`        | Skip confirmation, apply all changes          |
| `--skip-check`, `-k` | Skip uncommitted changes check (debugging)    |
| `--staged`           | Generate commit message for staged changes    |
| `--format <fmt>`     | Output format: `text` (default) or `jsonl` (AI agent) |
| `--apply`, `-a`       | Apply pre-confirmed rewrites from stdin (skip AI generation) |

### Preview Mode

Preview changes without executing the rebase:

```bash
git-reword --dry-run --last 3

# Output:
# Commit abc123:
#   OLD: "fix: bug"
#   NEW: "fix(auth): resolve login timeout issue"
# ---
# Commit def456:
#   OLD: "update"
#   NEW: "feat(api): add rate limiting middleware"
```

### Two-Phase Execution

The tool uses a two-phase approach for safe operation:

1. **Confirmation Phase**: Generate AI messages, display each for your review
2. **Execution Phase**: Once confirmed, execute the rebase once

```bash
# Phase 1: Confirmation (no rebase yet)
git-reword --last 3
# → Show commit-1: old → new? [y/n/q]
# → Show commit-2: old → new? [y/n/q]
# → Show commit-3: old → new? [y/n/q]
# All confirmed!

# Phase 2: Execute rebase (all at once)
# → Running: git rebase -i --exec "..."
# → Done. 3/3 commits rewrote
```

With `--yes` flag, it skips confirmation and applies AI messages to all commits.

## Configuration

Create `~/.git-rewordrc`:

```
provider=anthropic
model=claude-sonnet-4-20250514
apiKey=your-api-key
```

### Supported Providers

| Provider    | Default Model      |
| ----------- | ------------------ |
| `openai`    | `gpt-5-mini`       |
| `anthropic` | `claude-haiku-4-5` |
| `google`    | `gemini-2.5-flash` |

### Provider Configuration Examples

#### OpenAI

```rc
provider=openai
model=gpt-5-mini
apiKey=sk-...
```

#### Anthropic

```rc
provider=anthropic
model=claude-haiku-4-5
apiKey=sk-ant-...
```

#### Google

```rc
provider=google
model=gemini-2.5-flash
apiKey=AIza...
```

#### MiniMax

```rc
provider=anthropic
model=MiniMax-M2.5
baseUrl=https://api.minimax.io/anthropic/v1
apiKey=sk-...
```

#### MiniMax (CN)

```rc
provider=anthropic
model=MiniMax-M2.5
baseUrl=https://api.minimaxi.com/anthropic/v1
apiKey=sk-...
```

## Advanced

### GPG Signing

When rewording GPG-signed commits:

- **Signed commits remain signed**: `git commit --amend` without `-S` preserves the signature
- **Unsigned commits remain unsigned**: No new signature is added

If you use GPG-signed commits and git-reword prompts for passphrase during rebase:

1. **Extend GPG agent cache lifetime**:
   ```bash
   echo "default-cache-ttl 86400" >> ~/.gnupg/gpg-agent.conf
   echo "max-cache-ttl 604800" >> ~/.gnupg/gpg-agent.conf
   gpgconf --reload gpg-agent
   ```

2. **Refresh cache before running git-reword**:
   ```bash
   git commit --amend --no-edit -S
   ```

Verify signatures after reword:
```bash
git log --show-signature -5
```

### Agent Skill Integration

The CLI outputs structured data for easy parsing by AI agents:

```bash
# Text mode (default) - human-readable
git-reword --last 5
# Output:
# ✓ Commit abc123 rewrote
# ✓ Commit def456 rewrote
# Done. 2/2 commits rewrote

# JSONL mode - machine-readable
git-reword --format jsonl --last 5
# Output:
# {"commit":"abc123...","shortCommit":"abc1234","originalMessage":"fix bug","newMessage":"fix: resolve authentication timeout"}
# {"commit":"def456...","shortCommit":"def4567","originalMessage":"add feat","newMessage":"feat(api): add user authentication"}

```

### Branch Constraint

All reword operations target commits on the **current branch only**. This tool uses `git rebase` internally, which replays commits onto the current branch.

```bash
# ✅ Correct: operate on current branch
git checkout feature-a
git-reword --last 3

# ✅ Correct: checkout target branch first
git checkout feature-b
git-reword --since abc1234
```

### Pre-flight Checks

Before rewording commits (not `--staged`):

1. **No uncommitted changes**: Ensures safe rebase operation
2. **Fast-forward possible**: Verifies commits haven't been rebased or amended

Use `--skip-check` to bypass these checks (for debugging).

### Conflict Handling

Rewording commits only modifies commit **messages**, not code content—so conflicts should not occur. If a conflict somehow happens (rare), the tool will:

1. Detect the conflict via rebase exit code
2. Abort the rebase automatically
3. Show clear error with the commit hash
4. Provide recovery instructions

```bash
# Recovery options:
# Option 1: Cancel the entire operation
git rebase --abort

# Option 2: Resolve manually, then continue
# 1. git status     # see conflicted files
# 2. git diff       # understand the conflict
# 3. Edit files to resolve
# 4. git add <resolved-files>
# 5. git rebase --continue
```

### AI Error Handling

- **Empty Response**: If AI returns empty or invalid message, falls back to original message
- **Rate Limiting**: Automatic retry with exponential backoff (3 retries max: 1s, 2s, 4s)

### Execution Scope

The tool only operates in the **current Git repository**. It does not support:
- Multi-repo operations
- Cross-path operations
- Project config vs user config distinction

## Reference

### Exit Codes

| Code | Meaning                                           |
| ---- | ------------------------------------------------- |
| `0`  | Success: all commits rewrote                      |
| `1`  | Error: invalid arguments, config error, git error |
| `2`  | User interrupt: aborted with `q` or Ctrl+C        |
| `3`  | Partial: some commits rewrote, some skipped       |

---

Apache-2.0 &copy; [yelo](https://github.com/imyelo), 2026 - present
