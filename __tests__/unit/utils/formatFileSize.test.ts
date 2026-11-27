import { formatFileSize } from '../../../src/utils/formatFileSize';

describe('formatFileSize', () => {
  it.each([
    [0, '0 B'], [500, '500.00 B'], [1024, '1.00 KB'],
    [2.5 * 1024 ** 2, '2.50 MB'], [4.2 * 1024 ** 3, '4.20 GB'],
    [1024 ** 4, '1.00 TB'],
  ])('formats %s bytes', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
  it.each([-1, NaN, Infinity, -Infinity])('normalizes invalid size %s', bytes => {
    expect(formatFileSize(bytes)).toBe('0 B');
  });
});
