import { BadRequestException, ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { TEST_DATA_ENDPOINT_FLAG, TestDataController } from './test-data.controller';

describe('TestDataController', () => {
  const summary = { rolesProcessed: 0, usersProcessed: 0, data: { created: 1, updated: 0, skipped: 0 } };
  let loadTestData: jest.Mock;
  let controller: TestDataController;
  let originalFlag: string | undefined;

  beforeEach(() => {
    originalFlag = process.env[TEST_DATA_ENDPOINT_FLAG];
    process.env[TEST_DATA_ENDPOINT_FLAG] = 'true';
    loadTestData = jest.fn(async () => summary);
    controller = new TestDataController({ loadTestData } as any);
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[TEST_DATA_ENDPOINT_FLAG];
    else process.env[TEST_DATA_ENDPOINT_FLAG] = originalFlag;
  });

  it('returns the load summary', async () => {
    const testing = { data: [] };
    await expect(controller.load({ testing })).resolves.toBe(summary);
    expect(loadTestData).toHaveBeenCalledWith(testing);
  });

  it('responds 404 and loads nothing when the endpoint flag is off', async () => {
    process.env[TEST_DATA_ENDPOINT_FLAG] = 'false';

    await expect(controller.load({ testing: {} })).rejects.toBeInstanceOf(NotFoundException);
    expect(loadTestData).not.toHaveBeenCalled();
  });

  it('responds 404 when the flag is not set', async () => {
    delete process.env[TEST_DATA_ENDPOINT_FLAG];

    await expect(controller.load({ testing: {} })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('responds 400 when the body has no testing object', async () => {
    await expect(controller.load({} as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.load(undefined as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(loadTestData).not.toHaveBeenCalled();
  });

  it('responds 409 to a second load while one is running, and accepts a new one afterwards', async () => {
    let finish!: (value: typeof summary) => void;
    loadTestData.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));

    const first = controller.load({ testing: { data: [] } });
    await expect(controller.load({ testing: { data: [] } })).rejects.toBeInstanceOf(ConflictException);
    finish(summary);
    await first;

    await expect(controller.load({ testing: { data: [] } })).resolves.toBe(summary);
  });

  it('releases the lock when a load fails', async () => {
    loadTestData.mockRejectedValueOnce(new Error('boom'));
    await expect(controller.load({ testing: { data: [] } })).rejects.toBeInstanceOf(UnprocessableEntityException);

    await expect(controller.load({ testing: { data: [] } })).resolves.toBe(summary);
  });

  it('responds 422 with the message when the load fails', async () => {
    loadTestData.mockRejectedValueOnce(new Error('Test data relation not found: author.authorCode=A9'));

    const failure = controller.load({ testing: { data: [] } });
    await expect(failure).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(failure).rejects.toThrow('Test data relation not found: author.authorCode=A9');
  });
});
