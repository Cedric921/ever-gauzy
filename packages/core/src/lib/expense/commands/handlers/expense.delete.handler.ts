import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { isNotEmpty } from '@gauzy/utils';
import { ID } from '@gauzy/contracts';
import { ExpenseService } from '../../expense.service';
import { EmployeeService } from '../../../employee/employee.service';
import { EmployeeStatisticsService } from '../../../employee-statistics';
import { ExpenseDeleteCommand } from '../expense.delete.command';

@CommandHandler(ExpenseDeleteCommand)
export class ExpenseDeleteHandler implements ICommandHandler<ExpenseDeleteCommand> {
	constructor(
		private readonly expenseService: ExpenseService,
		private readonly employeeService: EmployeeService,
		private readonly employeeStatisticsService: EmployeeStatisticsService
	) {}

	/**
	 * Executes the deletion of an expense and updates the employee's average expenses if applicable.
	 *
	 * @param command - The command containing the expense ID to delete and the optional employee ID.
	 * @returns A promise that resolves with the result of the delete operation.
	 * @throws BadRequestException if there is an error updating employee average expenses.
	 */
	public async execute(command: ExpenseDeleteCommand): Promise<DeleteResult> {
		const { expenseId } = command;
		// The `employeeId` query parameter is optional: without it, take the employee from the stored expense
		// (read before it is deleted) so that employee's average expenses are still refreshed.
		const employeeId = isNotEmpty(command.employeeId)
			? command.employeeId
			: await this.findStoredEmployeeId(expenseId);
		// Delete the expense by ID
		const result = await this.deleteExpense(expenseId);

		try {
			// If employeeId exists, update the employee's average expenses
			if (isNotEmpty(employeeId)) {
				const stat = await this.employeeStatisticsService.getStatisticsByEmployeeId(employeeId);
				const averageExpense = this.expenseService.countStatistic(stat.expenseStatistics);

				await this.employeeService.create({
					id: employeeId,
					averageExpenses: averageExpense
				});
			}
		} catch (error) {
			console.error('Error while updating employee average expenses', error);
			throw new BadRequestException('Error while updating employee average expenses');
		}

		return result;
	}

	/**
	 * Reads the employee of the stored expense, within the tenant scope the service applies.
	 *
	 * @param expenseId - The ID of the expense about to be deleted
	 * @returns The employee ID, or undefined when the expense has none or cannot be read
	 */
	private async findStoredEmployeeId(expenseId: ID): Promise<ID | undefined> {
		try {
			const expense = await this.expenseService.findOneByIdString(expenseId);
			return expense?.employeeId;
		} catch {
			// The delete itself decides what a missing or foreign expense answers
			return undefined;
		}
	}

	/**
	 * Delete the expense based on user permissions
	 *
	 * @param expenseId - The ID of the expense to delete
	 * @returns Promise<DeleteResult> - The result of the delete operation
	 */
	public async deleteExpense(expenseId: ID): Promise<DeleteResult> {
		// Tenant scoping and the "own records only" restriction for callers without
		// CHANGE_SELECTED_EMPLOYEE are injected by TenantAwareCrudService.delete(). Spelling
		// `employeeId: RequestContext.currentEmployeeId()` out here was redundant — and, because that
		// helper is null for callers without an employee record, put a null into the criteria (which
		// TypeORM used to drop silently). Keep the criteria to the id.
		const query = { id: expenseId };

		try {
			return await this.expenseService.delete(query);
		} catch (error) {
			throw new ForbiddenException('You do not have permission to delete this expense.');
		}
	}
}
