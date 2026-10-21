import { EmployeeKindEnum, IExpense, IPagination, ISplitExpenseOutput } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EmployeeService } from '../../../employee/employee.service';
import { isEmployedDuring } from '../../../employee/employment-period';
import { ExpenseService } from '../../expense.service';
import { FindSplitExpenseQuery } from '../expense.find-split-expense.query';
import { parseFindOptionsRelations } from '../../../core/utils';
import * as moment from 'moment';

/**
 * Finds the split expense for a given organization.
 *
 * 1. Find all expenses for organization which have splitExpense = true & all for the employee
 * 2. Find all employees of the organization (TODO: No. of employees CURRENTLY in the organization?)
 * 3. Divide the value of the expense found in 1 to the no. of employees found in 2 to 'split' the expense equally for all employees.
 */
@QueryHandler(FindSplitExpenseQuery)
export class FindSplitExpenseHandler
	implements IQueryHandler<FindSplitExpenseQuery> {
	constructor(
		private readonly expenseService: ExpenseService,
		private readonly employeeService: EmployeeService
	) {}

	public async execute(
		query: FindSplitExpenseQuery
	): Promise<IPagination<ISplitExpenseOutput>> {
		const {
			findInput: { relations, filterDate, employeeId }
		} = query;

		const employee = await this.employeeService.findOneByOptions({
			where: {
				id: employeeId
			},
			relations: ['organization']
		});

		// An agent employee takes no share of a split expense (they are divided among people only): it gets
		// its own expenses that are not split, and no share of the organization's.
		if (employee.kind === EmployeeKindEnum.AGENT) {
			const own = await this.expenseService.findAllExpenses(
				{
					where: { employee: { id: employeeId } },
					relations: parseFindOptionsRelations(relations)
				},
				filterDate
			);
			const items = own.items.filter((expense) => !expense.splitExpense);
			return { items, total: items.length };
		}

		//1. Find all expenses for organization which have splitExpense = true & all for the employee
		const { items, total } = await this.expenseService.findAllExpenses(
			{
				where: [
					{
						organizationId: employee.organization.id,
						splitExpense: true
					},
					{
						employee: {
							id: employeeId
						}
					}
				],
				relations: parseFindOptionsRelations(relations)
			},
			filterDate
		);

		//2. Find all employees of the organization: people only, an agent employee takes no share of an expense
		const orgEmployees = await this.employeeService.findAll({
			where: {
				organizationId: employee.organization.id,
				kind: EmployeeKindEnum.HUMAN
			}
		});

		// Only the employees working during the month of the expense take a share of it
		const employeeCountFor = (expense: IExpense): number => {
			const date = expense.valueDate || expense.createdAt;
			if (!date) {
				return orgEmployees.total;
			}
			const monthStart = moment(date).startOf('month').toDate();
			const monthEnd = moment(date).endOf('month').toDate();
			return orgEmployees.items.filter((employee) => isEmployedDuring(employee, monthStart, monthEnd)).length;
		};

		//3. Divide the value of the expense found in 1 to the no. of employees found in 2.
		const splitItems = items.map((e) => {
			if (!e.splitExpense) {
				return e;
			}
			const employeeCount = employeeCountFor(e);
			return {
				...e,
				amount: +(
					e.amount /
					(employeeCount !== 0 ? employeeCount : 1)
				).toFixed(2),
				originalValue: +e.amount,
				employeeCount
			};
		});

		return { items: splitItems, total };
	}
}
