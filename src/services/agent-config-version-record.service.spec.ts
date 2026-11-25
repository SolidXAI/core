import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AgentConfigVersionRecordService } from './agent-config-version-record.service';
import { ChatterMessageRepository } from '../repository/chatter-message.repository';

describe('agent tool comparison diffs', () => {
    let service: AgentConfigVersionRecordService;
    let row: any;
    let query: any;
    beforeEach(() => {
        row = { id: '7', status: 'changed', left: { label: 'Tool', summary: 'No approval required' }, right: { label: 'Tool', summary: 'Requires approval' } };
        query = {};
        for (const method of ['innerJoin', 'andWhere', 'select', 'addSelect', 'orderBy', 'addOrderBy']) query[method] = jest.fn(() => query);
        query.getRawMany = jest.fn(async () => [
            { createdAt: new Date('2026-11-15T12:00:00Z'), fieldName: 'sourceCode', oldValue: 'original', newValue: 'updated' },
            { createdAt: new Date('2026-11-20T12:00:00Z'), fieldName: 'sourceCode', oldValue: 'updated', newValue: 'later edit' },
        ]);
        service = Object.create(AgentConfigVersionRecordService.prototype);
        Object.assign(service, { moduleRef: { get: (token: any) => token === ChatterMessageRepository
            ? { createSecurityRuleAwareQueryBuilder: async () => query }
            : { findOne: async () => ({ id: 7, sourceCode: 'later edit', name: 'Tool' }) } } });
        jest.spyOn(service, 'getComparison').mockImplementation(async () => ({
            versions: { left: { createdAt: '2026-11-14T12:00:00Z' }, right: { createdAt: '2026-11-16T12:00:00Z' } },
            sections: { tools: { rows: [row] } },
        } as any));
    });

    it('returns approval and historical source differences, excluding later edits', async () => {
        const diff = await service.getComparisonDiff(1, 2, 3, 'tool:7');
        expect(diff.rows).toEqual(expect.arrayContaining([
            { id: 'requiresApproval', title: 'Requires approval', oldValue: 'false', newValue: 'true' },
            { id: 'sourceCode', title: 'Source code', oldValue: 'original', newValue: 'updated' },
        ]));
    });
    it.each(['left', 'right'])('leaves the %s side empty when the tool is absent', async (side) => {
        row[side] = null;
        row.status = side === 'left' ? 'added' : 'removed';
        const diff = await service.getComparisonDiff(1, 2, 3, 'tool:7');
        expect(diff.rows.find((item) => item.id === 'sourceCode')[side === 'left' ? 'oldValue' : 'newValue']).toBe('');
    });
    it.each(['tool:8', 'tool:7'])('rejects unrelated or unchanged tools before loading content (%s)', async (key) => {
        row.status = 'matched';
        await expect(service.getComparisonDiff(1, 2, 3, key)).rejects.toBeInstanceOf(NotFoundException);
        expect(query.getRawMany).not.toHaveBeenCalled();
    });
    it('preserves comparison authorization before loading tool content', async () => {
        jest.mocked(service.getComparison).mockRejectedValue(new ForbiddenException());
        await expect(service.getComparisonDiff(1, 2, 3, 'tool:7')).rejects.toBeInstanceOf(ForbiddenException);
        expect(query.getRawMany).not.toHaveBeenCalled();
    });
    it.each(['tool:0', 'tool:-1', 'tool:9007199254740992', 'other:7'])('rejects invalid diff key %s', async (key) => {
        await expect(service.getComparisonDiff(1, 2, 3, key)).rejects.toBeInstanceOf(BadRequestException);
        expect(service.getComparison).not.toHaveBeenCalled();
    });
});
