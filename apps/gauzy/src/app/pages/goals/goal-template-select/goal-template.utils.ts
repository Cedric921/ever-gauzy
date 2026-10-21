import { GoalLevelEnum, IGoalKPITemplate, IGoalTemplate, IKeyResultTemplate, KeyResultWeightEnum } from '@gauzy/contracts';

/**
 * Builds the payloads of a goal created from a goal template (a "preset") and of its key results and KPIs.
 *
 * A template is a record of its own: its id, its timestamps and its other record fields must not be sent
 * along, or the server saves over the goal, key results and KPIs created earlier from the same template
 * (it updates the record whose id it is given) instead of creating new ones.
 */

/** The organization a goal is created in. */
export interface IGoalTemplateTarget {
	id: string;
	tenantId?: string;
}

/** The record fields of a template, which belong to the template and not to what is created from it. */
const TEMPLATE_RECORD_FIELDS = [
	'id',
	'createdAt',
	'updatedAt',
	'deletedAt',
	'isActive',
	'isArchived',
	'archivedAt',
	'createdByUser',
	'createdByUserId',
	'updatedByUser',
	'updatedByUserId',
	'deletedByUser',
	'deletedByUserId',
	'organization',
	'tenant'
];

/** Default values of a key result created from a template. */
export const KEY_RESULT_TEMPLATE_DEFAULTS = {
	description: ' ',
	progress: 0,
	status: 'none',
	weight: KeyResultWeightEnum.DEFAULT
};

/**
 * A copy of a template without its record fields (id, timestamps, organization...).
 *
 * @param template The goal, key result or KPI template.
 */
export function withoutTemplateRecordFields<T extends object>(template: T): Partial<T> {
	const copy: Record<string, unknown> = { ...(template || {}) };
	TEMPLATE_RECORD_FIELDS.forEach((field) => delete copy[field]);
	return copy as Partial<T>;
}

/**
 * The goal to create from a template and the values of the "create from preset" form.
 *
 * @param template The selected goal template.
 * @param formValue The form value: deadline, ownerId, level and leadId.
 * @param organization The organization the goal is created in.
 */
export function buildGoalFromTemplate(
	template: IGoalTemplate,
	formValue: { ownerId?: string; level?: string; [key: string]: any },
	organization: IGoalTemplateTarget
): Record<string, any> {
	const { id: organizationId, tenantId } = organization;
	const goal: Record<string, any> = {
		...withoutTemplateRecordFields(template),
		...formValue,
		description: ' ',
		progress: 0,
		organizationId,
		tenantId
	};
	goal[
		formValue?.level === GoalLevelEnum.EMPLOYEE
			? 'ownerEmployeeId'
			: formValue?.level === GoalLevelEnum.TEAM
			? 'ownerTeamId'
			: 'organizationId'
	] = formValue?.ownerId;

	const { owner, keyResults, ...goalData } = goal;
	return {
		...goalData,
		organizationId,
		tenantId
	};
}

/**
 * The KPI to create from the KPI template of a key result template.
 *
 * @param kpi The KPI template.
 * @param organization The organization the KPI is created in.
 */
export function buildKpiFromTemplate(kpi: IGoalKPITemplate, organization: IGoalTemplateTarget): Record<string, any> {
	const { id: organizationId, tenantId } = organization;
	return {
		...withoutTemplateRecordFields(kpi),
		organizationId,
		tenantId
	};
}

/**
 * The key result to create from a key result template, for the goal just created.
 *
 * @param keyResult The key result template.
 * @param options The created goal, the owner and, for a KPI key result, the id of the KPI created for it.
 * @param organization The organization the key result is created in.
 */
export function buildKeyResultFromTemplate(
	keyResult: IKeyResultTemplate,
	options: { goalId: string; ownerId: string; kpiId?: string },
	organization: IGoalTemplateTarget
): Record<string, any> {
	const { id: organizationId, tenantId } = organization;
	// The template's kpiId is the id of a KPI template, not of a KPI: only the KPI created for it is linked
	const { kpi, kpiId, goal, goalId, ...keyResultData } = withoutTemplateRecordFields(keyResult);
	return {
		...keyResultData,
		...KEY_RESULT_TEMPLATE_DEFAULTS,
		...(options.kpiId ? { kpiId: options.kpiId } : {}),
		goalId: options.goalId,
		update: keyResult?.initialValue,
		ownerId: options.ownerId,
		organizationId,
		tenantId
	};
}
