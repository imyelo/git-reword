# git-reword

AI-powered Git commit message rewriter.

## Usage

```bash
# Reword the last commit
git-reword

# Reword the last 3 commits
git-reword --last 3

# Preview without applying
git-reword --dry-run --last 3

# Skip confirmation
git-reword --yes --last 3

# Generate message for staged changes
git-reword --staged
```

## Installation

```bash
npm i -g git-reword
```

## Configuration

Create `~/.config/git-reword/config.json`:

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "apiKey": "your-api-key"
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GIT_REWORD_PROVIDER` | AI provider |
| `GIT_REWORD_MODEL` | Model name |
| `GIT_REWORD_API_KEY` | API key |
| `GIT_REWORD_BASE_URL` | Base URL for self-hosted |

---

Apache-2.0 &copy; [yelo](https://github.com/imyelo), 2023 - present
