import { firebaseErrorCode, firebaseErrorMessage } from '@/lib/firebaseErrors';
import { firstNameOf, greetingFor, initialsOf, staffRoleLabel } from '@/lib/profile';

describe('profile helpers', () => {
  test('initialsOf', () => {
    expect(initialsOf('Jane Doe')).toBe('JD');
    expect(initialsOf('Chief System Administrator')).toBe('CA');
    expect(initialsOf('madonna')).toBe('M');
    expect(initialsOf('admin123@gmail.com')).toBe('A');
    expect(initialsOf('first.last@example.com')).toBe('FL');
    expect(initialsOf('')).toBe('?');
    expect(initialsOf(null)).toBe('?');
  });

  test('greetingFor', () => {
    expect(greetingFor(5)).toBe('Good morning');
    expect(greetingFor(12)).toBe('Good afternoon');
    expect(greetingFor(16)).toBe('Good afternoon');
    expect(greetingFor(17)).toBe('Good evening');
    expect(greetingFor(23)).toBe('Good evening');
  });

  test('firstNameOf', () => {
    expect(firstNameOf('jane doe')).toBe('Jane');
    expect(firstNameOf('admin123@gmail.com')).toBe('Admin123');
    expect(firstNameOf(undefined)).toBe('there');
  });

  test('staffRoleLabel hides customers and names staff roles', () => {
    expect(staffRoleLabel('USER')).toBeNull();
    expect(staffRoleLabel(undefined)).toBeNull();
    expect(staffRoleLabel('SUPER_ADMIN')).toBe('Super Admin');
    expect(staffRoleLabel('SOME_NEW_ROLE')).toBe('Some New Role');
  });
});

describe('firebaseErrors', () => {
  test('translates known codes', () => {
    expect(firebaseErrorMessage({ code: 'auth/invalid-credential' }, 'x')).toBe('Invalid email or password.');
    expect(firebaseErrorMessage({ code: 'auth/email-already-in-use' }, 'x')).toMatch(/already exists/);
    expect(firebaseErrorMessage({ code: 'auth/too-many-requests' }, 'x')).toMatch(/Too many attempts/);
    expect(firebaseErrorMessage({ code: 'auth/network-request-failed' }, 'x')).toMatch(/Network error/);
  });

  test('never leaks raw Firebase text for unknown errors', () => {
    const raw = new Error('Firebase: Error (auth/some-new-code).');
    expect(firebaseErrorMessage(raw, 'Sign-in failed.')).toBe('Sign-in failed.');
  });

  test('firebaseErrorCode tolerates anything', () => {
    expect(firebaseErrorCode({ code: 'auth/x' })).toBe('auth/x');
    expect(firebaseErrorCode(null)).toBe('unknown');
    expect(firebaseErrorCode('boom')).toBe('unknown');
  });
});
