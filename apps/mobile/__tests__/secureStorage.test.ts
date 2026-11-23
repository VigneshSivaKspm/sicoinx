import { secureStorage, toStoreKey } from '@/lib/secureStorage';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => (mockStore.has(key) ? mockStore.get(key)! : null)),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    // Mirrors the real module's rules so the adapter can't pass with keys the device would reject.
    if (!/^[A-Za-z0-9._-]+$/.test(key)) throw new Error(`Invalid key: ${key}`);
    if (value.length > 2048) throw new Error('Value too large');
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

describe('secureStorage (Firebase auth persistence)', () => {
  beforeEach(() => mockStore.clear());

  test('sanitises Firebase style keys into valid SecureStore keys', () => {
    const key = toStoreKey('firebase:authUser:AIza-key:[DEFAULT]');
    expect(key).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(key).toBe('fb.firebase_authUser_AIza-key__DEFAULT_');
  });

  test('round-trips a small value', async () => {
    await secureStorage.setItem('firebase:authUser:k:[DEFAULT]', '{"uid":"u1"}');
    await expect(secureStorage.getItem('firebase:authUser:k:[DEFAULT]')).resolves.toBe('{"uid":"u1"}');
  });

  test('splits and restores a value larger than the 2 KB SecureStore limit', async () => {
    const big = JSON.stringify({ token: 'x'.repeat(5000), more: 'y'.repeat(900) });
    await secureStorage.setItem('big', big);
    expect(await secureStorage.getItem('big')).toBe(big);
    // 5,900+ characters in chunks of at most 1,800.
    const chunkKeys = [...mockStore.keys()].filter((k) => /^fb\.big\.\d+$/.test(k));
    expect(chunkKeys.length).toBeGreaterThan(3);
    for (const k of chunkKeys) expect(mockStore.get(k)!.length).toBeLessThanOrEqual(1800);
  });

  test('overwriting with a shorter value removes the leftover chunks', async () => {
    await secureStorage.setItem('k', 'a'.repeat(6000));
    await secureStorage.setItem('k', 'short');
    expect(await secureStorage.getItem('k')).toBe('short');
    expect([...mockStore.keys()].filter((key) => key.startsWith('fb.k.')).sort()).toEqual(['fb.k.0', 'fb.k.n']);
  });

  test('removeItem deletes every chunk and the counter', async () => {
    await secureStorage.setItem('k', 'z'.repeat(4000));
    await secureStorage.removeItem('k');
    expect(await secureStorage.getItem('k')).toBeNull();
    expect(mockStore.size).toBe(0);
  });

  test('a missing key reads as null, and an incomplete write reads as signed out', async () => {
    expect(await secureStorage.getItem('nothing')).toBeNull();
    await secureStorage.setItem('k', 'q'.repeat(4000));
    mockStore.delete('fb.k.1');
    expect(await secureStorage.getItem('k')).toBeNull();
  });
});
