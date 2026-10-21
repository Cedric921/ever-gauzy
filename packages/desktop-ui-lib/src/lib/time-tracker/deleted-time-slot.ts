/**
 * Whether a time slot lookup failed because the slot no longer exists on the server (404), e.g. its time log
 * was deleted after the timer stored the slot id as its last capture. Such a lookup is best effort: the caller
 * logs it and moves on instead of showing an error toast on every refresh.
 */
export function isDeletedTimeSlotError(error: unknown): boolean {
	return (error as { status?: number } | null)?.status === 404;
}
