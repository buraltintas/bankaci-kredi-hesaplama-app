describe('apiRequest', () => {
  const originalEnv = process.env.EXPO_PUBLIC_BANKACI_API_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_BANKACI_API_URL = originalEnv;
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('adds the member bearer token and decodes JSON', async () => {
    process.env.EXPO_PUBLIC_BANKACI_API_URL = 'https://api.example.com/';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'user-1' }),
    });
    global.fetch = fetchMock;
    let apiRequest!: typeof import('./client').apiRequest;
    jest.isolateModules(() => {
      apiRequest = jest.requireActual<typeof import('./client')>('./client').apiRequest;
    });

    await expect(apiRequest('/v1/me', { token: 'secret-token' })).resolves.toEqual({ id: 'user-1' });
    const [, request] = fetchMock.mock.calls[0];
    expect(request.headers.get('Authorization')).toBe('Bearer secret-token');
  });

  it('fails safely when the API URL is not configured', async () => {
    delete process.env.EXPO_PUBLIC_BANKACI_API_URL;
    let apiRequest!: typeof import('./client').apiRequest;
    jest.isolateModules(() => {
      apiRequest = jest.requireActual<typeof import('./client')>('./client').apiRequest;
    });
    await expect(apiRequest('/v1/me')).rejects.toMatchObject({ code: 'api_not_configured' });
  });
});
