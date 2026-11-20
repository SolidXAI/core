import { chooseMultipartPartSize, DEFAULT_MULTIPART_PART_SIZE } from './multipart-part-size';

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

describe('chooseMultipartPartSize', () => {
  it('uses the default part size when the size is unknown or small', () => {
    expect(chooseMultipartPartSize()).toBe(DEFAULT_MULTIPART_PART_SIZE);
    expect(chooseMultipartPartSize(0)).toBe(DEFAULT_MULTIPART_PART_SIZE);
    expect(chooseMultipartPartSize(50 * MiB)).toBe(DEFAULT_MULTIPART_PART_SIZE);
    expect(chooseMultipartPartSize(60 * GiB)).toBe(DEFAULT_MULTIPART_PART_SIZE);
  });

  it('grows the part size so very large files stay within the 10,000 part limit', () => {
    for (const size of [100 * GiB, 500 * GiB, 1024 * GiB, 5 * 1024 * GiB]) {
      const partSize = chooseMultipartPartSize(size);
      expect(Math.ceil(size / partSize)).toBeLessThanOrEqual(10000);
      expect(partSize % MiB).toBe(0);
    }
  });

  it('would fail at the old fixed 8 MiB part size for a 100 GiB file', () => {
    expect(Math.ceil((100 * GiB) / DEFAULT_MULTIPART_PART_SIZE)).toBeGreaterThan(10000);
    expect(chooseMultipartPartSize(100 * GiB)).toBeGreaterThan(DEFAULT_MULTIPART_PART_SIZE);
  });
});
