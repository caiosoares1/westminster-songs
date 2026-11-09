import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';

const DEFAULT_INTERVAL_MINUTES = 10;

/**
 * Render's free plan stops the service after 15 minutes without inbound
 * requests. On Render (RENDER_EXTERNAL_URL is set by the platform) the API
 * calls its own public URL every 10 minutes, which goes through Render's
 * proxy and counts as inbound traffic, so it never sleeps.
 *
 * KEEP_ALIVE=false disables it; KEEP_ALIVE_URL / KEEP_ALIVE_MINUTES override.
 */
@Injectable()
export class KeepAliveService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(KeepAliveService.name);
  private timer: NodeJS.Timeout | null = null;

  onApplicationBootstrap(): void {
    const config = keepAliveConfig(process.env);
    if (!config) {
      return;
    }

    this.logger.log(
      `Pinging ${config.url} every ${config.intervalMs / 60_000} min`,
    );
    this.timer = setInterval(
      () => void this.ping(config.url),
      config.intervalMs,
    );
    // Doesn't keep the process alive on its own (clean shutdown).
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async ping(url: string): Promise<void> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        this.logger.warn(`Keep-alive got HTTP ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(
        `Keep-alive failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export function keepAliveConfig(
  env: NodeJS.ProcessEnv,
): { url: string; intervalMs: number } | null {
  if (env.KEEP_ALIVE?.trim().toLowerCase() === 'false') {
    return null;
  }

  const url = (env.KEEP_ALIVE_URL || env.RENDER_EXTERNAL_URL)?.trim();
  if (!url) {
    return null;
  }

  const minutes = Number(env.KEEP_ALIVE_MINUTES);
  const intervalMinutes =
    Number.isFinite(minutes) && minutes >= 1 && minutes <= 14
      ? minutes
      : DEFAULT_INTERVAL_MINUTES;
  return { url, intervalMs: intervalMinutes * 60_000 };
}
