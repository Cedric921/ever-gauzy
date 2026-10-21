import { isDeletedTimeSlotError } from './deleted-time-slot';

/**
 * The timer keeps the id of its last captured time slot locally and fetches that slot on every refresh. When the
 * slot was deleted on the server (time logs removed), the API answers 404 and the timer showed an error toast
 * each time (#8349). A 404 is now treated as "nothing to show"; any other failure is still reported.
 */
describe('isDeletedTimeSlotError', () => {
	it('recognises a 404 from the time slot lookup', () => {
		expect(isDeletedTimeSlotError({ status: 404, message: 'Http failure response: 404 Not Found' })).toBe(true);
	});

	it('does not swallow other HTTP failures', () => {
		expect(isDeletedTimeSlotError({ status: 500 })).toBe(false);
		expect(isDeletedTimeSlotError({ status: 401 })).toBe(false);
		expect(isDeletedTimeSlotError({ status: 0 })).toBe(false);
	});

	it('does not swallow errors without an HTTP status', () => {
		expect(isDeletedTimeSlotError(new Error('boom'))).toBe(false);
		expect(isDeletedTimeSlotError(null)).toBe(false);
		expect(isDeletedTimeSlotError(undefined)).toBe(false);
		expect(isDeletedTimeSlotError('404')).toBe(false);
	});
});
