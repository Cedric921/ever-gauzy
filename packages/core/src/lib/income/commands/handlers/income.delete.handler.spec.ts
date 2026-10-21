import '../../../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { IncomeDeleteCommand } from '../income.delete.command';
import { IncomeDeleteHandler } from './income.delete.handler';

/**
 * `DELETE /income/:id` takes `employeeId` as an optional query parameter. Without it, the averages of the
 * employee the income belonged to must still be refreshed, from the stored income read before the delete.
 */
describe('IncomeDeleteHandler', () => {
	const deleted = { affected: 1, raw: [] };

	const setup = (stored: () => Promise<unknown>) => {
		const order: string[] = [];
		const incomeService = {
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
			getStatisticsByEmployeeId: jest.fn().mockResolvedValue({ incomeStatistics: [], bonusStatistics: [] })
		};
		const handler = new IncomeDeleteHandler(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			incomeService as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			employeeService as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			employeeStatisticsService as any
		);
		return { handler, order, incomeService, employeeService, employeeStatisticsService };
	};

	it("refreshes the stored income's employee averages without an employeeId in the request", async () => {
		const { handler, order, incomeService, employeeService, employeeStatisticsService } = setup(() =>
			Promise.resolve({ id: 'i-1', employeeId: 'e-1' })
		);

		await expect(handler.execute(new IncomeDeleteCommand(undefined, 'i-1'))).resolves.toBe(deleted);

		expect(order).toEqual(['read', 'delete']);
		expect(incomeService.delete).toHaveBeenCalledWith({ id: 'i-1' });
		expect(employeeStatisticsService.getStatisticsByEmployeeId).toHaveBeenCalledWith('e-1');
		expect(employeeService.create).toHaveBeenCalledWith({ id: 'e-1', averageIncome: 125, averageBonus: 125 });
	});

	it('keeps using the employeeId the request sends, without reading the stored income', async () => {
		const { handler, incomeService, employeeStatisticsService } = setup(() =>
			Promise.resolve({ id: 'i-1', employeeId: 'e-1' })
		);

		await handler.execute(new IncomeDeleteCommand('e-2', 'i-1'));

		expect(incomeService.findOneByIdString).not.toHaveBeenCalled();
		expect(employeeStatisticsService.getStatisticsByEmployeeId).toHaveBeenCalledWith('e-2');
	});

	it('still deletes, without a refresh, when the stored income cannot be read', async () => {
		const { handler, incomeService, employeeStatisticsService } = setup(() =>
			Promise.reject(new NotFoundException())
		);

		await expect(handler.execute(new IncomeDeleteCommand(undefined, 'i-1'))).resolves.toBe(deleted);

		expect(incomeService.delete).toHaveBeenCalledWith({ id: 'i-1' });
		expect(employeeStatisticsService.getStatisticsByEmployeeId).not.toHaveBeenCalled();
	});
});
