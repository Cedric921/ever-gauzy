import '../../core/entities/internal';

import { knex as createKnex, Knex } from 'knex';
import { RequestContext } from '../../core/context';
import { CrudService } from '../../core/crud/crud.service';
import { MultiORMEnum } from '../../core/utils';
import { ActivityService } from './activity.service';

/**
 * The MikroORM daily activity aggregations run on raw knex, which skips MikroORM's soft-delete filter: the
 * activities of a deleted time slot (time slots are soft-deleted by default) were still counted.
 */
describe('ActivityService daily aggregations (MikroORM) leave soft-deleted rows out', () => {
	let db: Knex;

	beforeAll(async () => {
		db = createKnex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
		await db.schema.createTable('employee', (table) => {
			table.string('id').primary();
			table.datetime('deletedAt').nullable();
		});
		await db.schema.createTable('time_slot', (table) => {
			table.string('id').primary();
			table.datetime('deletedAt').nullable();
		});
		await db.schema.createTable('time_slot_time_logs', (table) => {
			table.string('timeSlotId');
			table.string('timeLogId');
		});
		await db.schema.createTable('activity', (table) => {
			table.string('id').primary();
			table.string('tenantId');
			table.string('organizationId');
			table.string('employeeId');
			table.string('projectId').nullable();
			table.string('timeSlotId');
			table.string('date');
			table.string('title');
			table.integer('duration');
			table.datetime('deletedAt').nullable();
		});
		await db('employee').insert([
			{ id: 'employee-1', deletedAt: null },
			{ id: 'employee-deleted', deletedAt: '2026-10-19 09:00:00' }
		]);
		await db('time_slot').insert([
			{ id: 'slot-live', deletedAt: null },
			{ id: 'slot-deleted', deletedAt: '2026-10-19 10:00:00' }
		]);
		await db('time_slot_time_logs').insert([
			{ timeSlotId: 'slot-live', timeLogId: 'log-1' },
			{ timeSlotId: 'slot-deleted', timeLogId: 'log-1' }
		]);
		const activity = (id: string, timeSlotId: string, deletedAt: string | null = null, employeeId = 'employee-1') => ({
			id,
			tenantId: 'tenant-1',
			organizationId: 'org-1',
			employeeId,
			timeSlotId,
			date: '2026-10-19',
			title: 'VS Code',
			duration: 300,
			deletedAt
		});
		await db('activity').insert([
			activity('activity-live', 'slot-live'),
			activity('activity-of-deleted-slot', 'slot-deleted'),
			activity('activity-deleted', 'slot-live', '2026-10-19 11:00:00'),
			// A live activity on a live slot, of a deleted employee
			activity('activity-of-deleted-employee', 'slot-live', null, 'employee-deleted')
		]);
	});

	afterAll(async () => {
		await db?.destroy();
	});

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
	});

	afterEach(() => jest.restoreAllMocks());

	const service = () =>
		new ActivityService(
			{ metadata: { tableName: 'activity' } } as any,
			{ getKnex: () => db } as any,
			// The employee / project lookups the report decorates its rows with
			{ find: jest.fn(async () => []) } as any,
			{ find: jest.fn(async () => []) } as any,
			{} as any
		);

	it.each(['getDailyActivities', 'getDailyActivitiesReport'] as const)('%s counts the live activity only', async (method) => {
		const rows: any[] = await service()[method]({
			organizationId: 'org-1',
			startDate: '2026-10-19',
			endDate: '2026-10-19'
		} as any);

		expect(rows).toHaveLength(1);
		expect(rows[0].employeeId).toBe('employee-1');
		expect(Number(rows[0].sessions)).toBe(1);
		expect(Number(rows[0].duration)).toBe(300);
	});
});

/**
 * The MikroORM daily activity aggregations applied only the tenant, organization, date and employee filters,
 * while the TypeORM query also narrows by project, activity type, title and activity level: a filtered view
 * answered every activity under MikroORM.
 */
