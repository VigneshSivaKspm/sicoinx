import { ApiError, request, setTokenProvider, setUnauthorizedHandler } from '@/api/client';

function respond(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'status',
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);
}

describe('Firebase token provider', () => {
  const fetchMock = jest.fn();
  const handler = jest.fn();

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test:5000';
    (globalThis as any).fetch = fetchMock;
    fetchMock.mockReset();
    handler.mockReset();
    setUnauthorizedHandler(handler);
    setTokenProvider(null);
  });

  test('every request asks the provider for a current token', async () => {
    const provider = jest.fn().mockResolvedValueOnce('tok-1').mockResolvedValueOnce('tok-2');
    setTokenProvider(provider, { refreshable: true });
    fetchMock.mockReturnValue(respond(200, { success: true, data: { ok: true } }));

    await request('/wallet');
    await request('/wallet');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-1');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer tok-2');
  });

  test('a 401 is retried once with a force-refreshed token and then succeeds', async () => {
    const provider = jest.fn(async (force?: boolean) => (force ? 'fresh' : 'stale'));
    setTokenProvider(provider, { refreshable: true });
    fetchMock
      .mockReturnValueOnce(respond(401, { success: false, error: { code: 'SESSION_EXPIRED', message: 'expired' } }))
      .mockReturnValueOnce(respond(200, { success: true, data: { ok: 1 } }));

    await expect(request('/wallet')).resolves.toEqual({ ok: 1 });

    expect(provider).toHaveBeenNthCalledWith(1, false);
    expect(provider).toHaveBeenNthCalledWith(2, true);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh');
    expect(handler).not.toHaveBeenCalled();
  });

  test('a 401 that survives the refresh ends the session exactly once', async () => {
    setTokenProvider(async () => 'tok', { refreshable: true });
    fetchMock.mockReturnValue(respond(401, { success: false, error: { code: 'INVALID_TOKEN', message: 'no' } }));

    await expect(request('/wallet')).rejects.toMatchObject({ status: 401, code: 'INVALID_TOKEN' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('a fixed API token is not retried', async () => {
    setTokenProvider(async () => 'fixed');
    fetchMock.mockReturnValue(respond(401, { success: false, error: { code: 'SESSION_EXPIRED', message: 'x' } }));
    await expect(request('/wallet')).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('a provider that throws (offline refresh) surfaces as a network error, not a sign-out', async () => {
    setTokenProvider(async () => {
      throw new Error('network');
    }, { refreshable: true });
    await expect(request('/wallet')).rejects.toMatchObject({ code: 'NETWORK' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  test('public endpoints skip the provider', async () => {
    const provider = jest.fn().mockResolvedValue('tok');
    setTokenProvider(provider, { refreshable: true });
    fetchMock.mockReturnValue(respond(200, { success: true, data: {} }));
    await request('/trade/rates', { auth: false });
    expect(provider).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  test('email-not-verified from the API keeps its code for the verification screen', async () => {
    setTokenProvider(async () => 'tok', { refreshable: true });
    fetchMock.mockReturnValue(
      respond(403, { success: false, error: { code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email address.' } }),
    );
    await expect(request('/auth/me')).rejects.toMatchObject({ status: 403, code: 'EMAIL_NOT_VERIFIED' });
    expect(handler).not.toHaveBeenCalled();
  });
});
