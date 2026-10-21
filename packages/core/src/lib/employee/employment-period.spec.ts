import { isEmployedDuring } from './employment-period';

describe('isEmployedDuring', () => {
	const start = new Date(2026, 2, 1);
	const end = new Date(2026, 2, 31, 23, 59, 59, 999);

	it('counts an employee without employment dates', () => {
		expect(isEmployedDuring({}, start, end)).toBe(true);
		expect(isEmployedDuring({ startedWorkOn: null, endWork: null }, start, end)).toBe(true);
	});

	it('counts an employee who started by the end of the period', () => {
		expect(isEmployedDuring({ startedWorkOn: new Date(2025, 5, 1) }, start, end)).toBe(true);
		expect(isEmployedDuring({ startedWorkOn: new Date(2026, 2, 31) }, start, end)).toBe(true);
	});

	it('does not count an employee who starts after the period', () => {
		expect(isEmployedDuring({ startedWorkOn: new Date(2026, 3, 1) }, start, end)).toBe(false);
	});

	it('counts an employee who left during the period', () => {
		expect(isEmployedDuring({ endWork: new Date(2026, 2, 1) }, start, end)).toBe(true);
		expect(isEmployedDuring({ endWork: new Date(2026, 2, 15) }, start, end)).toBe(true);
	});

	it('does not count an employee who left before the period', () => {
		expect(isEmployedDuring({ endWork: new Date(2026, 1, 28) }, start, end)).toBe(false);
	});

	it('accepts dates read as strings', () => {
		expect(isEmployedDuring({ startedWorkOn: '2026-03-10T00:00:00.000Z' as any }, start, end)).toBe(true);
		expect(isEmployedDuring({ endWork: '2025-12-31T00:00:00.000Z' as any }, start, end)).toBe(false);
	});
});
