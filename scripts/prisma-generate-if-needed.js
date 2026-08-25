#!/usr/bin/env node
/**
 * Runs `prisma generate` only when the generated client is missing.
 *
 * This guards the postinstall hook so that repeated `pnpm install` calls
 * (e.g. adding a dependency) do not re-run the slow generation step when
 * the client artefacts are already present.
 *
 * To force regeneration (e.g. after a schema change), run:
 *   pnpm prisma:generate
 */

'use strict';

const { existsSync } = require('fs');
const { execSync } = require('child_process');
const { join } = require('path');

const CLIENT_MARKER = join(__dirname, '..', 'node_modules', '.prisma', 'client', 'index.js');

if (existsSync(CLIENT_MARKER)) {
  console.log('Prisma client already generated — skipping postinstall generation.');
  console.log('Run `pnpm prisma:generate` manually after a schema change.');
} else {
  console.log('Prisma client not found — running prisma generate...');
  execSync('prisma generate', { stdio: 'inherit' });
}
