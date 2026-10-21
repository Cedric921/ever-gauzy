import '../../../core/entities/internal';

import { EmployeeKindEnum } from '@gauzy/contracts';
import { FindSplitExpenseQuery } from '../expense.find-split-expense.query';
import { FindSplitExpenseHandler } from './expense.find-split-expense.handler';

/**
 * A split expense is divided among the employees working in the organization during the month of the
 * expense. It was divided by every employee of the organization, including those who had not started
 * yet or had already left.
 */
describe('FindSplitExpenseHandler', () => {
	const employees = [
		// No employment dates set: counts in every month
		{ id: 'e-1' },
		// Joined in April 2026
		{ id: 'e-2', startedWorkOn: new Date(2026, 3, 15) },
		// Left in February 2026
		{ id: 'e-3', startedWorkOn: new Date(2025, 0, 1), endWork: new Date(2026, 1, 10) }
	];

	const handlerFor = (items: any[]) => {
		const employeeService = {
			findOneByOptions: jest
				.fn()
				.mockResolvedValue({ id: 'e-1', kind: EmployeeKindEnum.HUMAN, organization: { id: 'org-1' } }),
			findAll: jest.fn().mockResolvedValue({ items: employees, total: employees.length })
		};
		const expenseService = {
			findAllExpenses: jest.fn().mockResolvedValue({ items, total: items.length })
		};
		return {
			handler: new FindSplitExpenseHandler(expenseService as any, employeeService as any),
			employeeService
		};
	};

	const execute = (handler: FindSplitExpenseHandler) =>
		handler.execute(new FindSplitExpenseQuery({ employeeId: 'e-1', relations: [] } as any));

	it('divides each split expense by the employees working during the month of its value date', async () => {
		const { handler, employeeService } = handlerFor([
			{ amount: 300, splitExpense: true, valueDate: new Date(2026, 0, 20) },
			{ amount: 300, splitExpense: true, valueDate: new Date(2026, 2, 20) },
			{ amount: 300, splitExpense: true, valueDate: new Date(2026, 3, 20) }
		]);

		const result = await execute(handler);

		// January: e-1 and e-3 / March: e-1 only / April: e-1 and e-2
		expect(result.items).toMatchObject([
			{ amount: 150, originalValue: 300, employeeCount: 2 },
			{ amount: 300, originalValue: 300, employeeCount: 1 },
			{ amount: 150, originalValue: 300, employeeCount: 2 }
		]);
		// One read of the employees for all the expenses
		expect(employeeService.findAll).toHaveBeenCalledTimes(1);
	});

	it('uses the creation date when the expense has no value date', async () => {
		const { handler } = handlerFor([{ amount: 300, splitExpense: true, createdAt: new Date(2026, 2, 5) }]);

		const result = await execute(handler);

		expect(result.items[0]).toMatchObject({ amount: 300, originalValue: 300, employeeCount: 1 });
	});

	it('leaves an expense that is not split unchanged', async () => {
		const own = { amount: 300, splitExpense: false, valueDate: new Date(2026, 2, 20) };
		const { handler } = handlerFor([own]);

		const result = await execute(handler);

		expect(result.items[0]).toBe(own);
	});
});
