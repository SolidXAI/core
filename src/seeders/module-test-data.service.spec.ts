import { NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ModuleTestDataService } from './module-test-data.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';

type Row = Record<string, any> & { id?: number };

function makeRepo() {
  const rows: Row[] = [];
  let nextId = 1;
  return {
    rows,
    findOne: jest.fn(async ({ where }: { where: Record<string, any> }) =>
      rows.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null,
    ),
    create: (payload: Row) => ({ ...payload }),
    merge: (existing: Row, payload: Row) => Object.assign(existing, payload),
    save: jest.fn(async (entity: Row) => {
      if (entity.id === undefined) {
        entity.id = nextId++;
        rows.push(entity);
      }
      return entity;
    }),
  };
}

const modelDefs: Record<string, any> = {
  author: {
    singularName: 'author',
    internationalisation: false,
    userKeyField: { name: 'authorCode' },
    fields: [
      { name: 'authorCode', type: 'text' },
      { name: 'name', type: 'text' },
    ],
  },
  book: {
    singularName: 'book',
    internationalisation: false,
    userKeyField: { name: 'bookCode' },
    fields: [
      { name: 'bookCode', type: 'text' },
      { name: 'title', type: 'text' },
      { name: 'author', type: 'relation', relationType: 'many-to-one', relationCoModelSingularName: 'author' },
      { name: 'coAuthors', type: 'relation', relationType: 'many-to-many', relationCoModelSingularName: 'author' },
    ],
  },
  note: {
    singularName: 'note',
    internationalisation: false,
    userKeyField: null,
    fields: [{ name: 'text', type: 'text' }],
  },
};

describe('ModuleTestDataService.loadTestData', () => {
  let authorRepo: ReturnType<typeof makeRepo>;
  let bookRepo: ReturnType<typeof makeRepo>;
  let noteRepo: ReturnType<typeof makeRepo>;
  let findOneBySingularName: jest.Mock;
  let relationBuilder: { relation: jest.Mock; of: jest.Mock; loadMany: jest.Mock; addAndRemove: jest.Mock };
  let service: ModuleTestDataService;

  beforeEach(() => {
    authorRepo = makeRepo();
    bookRepo = makeRepo();
    noteRepo = makeRepo();

    findOneBySingularName = jest.fn(async (name: string) => {
      const def = modelDefs[name];
      if (!def) throw new NotFoundException(name);
      return def;
    });
    relationBuilder = {
      relation: jest.fn(() => relationBuilder),
      of: jest.fn(() => relationBuilder),
      loadMany: jest.fn(async () => []),
      addAndRemove: jest.fn(async () => undefined),
    };
    const entityManager = { createQueryBuilder: () => relationBuilder };

    const repos: Record<string, any> = {
      AuthorRepository: authorRepo,
      BookRepository: bookRepo,
      NoteRepository: noteRepo,
    };
    const moduleRef = {
      get: (token: any) => {
        if (token === ModelMetadataService) return { findOneBySingularName };
        if (token === EntityManager) return entityManager;
        throw new Error(`unexpected token ${String(token)}`);
      },
    };
    const discoveryService = {
      getProviders: () => Object.entries(repos).map(([name, instance]) => ({ name, instance })),
    };
    const i18n = { resolveDefaultLocaleName: () => 'en-US' };

    service = new ModuleTestDataService(moduleRef as any, discoveryService as any, {} as any, i18n as any);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  const spec = () => ({
    data: [
      { modelUserKey: 'author', recUserKeyValue: 'ann', data: { authorCode: 'A1', name: 'Ann' } },
      { modelUserKey: 'book', recUserKeyValue: 'first', data: { bookCode: 'B1', title: 'First', authorUserKey: 'A1' } },
    ],
  });

  it('creates records, resolving many-to-one relations by user key', async () => {
    const summary = await service.loadTestData(spec());

    expect(summary.data).toEqual({ created: 2, updated: 0, skipped: 0 });
    expect(authorRepo.rows).toHaveLength(1);
    expect(bookRepo.rows).toHaveLength(1);
    expect(bookRepo.rows[0].author).toEqual(expect.objectContaining({ authorCode: 'A1' }));
  });

  it('is idempotent: loading the same spec twice updates instead of duplicating', async () => {
    await service.loadTestData(spec());
    const second = await service.loadTestData(spec());

    expect(second.data).toEqual({ created: 0, updated: 2, skipped: 0 });
    expect(authorRepo.rows).toHaveLength(1);
    expect(bookRepo.rows).toHaveLength(1);
  });

  it('applies many-to-many relations from <field>UserKeys', async () => {
    await service.loadTestData({
      data: [
        { modelUserKey: 'author', recUserKeyValue: 'ann', data: { authorCode: 'A1', name: 'Ann' } },
        { modelUserKey: 'book', recUserKeyValue: 'first', data: { bookCode: 'B1', title: 'First', coAuthorsUserKeys: ['A1'] } },
      ],
    });

    expect(relationBuilder.addAndRemove).toHaveBeenCalledWith([authorRepo.rows[0].id], []);
    expect(bookRepo.rows[0]).not.toHaveProperty('coAuthors');
    expect(bookRepo.rows[0]).not.toHaveProperty('coAuthorsUserKeys');
  });

  it('skips a record whose data has no user key, even when recUserKeyValue is set', async () => {
    const summary = await service.loadTestData({
      data: [{ modelUserKey: 'author', recUserKeyValue: 'ann', data: { name: 'Nobody' } }],
    });

    expect(summary.data).toEqual({ created: 0, updated: 0, skipped: 1 });
    expect(authorRepo.rows).toHaveLength(0);
  });

  it('inserts records for a model without a user key field', async () => {
    await service.loadTestData({ data: [{ modelUserKey: 'note', recUserKeyValue: 'n', data: { text: 'hi' } }] });
    expect(noteRepo.rows).toHaveLength(1);
  });

  it('loads only the models the data touches, and only relations the data sets', async () => {
    await service.loadTestData({
      data: [{ modelUserKey: 'book', recUserKeyValue: 'first', data: { bookCode: 'B1', title: 'First' } }],
    });

    expect(findOneBySingularName).toHaveBeenCalledTimes(1);
    expect(findOneBySingularName).toHaveBeenCalledWith('book', expect.anything());
  });

  it('rejects a modelUserKey that the application does not know', async () => {
    await expect(
      service.loadTestData({ data: [{ modelUserKey: 'missing', recUserKeyValue: 'x', data: {} }] }),
    ).rejects.toThrow('Test data modelUserKey not found in application metadata: missing');
  });

  it('does not mislabel other lookup failures as a missing model', async () => {
    findOneBySingularName.mockRejectedValueOnce(new Error('connection refused'));

    await expect(
      service.loadTestData({ data: [{ modelUserKey: 'author', recUserKeyValue: 'ann', data: { authorCode: 'A1' } }] }),
    ).rejects.toThrow('connection refused');
  });

  it('rejects a data entry without modelUserKey', async () => {
    await expect(service.loadTestData({ data: [{ data: {} } as any] })).rejects.toThrow('modelUserKey');
  });
});
