# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js/TypeScript ESM library project. Source code lives in `src/` and tests in `test/`.

## Commands

```bash
# Development
yarn dev          # Run source with ts-node loader
yarn test         # Run Vitest tests
yarn build        # Compile to lib/esm/ + lib/types/
yarn clean        # Remove lib/ directory

# Code Quality
yarn lint         # Biome check
yarn lint:fix     # Biome check --fix
yarn format       # Biome format --write
yarn typecheck    # TypeScript type checking

# Release
yarn release      # Publish with np
```

## Architecture

- **Entry point**: `src/index.ts` (exports defined in package.json `exports`)
- **Build output**: `lib/esm/` (JS) + `lib/types/` (TypeScript declarations)
- **Tests**: Vitest, located in `test/**/*`
- **Linting**: Biome (extends @yelo/biome-config)
- **TypeScript**: Extends @yelo/tsconfig, Node >= 22 required