describe('ActivityService daily aggregations (MikroORM) apply the request filters', () => {
	let db: Knex;

	beforeAll(async () => {
		db = createKnex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
		await db.schema.createTable('employee', (table) => {
			table.string('id').primary();
			table.datetime('deletedAt').nullable();
		});
		await db.schema.createTable('time_slot', (table) => {
			table.string('id').primary();
			table.integer('overall');
			table.datetime('deletedAt').nullable();
		});
		await db.schema.createTable('time_slot_time_logs', (table) => {
			table.string('timeSlotId');
			table.string('timeLogId');
		});
		await db.schema.createTable('activity', (table) => {
			table.string('id').primary();
			table.string('tenantId');
			table.string('organizationId');
			table.string('employeeId');
			table.string('projectId').nullable();
			table.string('timeSlotId');
			table.string('date');
			table.string('title');
			table.string('type');
			table.integer('duration');
			table.datetime('deletedAt').nullable();
		});
		await db('employee').insert([{ id: 'employee-1', deletedAt: null }]);
		// 540 of 600 seconds active is 90%, 60 of 600 is 10%
		await db('time_slot').insert([
			{ id: 'slot-busy', overall: 540, deletedAt: null },
			{ id: 'slot-idle', overall: 60, deletedAt: null }
		]);
		await db('time_slot_time_logs').insert([
			{ timeSlotId: 'slot-busy', timeLogId: 'log-1' },
			{ timeSlotId: 'slot-idle', timeLogId: 'log-1' }
		]);
		const activity = (id: string, title: string, type: string, projectId: string, timeSlotId: string) => ({
			id,
			tenantId: 'tenant-1',
			organizationId: 'org-1',
			employeeId: 'employee-1',
			projectId,
			timeSlotId,
			date: '2026-10-19',
			title,
			type,
			duration: 300,
			deletedAt: null
		});
		await db('activity').insert([
			activity('activity-editor', 'VS Code', 'APP', 'project-1', 'slot-busy'),
			activity('activity-site', 'github.com', 'URL', 'project-1', 'slot-busy'),
			activity('activity-chat', 'Slack', 'APP', 'project-2', 'slot-idle')
		]);
	});

	afterAll(async () => {
		await db?.destroy();
	});

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
	});

	afterEach(() => jest.restoreAllMocks());

	const service = () =>
		new ActivityService(
			{ metadata: { tableName: 'activity' } } as any,
			{ getKnex: () => db } as any,
			{ find: jest.fn(async () => []) } as any,
			{ find: jest.fn(async () => []) } as any,
			{} as any
		);

	const titlesFor = async (method: 'getDailyActivities' | 'getDailyActivitiesReport', filters: object) => {
		const rows: any[] = await service()[method]({
			organizationId: 'org-1',
			startDate: '2026-10-19',
			endDate: '2026-10-19',
			...filters
		} as any);
		return rows.map((row) => row.title).sort();
	};

	describe.each(['getDailyActivities', 'getDailyActivitiesReport'] as const)('%s', (method) => {
		it('answers every activity without filters', async () => {
			expect(await titlesFor(method, {})).toEqual(['Slack', 'VS Code', 'github.com']);
		});

		it('keeps the requested projects only', async () => {
			expect(await titlesFor(method, { projectIds: ['project-2'] })).toEqual(['Slack']);
		});

		it('keeps the requested activity types only', async () => {
			expect(await titlesFor(method, { types: ['URL'] })).toEqual(['github.com']);
		});

		it('keeps the requested titles only', async () => {
			expect(await titlesFor(method, { titles: ['VS Code', 'Slack'] })).toEqual(['Slack', 'VS Code']);
		});

		it('keeps the activities of time slots within the requested activity level only', async () => {
			expect(await titlesFor(method, { activityLevel: { start: 50, end: 100 } })).toEqual([
				'VS Code',
				'github.com'
			]);
		});
	});
});
