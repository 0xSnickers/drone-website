const monitor = {
  track: vi.fn(),
  pageView: vi.fn(),
  captureError: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  addBreadcrumb: vi.fn(),
  flush: vi.fn(),
  destroy: vi.fn(),
};
vi.mock('monitor-sdk', () => ({ createMonitor: vi.fn(() => monitor) }));
vi.mock('@/config/env', () => ({
  env: {
    isDev: false,
    appName: 'x',
    appEnv: 'test',
    monitor: { endpoint: '/api', appKey: 'pk_test' },
    telemetry: { enabled: false },
  },
}));

describe('telemetry -> monitor-sdk', () => {
  it('forwards events and maps http client errors to API errors', async () => {
    const { createMonitor } = await import('monitor-sdk');
    const { initTelemetry, telemetry } = await import('./telemetry');
    await initTelemetry();
    expect(createMonitor).toHaveBeenCalledWith(
      expect.objectContaining({ appKey: 'pk_test', autoPageview: false, captureHttp: false }),
    );

    telemetry.track('clicked', { a: 1 });
    expect(monitor.track).toHaveBeenCalledWith('clicked', { a: 1 });

    telemetry.captureError(new Error('Request failed'), {
      source: 'api_request_failed',
      method: 'get',
      url: '/projects?page=1',
      status: 500,
    });
    const [error, , options] = monitor.captureError.mock.calls[0]!;
    expect((error as Error).message).toBe('GET /projects 500');
    expect(options).toEqual({ type: 'api' });

    const plain = new Error('render failed');
    telemetry.captureError(plain, { source: 'error_boundary' });
    expect(monitor.captureError).toHaveBeenLastCalledWith(plain, { source: 'error_boundary' });
  });
});
