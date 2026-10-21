import { IEmployee } from '@gauzy/contracts';

/**
 * Whether an employee may still track time: an employee made inactive, archived or deleted by an
 * administrator can no longer start the timer (the server refuses it too), so the Start Timer quick action
 * is hidden and the start shortcut does nothing for them. Stopping a timer that is already running stays possible.
 *
 * Only the employee's state is checked here: the time tracking setting and the permission are checked
 * where it is used. A missing flag is not a restriction.
 *
 * @param employee The signed-in user's employee.
 */
export function canEmployeeTrackTime(employee: Pick<IEmployee, 'isActive' | 'isArchived' | 'deletedAt'>): boolean {
	return employee?.isActive !== false && !employee?.isArchived && !employee?.deletedAt;
}
