import {
  validateBankDetails,
  validateCoinAmount,
  validateEmail,
  validateKyc,
  normalizeIdNumber,
  validateNewPassword,
  validateTicket,
} from '@/lib/validation';

describe('validation (mirrors packages/shared schemas)', () => {
  test('email', () => {
    expect(validateEmail('a@b.co')).toBeNull();
    expect(validateEmail('nope')).not.toBeNull();
    expect(validateEmail('  ')).not.toBeNull();
  });

  test('new password needs 8 chars, uppercase and a digit', () => {
    expect(validateNewPassword('Short1')).toMatch(/8 characters/);
    expect(validateNewPassword('alllowercase1')).toMatch(/uppercase/);
    expect(validateNewPassword('NoNumbersHere')).toMatch(/number/);
    expect(validateNewPassword('UserSecurePass123!')).toBeNull();
  });

  test('coin amount limits', () => {
    expect(validateCoinAmount('')).not.toBeNull();
    expect(validateCoinAmount('0')).not.toBeNull();
    expect(validateCoinAmount('5', { min: '10' })).toMatch(/Minimum/);
    expect(validateCoinAmount('500', { max: '100' })).toMatch(/Maximum/);
    expect(validateCoinAmount('60', { available: '50.5' })).toMatch(/exceeds/);
    expect(validateCoinAmount('50.5', { available: '50.500000' })).toBeNull();
    expect(validateCoinAmount('10', { min: '1', max: '100000', available: '550' })).toBeNull();
  });

  test('bank details', () => {
    const ok = { accountName: 'Jane Doe', bankName: 'HDFC Bank', accountNumber: '12345678901', ifsc: 'hdfc0001234' };
    expect(validateBankDetails(ok)).toBeNull();
    expect(validateBankDetails({ ...ok, ifsc: 'HDFC1001234' })).toMatch(/IFSC/);
    expect(validateBankDetails({ ...ok, accountNumber: '1234' })).toMatch(/account number/);
    expect(validateBankDetails({ ...ok, accountName: ' ' })).toMatch(/holder/);
  });

  test('kyc and ticket', () => {
    const kyc = { fullName: 'Jane Doe', idType: 'PAN' as const, idNumber: 'abcde1234f', hasFront: true, hasBack: false };
    expect(validateKyc({ ...kyc, fullName: 'Jo' })).toMatch(/Full name/);
    expect(validateKyc({ ...kyc, idNumber: ' ' })).toMatch(/Enter your document ID/);
    expect(validateKyc({ ...kyc, idNumber: 'ABCDE12345' })).toMatch(/valid ID number/);
    expect(validateKyc({ ...kyc, hasFront: false })).toMatch(/front/);
    expect(validateKyc(kyc)).toBeNull();
    // Aadhaar: 12 digits (spaces allowed) and the back of the card is mandatory.
    const aadhaar = { ...kyc, idType: 'AADHAAR' as const, idNumber: '1234 5678 9012' };
    expect(validateKyc({ ...aadhaar, idNumber: '1234 5678' })).toMatch(/12-digit/);
    expect(validateKyc(aadhaar)).toMatch(/back/);
    expect(validateKyc({ ...aadhaar, hasBack: true })).toBeNull();
    expect(validateKyc({ ...kyc, idType: 'PASSPORT', idNumber: 'A1234567' })).toBeNull();
    expect(validateKyc({ ...kyc, idType: 'DRIVING_LICENSE', idNumber: 'MH12 20110012345', hasBack: true })).toBeNull();
    expect(normalizeIdNumber('mh12 2011-0012345')).toBe('MH1220110012345');
    expect(validateTicket({ subject: 'Help', message: 'x'.repeat(20) })).toMatch(/Subject/);
    expect(validateTicket({ subject: 'Need help', message: 'short' })).toMatch(/Message/);
    expect(validateTicket({ subject: 'Need help', message: 'x'.repeat(15) })).toBeNull();
  });
});
