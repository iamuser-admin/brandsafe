/**
 * Tiny in-process job runner. The app runs as a long-lived Node server
 * (`next dev` / `next start`), so fire-and-forget promises survive after the
 * HTTP response is sent. We cap concurrency so parallel uploads / reviews don't
 * hammer the TwelveLabs + Anthropic rate limits.
 */

const MAX_CONCURRENT = 3;
let active = 0;
const queue: Array<() => void> = [];

function pump() {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const next = queue.shift()!;
    next();
  }
}

/** Schedule background work; returns immediately (non-blocking). */
export function enqueue(label: string, work: () => Promise<void>): void {
  const run = () => {
    active++;
    work()
      .catch((err) => {
        console.error(`[job:${label}] failed`, err);
      })
      .finally(() => {
        active--;
        pump();
      });
  };
  queue.push(run);
  pump();
}
