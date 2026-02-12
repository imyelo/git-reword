#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'

// Ensure bin directory exists
if (!existsSync('bin')) {
  mkdirSync('bin')
}

// Copy oclif manifest if it exists
const manifestPath = 'oclif.manifest.json'
if (existsSync(manifestPath)) {
  copyFileSync(manifestPath, 'bin/oclif.manifest.json')
}

// Ensure bin/run is executable
import { chmodSync } from 'node:fs'

chmodSync('bin/run', 0o755)
