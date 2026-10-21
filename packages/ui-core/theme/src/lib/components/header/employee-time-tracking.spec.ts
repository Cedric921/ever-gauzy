import { canEmployeeTrackTime } from './employee-time-tracking';

/**
 * The Start Timer quick action and shortcut stayed available to an employee an administrator
 * had made inactive, archived or deleted, although the server refuses their time logs.
 */
describe('canEmployeeTrackTime', () => {
	it('allows an active employee', () => {
		expect(canEmployeeTrackTime({ isActive: true, isArchived: false })).toBe(true);
	});

	it('allows an employee whose flags were not loaded', () => {
		expect(canEmployeeTrackTime({})).toBe(true);
		expect(canEmployeeTrackTime({ isActive: null, isArchived: null })).toBe(true);
	});

	it('refuses an inactive employee', () => {
		expect(canEmployeeTrackTime({ isActive: false, isArchived: false })).toBe(false);
	});

	it('refuses an archived employee', () => {
		expect(canEmployeeTrackTime({ isActive: true, isArchived: true })).toBe(false);
	});

	it('refuses a deleted employee', () => {
		expect(canEmployeeTrackTime({ isActive: true, deletedAt: new Date(2026, 0, 1) })).toBe(false);
	});

	it('leaves the other checks to the caller when there is no employee', () => {
		expect(canEmployeeTrackTime(undefined)).toBe(true);
	});
});
