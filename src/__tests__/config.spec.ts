import { describe, expect, it } from 'vitest'
import type { SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields } from '../config.js'

const fields = GetConfigFields()
const byId = new Map<string, SomeCompanionConfigField>(fields.map((field) => [field.id, field]))

describe('config fields', () => {
	// isVisibleExpression is a plain string to the compiler, so a typo in a field id or value hides a field for good
	const visibilityRules = fields.filter((field) => field.isVisibleExpression !== undefined)

	it('has the visibility rules that replaced isVisible', () => {
		expect(visibilityRules.map((field) => field.id)).toEqual(['latitude', 'longitude', 'location'])
	})

	it.each(visibilityRules.map((field) => [field.id, field.isVisibleExpression!]))(
		'%s is shown by comparing a dropdown to one of its choices',
		(_id, expression) => {
			const match = /^\$\(options:(\w+)\) == '([^']+)'$/.exec(expression)
			expect(match).not.toBeNull()
			const [, targetId, value] = match!
			const target = byId.get(targetId)
			expect(target?.type).toBe('dropdown')
			if (target?.type !== 'dropdown') return
			expect(target.choices.map((choice) => choice.id)).toContain(value)
		},
	)
})
