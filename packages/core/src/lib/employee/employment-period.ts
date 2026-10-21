import { IEmployee } from '@gauzy/contracts';

/**
 * Whether an employee worked in the organization at some point of a period: started work by its end,
 * and did not end work before its start. An employee with no start date (or no end date) set is not
 * limited on that side, so employees created without these dates keep counting as before.
 *
 * @param employee The employee, with its `startedWorkOn` and `endWork` dates.
 * @param start The first moment of the period.
 * @param end The last moment of the period.
 */
export function isEmployedDuring(
	employee: Pick<IEmployee, 'startedWorkOn' | 'endWork'>,
	start: Date,
	end: Date
): boolean {
	const startedWorkOn = employee?.startedWorkOn ? new Date(employee.startedWorkOn) : null;
	const endWork = employee?.endWork ? new Date(employee.endWork) : null;

	return (!startedWorkOn || startedWorkOn <= end) && (!endWork || endWork >= start);
}
