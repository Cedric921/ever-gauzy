import '../core/entities/internal';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { KeyResultUpdateController } from './keyresult-update.controller';

/**
 * `PUT /key-result-updates/:id` saves through `create()` and used to catch every failure and return
 * `undefined`, so a refused or failed edit answered 202 with an empty body.
 */
describe('KeyResultUpdateController.update', () => {
	const ID = '00000000-0000-4000-8000-000000000081';

	const setup = (create: jest.Mock) => {
		const keyResultUpdateService = { create };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const controller = new KeyResultUpdateController({} as any, keyResultUpdateService as any);
		return { controller, keyResultUpdateService };
	};

	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('returns the saved update', async () => {
		const saved = { id: ID, progress: 80 };
		const { controller, keyResultUpdateService } = setup(jest.fn().mockResolvedValue(saved));

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect(controller.update(ID, { progress: 80 } as any)).resolves.toBe(saved);
		expect(keyResultUpdateService.create).toHaveBeenCalledWith({ progress: 80, id: ID });
	});

	it('keeps the status of a refused edit instead of answering an empty body', async () => {
		const refusal = new ForbiddenException();
		const { controller } = setup(jest.fn().mockRejectedValue(refusal));

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect(controller.update(ID, { progress: 80 } as any)).rejects.toBe(refusal);
	});

	it('answers a failed edit with 400', async () => {
		const { controller } = setup(jest.fn().mockRejectedValue(new Error('the record could not be saved')));

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect(controller.update(ID, { progress: 80 } as any)).rejects.toBeInstanceOf(BadRequestException);
	});
});
