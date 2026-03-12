/**
 * scripts/scan.ts
 * ─────────────────────────────────────────────────────────────
 * CLI entry point for the library scanner.
 *
 * Usage:
 *   npm run scan                          # Uses MUSIC_DIR from .env
 *   npm run scan -- /path/to/music        # Override directory
 *   npm run scan -- /path/to/music --force  # Force re-parse all files
 *   npm run scan -- /path/to/music --concurrency 10
 *
 * Run after adding new music files to update the database.
 * Safe to run repeatedly — all upserts are idempotent.
 */

import path from 'path';
import { scanLibrary } from '../src/services/scanner';
import db from '../src/db';

// ─────────────────────────────────────────────────────────────
//  Parse CLI arguments
// ─────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
  musicDir:    string | undefined;
  force:       boolean;
  concurrency: number;
} {
  const args = argv.slice(2); // Skip "node" and script path

  let musicDir:    string | undefined;
  let force        = false;
  let concurrency  = 5;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === '--force' || arg === '-f') {
      force = true;
    } else if (arg === '--concurrency' || arg === '-c') {
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        concurrency = parseInt(next, 10) || 5;
        i++;
      }
    } else if (!arg.startsWith('-')) {
      // First positional arg is the music directory
      musicDir = path.resolve(arg);
    }
  }

  return { musicDir, force, concurrency };
}

// ─────────────────────────────────────────────────────────────
//  Main
// ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { musicDir, force, concurrency } = parseArgs(process.argv);

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   🔍  Vault Library Scanner                  ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  try {
    const result = await scanLibrary({
      musicDir,
      forceRescan:  force,
      concurrency,
    });

    // Exit with non-zero code if there were errors (useful for CI / cron jobs)
    if (result.errors > 0 && result.processed === 0) {
      console.error('\n❌ Scan failed — no tracks were processed successfully.');
      process.exit(1);
    }

    console.log('\n✅ Library scan complete!');
    console.log(`   Run the server and open the PWA to see your library.\n`);

  } catch (err) {
    console.error('\n❌ Fatal scan error:', err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
