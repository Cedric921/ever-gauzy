import { GoalLevelEnum, KeyResultTypeEnum, KeyResultWeightEnum } from '@gauzy/contracts';
import { buildGoalFromTemplate, buildKeyResultFromTemplate, buildKpiFromTemplate } from './goal-template.utils';

/**
 * Creating a goal from a preset sent the template's own id (and those of its key results and KPIs) along,
 * so the server saved over the goal created earlier from the same preset instead of creating a new one.
 */
describe('goal template payloads', () => {
	const organization = { id: 'org-1', tenantId: 'tenant-1' };
	const record = {
		createdAt: new Date(2026, 0, 1),
		updatedAt: new Date(2026, 0, 2),
		deletedAt: null,
		isActive: true,
		isArchived: false,
		tenantId: 'tenant-1',
		organizationId: 'org-1'
	};
	const kpiTemplate: any = {
		...record,
		id: 'kpi-template-1',
		name: 'Revenue',
		description: 'Monthly revenue',
		type: 'Currency',
		operator: '>=',
		currentValue: 0,
		targetValue: 1000
	};
	const keyResultTemplate: any = {
		...record,
		id: 'key-result-template-1',
		name: 'Grow revenue',
		type: KeyResultTypeEnum.KPI,
		deadline: 'No Custom Deadline',
		initialValue: 0,
		targetValue: 1000,
		goalId: 'goal-template-1',
		kpi: kpiTemplate,
		kpiId: 'kpi-template-1'
	};
	const goalTemplate: any = {
		...record,
		id: 'goal-template-1',
		name: 'Increase sales',
		level: GoalLevelEnum.ORGANIZATION,
		category: 'Sales',
		keyResults: [keyResultTemplate]
	};

	describe('buildGoalFromTemplate', () => {
		const form = { deadline: 'Q1-2026', ownerId: 'employee-1', level: GoalLevelEnum.EMPLOYEE, leadId: null };

		it('leaves out the template id and record fields', () => {
			const goal = buildGoalFromTemplate(goalTemplate, form, organization);

			['id', 'createdAt', 'updatedAt', 'deletedAt', 'isActive', 'isArchived', 'keyResults'].forEach((field) =>
				expect(goal).not.toHaveProperty(field)
			);
		});

		it('builds the goal from the template and the form', () => {
			expect(buildGoalFromTemplate(goalTemplate, form, organization)).toEqual({
				name: 'Increase sales',
				level: GoalLevelEnum.EMPLOYEE,
				category: 'Sales',
				deadline: 'Q1-2026',
				ownerId: 'employee-1',
				leadId: null,
				ownerEmployeeId: 'employee-1',
				description: ' ',
				progress: 0,
				organizationId: 'org-1',
				tenantId: 'tenant-1'
			});
		});

		it('sets the owner team of a team goal', () => {
			const goal = buildGoalFromTemplate(
				goalTemplate,
				{ ...form, level: GoalLevelEnum.TEAM, ownerId: 'team-1' },
				organization
			);
			expect(goal.ownerTeamId).toBe('team-1');
			expect(goal.organizationId).toBe('org-1');
		});

		it('builds the same payload twice from one template', () => {
			expect(buildGoalFromTemplate(goalTemplate, form, organization)).toEqual(
				buildGoalFromTemplate(goalTemplate, form, organization)
			);
			expect(goalTemplate.id).toBe('goal-template-1');
		});
	});

	describe('buildKpiFromTemplate', () => {
		it('leaves out the template id and sets the organization', () => {
			expect(buildKpiFromTemplate(kpiTemplate, organization)).toEqual({
				name: 'Revenue',
				description: 'Monthly revenue',
				type: 'Currency',
				operator: '>=',
				currentValue: 0,
				targetValue: 1000,
				organizationId: 'org-1',
				tenantId: 'tenant-1'
			});
		});
	});

	describe('buildKeyResultFromTemplate', () => {
		it('leaves out the template ids and links the created goal and KPI', () => {
			const keyResult = buildKeyResultFromTemplate(
				keyResultTemplate,
				{ goalId: 'goal-1', ownerId: 'employee-1', kpiId: 'kpi-1' },
				organization
			);

			expect(keyResult).toEqual({
				name: 'Grow revenue',
				type: KeyResultTypeEnum.KPI,
				deadline: 'No Custom Deadline',
				initialValue: 0,
				targetValue: 1000,
				description: ' ',
				progress: 0,
				status: 'none',
				weight: KeyResultWeightEnum.DEFAULT,
				kpiId: 'kpi-1',
				goalId: 'goal-1',
				update: 0,
				ownerId: 'employee-1',
				organizationId: 'org-1',
				tenantId: 'tenant-1'
			});
		});

		it('does not link the KPI template when no KPI was created', () => {
			const keyResult = buildKeyResultFromTemplate(
				keyResultTemplate,
				{ goalId: 'goal-1', ownerId: 'employee-1' },
				organization
			);

			expect(keyResult).not.toHaveProperty('kpiId');
			expect(keyResult).not.toHaveProperty('kpi');
			expect(keyResult).not.toHaveProperty('id');
		});
	});
});
