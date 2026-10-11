import { describe, expect, it, vi } from 'vitest'
import type {
	CompanionActionCallbackContext,
	CompanionActionDefinitions,
	CompanionActionEvent,
	CompanionInputFieldDropdown,
} from '@companion-module/base'
import { ActionId, NO_LOCATIONS, UpdateActions, type ActionSchema } from '../actions.js'
import { SearchResponse, type Location } from '../interfaces.js'
import type BomAPI from '../main.js'
import { searchResponse } from './fixtures.js'

function fakeInstance(locations: Location[] = SearchResponse.parse(searchResponse).data) {
	return {
		locations: new Map(locations.map((location) => [location.geohash, location])),
		location: undefined as Location | undefined,
		updateData: vi.fn(async (_geohash: string, _signal?: AbortSignal) => {}),
		setActionDefinitions: vi.fn<(actions: CompanionActionDefinitions<ActionSchema>) => void>(),
	}
}

function selectLocation(self: ReturnType<typeof fakeInstance>) {
	UpdateActions(self as unknown as BomAPI)
	const definition = self.setActionDefinitions.mock.calls[0][0][ActionId.SelectLocation]
	if (!definition) throw new Error('selectLocation not defined')
	return {
		definition,
		field: definition.options[0] as CompanionInputFieldDropdown<'location', string>,
	}
}

async function run(self: ReturnType<typeof fakeInstance>, location: string, signal = new AbortController().signal) {
	const { definition } = selectLocation(self)
	return await definition.callback(
		{ options: { location } } as CompanionActionEvent<{ location: string }>,
		{ signal } as CompanionActionCallbackContext,
	)
}

describe('select location action', () => {
	it('keeps the id saved on existing buttons', () => {
		expect(ActionId.SelectLocation).toBe('selectLocation')
	})

	it('lists the search results by label, defaulting to the first', () => {
		const { field } = selectLocation(fakeInstance())
		expect(field.choices).toEqual([
			{ id: 'r1r0fsn', label: 'Melbourne (VIC:3000)' },
			{ id: 'r1qg2z3', label: 'Woodend (VIC:null)' },
		])
		expect(field.default).toBe('r1r0fsn')
	})

	it('still defines the action when the search found nothing', () => {
		// The search fails whenever the API is unreachable, and locations[0].id threw, ending configUpdated early
		const { field } = selectLocation(fakeInstance([]))
		expect(field.choices).toEqual([])
		expect(field.default).toBe(NO_LOCATIONS)
	})

	it('fetches the chosen location, passing the action signal through', async () => {
		const self = fakeInstance()
		const { signal } = new AbortController()
		await run(self, 'r1qg2z3', signal)
		expect(self.location?.name).toBe('Woodend')
		expect(self.updateData).toHaveBeenCalledExactlyOnceWith('r1qg2z3', signal)
	})

	it('does nothing for the placeholder or a location no longer in the results', async () => {
		const self = fakeInstance()
		await run(self, NO_LOCATIONS)
		await run(self, 'r7hgdp8')
		expect(self.updateData).not.toHaveBeenCalled()
		expect(self.location).toBeUndefined()
	})
})
