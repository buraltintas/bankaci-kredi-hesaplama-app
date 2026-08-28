import { whatsappPhone } from './phone';

describe('whatsappPhone', () => {
  it.each([
    ['0530 607 08 07', '905306070807'],
    ['5306070807', '905306070807'],
    ['+44 7700 900123', '447700900123'],
    ['0049 151 23456789', '4915123456789'],
  ])('normalizes %s for wa.me', (input, expected) => {
    expect(whatsappPhone(input)).toBe(expected);
  });
});
