import { memberDisplayName } from '../memberDisplayName';

describe('memberDisplayName', () => {
  it('uses the explicitly updated profile name', () => {
    expect(memberDisplayName(' Burak Altıntaş ', 'burak@example.com')).toBe('Burak Altıntaş');
  });

  it('falls back to the email local part', () => {
    expect(memberDisplayName('', 'burak.altintas@example.com')).toBe('burak.altintas');
  });
});
