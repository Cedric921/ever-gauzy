import '../../../core/entities/internal';

import { FindOperator } from 'typeorm';
import { OrganizationRecurringExpenseFindSplitExpenseQuery } from '../organization-recurring-expense.find-split-expense.query';
import { OrganizationRecurringExpenseFindSplitExpenseHandler } from './organization-recurring-expense.find-split-expense.handler';

/**
 * The split recurring expenses of a month are those running during it. Both dates were compared with the
 * 1st of the month only, so an expense starting on the 15th was missing from its first month.
 */
describe('OrganizationRecurringExpenseFindSplitExpenseHandler', () => {
	it('selects the expenses running during the month, including one starting after the 1st', async () => {
		const findAll = jest.fn().mockResolvedValue({ items: [{ value: 300 }], total: 1 });
		const handler = new OrganizationRecurringExpenseFindSplitExpenseHandler(
			{ findAll } as any,
			{ findOneByWhereOptions: jest.fn().mockResolvedValue({ id: 'org-1' }) } as any,
			{ findAll: jest.fn().mockResolvedValue({ items: [{}, {}, {}], total: 3 }) } as any
		);

		const result = await handler.execute(
			new OrganizationRecurringExpenseFindSplitExpenseQuery('org-1', { year: 2026, month: 2 } as any)
		);

		const [openEnded, ending] = findAll.mock.calls[0][0].where;
		const valueOf = (operator: FindOperator<Date>) => operator.value;
		const endOfMarch = new Date(2026, 2, 31, 23, 59, 59, 999);

		// Started by the end of the month (an expense from March 15 counts for March)
		expect(openEnded.startDate.type).toBe('lessThanOrEqual');
		expect(valueOf(openEnded.startDate)).toEqual(endOfMarch);
		expect(ending.startDate.type).toBe('lessThanOrEqual');
		expect(valueOf(ending.startDate)).toEqual(endOfMarch);
		// Open-ended, or ending on or after the start of the month
		expect(openEnded.endDate.type).toBe('isNull');
		expect(ending.endDate.type).toBe('moreThanOrEqual');
		expect(valueOf(ending.endDate)).toEqual(new Date(2026, 2, 1));
		expect(result.items[0]).toMatchObject({ value: 100, originalValue: 300, employeeCount: 3 });
	});

	it('splits the expense among the employees working during the month only', async () => {
		const employees = [
			// No employment dates set: counts
			{},
			// Started during the month: counts
			{ startedWorkOn: new Date(2026, 2, 20) },
			// Left during the month: counts
			{ startedWorkOn: new Date(2025, 0, 1), endWork: new Date(2026, 2, 5) },
			// Starts the next month: does not count
			{ startedWorkOn: new Date(2026, 3, 1) },
			// Left before the month: does not count
			{ endWork: new Date(2026, 1, 28) }
		];
		const handler = new OrganizationRecurringExpenseFindSplitExpenseHandler(
			{ findAll: jest.fn().mockResolvedValue({ items: [{ value: 300 }], total: 1 }) } as any,
			{ findOneByWhereOptions: jest.fn().mockResolvedValue({ id: 'org-1' }) } as any,
			{ findAll: jest.fn().mockResolvedValue({ items: employees, total: employees.length }) } as any
		);

		const result = await handler.execute(
			new OrganizationRecurringExpenseFindSplitExpenseQuery('org-1', { year: 2026, month: 2 } as any)
		);

		expect(result.items[0]).toMatchObject({ value: 100, originalValue: 300, employeeCount: 3 });
	});

	it('keeps the whole value when nobody worked during the month', async () => {
		const handler = new OrganizationRecurringExpenseFindSplitExpenseHandler(
			{ findAll: jest.fn().mockResolvedValue({ items: [{ value: 300 }], total: 1 }) } as any,
			{ findOneByWhereOptions: jest.fn().mockResolvedValue({ id: 'org-1' }) } as any,
			{ findAll: jest.fn().mockResolvedValue({ items: [{ startedWorkOn: new Date(2026, 5, 1) }], total: 1 }) } as any
		);

		const result = await handler.execute(
			new OrganizationRecurringExpenseFindSplitExpenseQuery('org-1', { year: 2026, month: 2 } as any)
		);

		expect(result.items[0]).toMatchObject({ value: 300, originalValue: 300, employeeCount: 0 });
	});
});
