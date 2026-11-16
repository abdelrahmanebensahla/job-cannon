/**
 * The digest configuration the harness evaluates.
 *
 * These two numbers live as local constants inside
 * app/api/cron/daily-digest/route.ts, which the runner cannot import (it is a
 * Next route with DB and email side effects). They are mirrored here instead
 * of refactored out, so the eval work changes no production file.
 * tests/eval-runner.test.ts reads the route source and fails if either drifts.
 */
export const DIGEST_POOL = 30;
export const DIGEST_TOP_N = 10;

export const DIGEST_ROUTE_PATH = 'app/api/cron/daily-digest/route.ts';
