import { logger } from "./logger";

/**
 * Runs `task` repeatedly forever. On success, waits `intervalMs` before the
 * next run. On failure, backs off (doubling up to `maxBackoffMs`) instead
 * of hammering an offline backend or device — this is what makes the
 * agent tolerate the Hikvision terminal or the internet link being down
 * without crashing or spamming logs/retries. Call the returned `stop()`
 * during shutdown to let an in-flight run finish and prevent scheduling
 * another.
 */
export function startRetryLoop(
  name: string,
  intervalMs: number,
  task: () => Promise<void>,
  opts: { maxBackoffMs?: number } = {}
) {
  const maxBackoffMs = opts.maxBackoffMs ?? intervalMs * 10;
  let stopped = false;
  let backoff = intervalMs;
  let timer: NodeJS.Timeout | null = null;

  async function run() {
    if (stopped) return;
    let nextDelay = intervalMs;
    try {
      await task();
      backoff = intervalMs;
    } catch (err) {
      // Log and schedule with the SAME value - previously the log printed
      // the pre-doubled backoff while the actual setTimeout used the
      // doubled one, so the reported retry time was always half of what
      // really happened.
      nextDelay = backoff;
      logger.error(`${name} failed, will retry`, { error: (err as Error).message, nextRetryMs: nextDelay });
      backoff = Math.min(backoff * 2, maxBackoffMs);
    } finally {
      if (!stopped) timer = setTimeout(run, nextDelay);
    }
  }

  timer = setTimeout(run, 0);

  return function stop() {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
