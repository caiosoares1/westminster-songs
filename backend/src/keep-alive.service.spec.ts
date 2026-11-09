import { keepAliveConfig, KeepAliveService } from './keep-alive.service';

describe('keepAliveConfig', () => {
  it('is off outside Render', () => {
    expect(keepAliveConfig({})).toBeNull();
  });

  it('uses the URL Render provides, every 10 minutes', () => {
    expect(
      keepAliveConfig({ RENDER_EXTERNAL_URL: 'https://api.onrender.com' }),
    ).toEqual({ url: 'https://api.onrender.com', intervalMs: 600_000 });
  });

  it('can be disabled or tuned', () => {
    const base = { RENDER_EXTERNAL_URL: 'https://api.onrender.com' };
    expect(keepAliveConfig({ ...base, KEEP_ALIVE: 'false' })).toBeNull();
    expect(
      keepAliveConfig({ ...base, KEEP_ALIVE_MINUTES: '5' })?.intervalMs,
    ).toBe(300_000);
    // Never 15+ minutes: Render sleeps after 15 without requests.
    expect(
      keepAliveConfig({ ...base, KEEP_ALIVE_MINUTES: '30' })?.intervalMs,
    ).toBe(600_000);
  });
});

describe('KeepAliveService', () => {
  const OLD_ENV = { ...process.env };
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('Hello World!'));
  });
  afterEach(() => {
    jest.useRealTimers();
    fetchMock.mockRestore();
    process.env = { ...OLD_ENV };
  });

  it('pings its public URL on an interval and stops on shutdown', () => {
    process.env.RENDER_EXTERNAL_URL = 'https://api.onrender.com';
    const service = new KeepAliveService();
    service.onApplicationBootstrap();

    jest.advanceTimersByTime(10 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.onrender.com');
    jest.advanceTimersByTime(10 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    service.onApplicationShutdown();
    jest.advanceTimersByTime(30 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never throws when the ping fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(
      new KeepAliveService().ping('https://api.onrender.com'),
    ).resolves.toBeUndefined();
  });
});
