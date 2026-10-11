import type * as Base from '@companion-module/base'

/**
 * Enough of InstanceBase to construct the module without a Companion host. Use from a spec file as
 * `vi.mock('@companion-module/base', async (importOriginal) => (await import('./instance-base.js')).mockBase(importOriginal))`
 */
export async function mockBase(importOriginal: <T>() => Promise<T>): Promise<typeof Base> {
	const actual = await importOriginal<typeof Base>()
	class InstanceBase {
		constructor(_internal: unknown) {}
		log(): void {}
		updateStatus(): void {}
		setActionDefinitions(): void {}
		setFeedbackDefinitions(): void {}
		setVariableDefinitions(): void {}
		setVariableValues(): void {}
	}
	return { ...actual, InstanceBase } as unknown as typeof Base
}
