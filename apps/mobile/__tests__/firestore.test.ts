import { ensureUserProfile, saveProfileName } from '@/lib/firestore';

const USER = { uid: 'u1', email: 'Jane@Example.com', displayName: 'Jane Doe' };

function res(status: number, body: unknown = {}) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);
}

describe('firestore profile helper', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'key';
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = 'proj.firebaseapp.com';
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'proj';
    (globalThis as any).fetch = fetchMock;
    fetchMock.mockReset();
  });

  test('does nothing when the profile already exists', async () => {
    fetchMock.mockReturnValueOnce(res(200));
    await expect(ensureUserProfile(USER, 'tok')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://firestore.googleapis.com/v1/projects/proj/databases/(default)/documents/users/u1');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  test('creates a plain USER profile when missing', async () => {
    fetchMock.mockReturnValueOnce(res(404)).mockReturnValueOnce(res(200));
    await expect(ensureUserProfile(USER, 'tok')).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toContain('/documents/users?documentId=u1');
    const fields = JSON.parse(init.body).fields;
    // The security rules only allow exactly this shape: never a role other than USER.
    expect(fields.role.stringValue).toBe('USER');
    expect(fields.email.stringValue).toBe('jane@example.com');
    expect(fields.name.stringValue).toBe('Jane Doe');
    expect(fields.isBanned.booleanValue).toBe(false);
    expect(fields.isEmailVerified.booleanValue).toBe(false);
    expect(Object.keys(fields).sort()).toEqual(
      ['avatarUrl', 'createdAt', 'email', 'id', 'isBanned', 'isEmailVerified', 'mfaEnabled', 'name', 'role', 'updatedAt'],
    );
  });

  test('never throws: failures report false', async () => {
    fetchMock.mockReturnValueOnce(res(403));
    await expect(ensureUserProfile(USER, 'tok')).resolves.toBe(false);
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    await expect(ensureUserProfile(USER, 'tok')).resolves.toBe(false);
    await expect(saveProfileName('u1', 'New', 'tok')).resolves.toBe(false);
  });

  test('saveProfileName only updates name and updatedAt', async () => {
    fetchMock.mockReturnValueOnce(res(200));
    await expect(saveProfileName('u1', 'New Name', 'tok')).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('PATCH');
    expect(url).toContain('updateMask.fieldPaths=name');
    expect(url).toContain('updateMask.fieldPaths=updatedAt');
    expect(Object.keys(JSON.parse(init.body).fields).sort()).toEqual(['name', 'updatedAt']);
  });
});
