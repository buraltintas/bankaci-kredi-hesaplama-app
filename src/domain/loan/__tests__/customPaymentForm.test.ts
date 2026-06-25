import {
  buildCustomPaymentsFromRows,
  formatCustomPaymentsSummary,
} from '../customPaymentForm';

describe('customPaymentForm', () => {
  it('builds custom payments from multiple UI rows', () => {
    expect(
      buildCustomPaymentsFromRows(
        [
          { installmentNo: '1', amount: '10.000' },
          { installmentNo: '10', amount: '50.000' },
        ],
        18
      )
    ).toEqual([
      { installmentNo: 1, amount: 10000 },
      { installmentNo: 10, amount: 50000 },
    ]);
  });

  it('rejects duplicate and invalid rows', () => {
    expect(() => buildCustomPaymentsFromRows([], 12)).toThrow('En az');
    expect(() =>
      buildCustomPaymentsFromRows([{ installmentNo: '13', amount: '10.000' }], 12)
    ).toThrow('1 ile vade');
    expect(() =>
      buildCustomPaymentsFromRows(
        [
          { installmentNo: '1', amount: '10.000' },
          { installmentNo: '1', amount: '20.000' },
        ],
        12
      )
    ).toThrow('birden fazla');
    expect(() =>
      buildCustomPaymentsFromRows([{ installmentNo: '1', amount: '-10.000' }], 12)
    ).toThrow('pozitif');
    expect(() =>
      buildCustomPaymentsFromRows([{ installmentNo: '1', amount: '0' }], 12)
    ).toThrow('pozitif');
  });

  it('formats custom payments one row at a time', () => {
    expect(
      formatCustomPaymentsSummary([
        { installmentNo: 10, amount: 50000 },
        { installmentNo: 1, amount: 10000 },
      ])
    ).toBe('1. taksit: 10.000,00 TL\n10. taksit: 50.000,00 TL');
  });
});
