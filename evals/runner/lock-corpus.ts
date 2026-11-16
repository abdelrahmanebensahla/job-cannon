import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { createLock, LOCK_PATH } from './snapshot';

/**
 * Writes evals/golden/corpus.lock.json for the corpus at a given commit.
 *
 *   npm run eval:lock -- <commit> <tag>
 *
 * Re-locking invalidates every label and baseline made against the old
 * corpus, so this is a deliberate act, not something a run does on its own.
 * Create and push the tag yourself: `git tag <tag> <commit> && git push origin <tag>`.
 */
const [commit, tag] = process.argv.slice(2);
if (!commit || !tag) {
  console.error('usage: npm run eval:lock -- <commit> <tag>');
  process.exit(2);
}

const lock = createLock(commit, tag);
mkdirSync(path.dirname(LOCK_PATH), { recursive: true });
writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n', 'utf8');
console.log(`Locked ${lock.count} jobs at ${lock.commit.slice(0, 7)} (sha256 ${lock.sha256.slice(0, 12)}…)`);
