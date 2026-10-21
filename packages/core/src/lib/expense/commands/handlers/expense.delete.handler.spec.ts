import '../../../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { ExpenseDeleteCommand } from '../expense.delete.command';
import { ExpenseDeleteHandler } from './expense.delete.handler';

/**
 * `DELETE /expense/:id` takes `employeeId` as an optional query parameter. Without it, the averages of the
 * employee the expense belonged to must still be refreshed, from the stored expense read before the delete.
 */
describe('ExpenseDeleteHandler', () => {
	const deleted = { affected: 1, raw: [] };

	const setup = (stored: () => Promise<unknown>) => {
		const order: string[] = [];
		const expenseService = {
			findOneByIdString: jest.fn(() => {
				order.push('read');
				return stored();
			}),
			delete: jest.fn(() => {
				order.push('delete');
				return Promise.resolve(deleted);
			}),
			countStatistic: jest.fn().mockReturnValue(125)
		};
		const employeeService = { create: jest.fn() };
		const employeeStatisticsService = {
			getStatisticsByEmployeeId: jest.fn().mockResolvedValue({ expenseStatistics: [] })
		};
		const handler = new ExpenseDeleteHandler(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expenseService as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			employeeService as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			employeeStatisticsService as any
		);
		return { handler, order, expenseService, employeeService, employeeStatisticsService };
	};

	it("refreshes the stored expense's employee average expenses without an employeeId in the request", async () => {
		const { handler, order, expenseService, employeeService, employeeStatisticsService } = setup(() =>
			Promise.resolve({ id: 'x-1', employeeId: 'e-1' })
		);

		await expect(handler.execute(new ExpenseDeleteCommand(undefined, 'x-1'))).resolves.toBe(deleted);

		expect(order).toEqual(['read', 'delete']);
		expect(expenseService.delete).toHaveBeenCalledWith({ id: 'x-1' });
		expect(employeeStatisticsService.getStatisticsByEmployeeId).toHaveBeenCalledWith('e-1');
		expect(employeeService.create).toHaveBeenCalledWith({ id: 'e-1', averageExpenses: 125 });
	});

	it('keeps using the employeeId the request sends, without reading the stored expense', async () => {
		const { handler, expenseService, employeeStatisticsService } = setup(() =>
			Promise.resolve({ id: 'x-1', employeeId: 'e-1' })
		);

		await handler.execute(new ExpenseDeleteCommand('e-2', 'x-1'));

		expect(expenseService.findOneByIdString).not.toHaveBeenCalled();
		expect(employeeStatisticsService.getStatisticsByEmployeeId).toHaveBeenCalledWith('e-2');
	});

	it('still deletes, without a refresh, when the stored expense cannot be read', async () => {
		const { handler, expenseService, employeeStatisticsService } = setup(() =>
			Promise.reject(new NotFoundException())
		);

		await expect(handler.execute(new ExpenseDeleteCommand(undefined, 'x-1'))).resolves.toBe(deleted);

		expect(expenseService.delete).toHaveBeenCalledWith({ id: 'x-1' });
		expect(employeeStatisticsService.getStatisticsByEmployeeId).not.toHaveBeenCalled();
	});
});
