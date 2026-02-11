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
# or
bun add -g git-reword
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

### Supported Providers

| Provider | Default Model |
|----------|---------------|
| `openai` | `gpt-4o` |
| `anthropic` | `claude-sonnet-4-20250514` |
| `google` | `gemini-2.0-flash-exp` |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GIT_REWORD_PROVIDER` | AI provider |
| `GIT_REWORD_MODEL` | Model name |
| `GIT_REWORD_API_KEY` | API key |
| `GIT_REWORD_BASE_URL` | Base URL for self-hosted models |

## Examples

```bash
# Use Anthropic with specific model
GIT_REWORD_PROVIDER=anthropic \
GIT_REWORD_MODEL=claude-opus-4 \
git-reword --last 2

# Use OpenAI compatible API
GIT_REWORD_BASE_URL="https://api.openai.com/v1" \
GIT_REWORD_API_KEY="sk-..." \
git-reword
```

---

Apache-2.0 &copy; [yelo](https://github.com/imyelo), 2023 - present
