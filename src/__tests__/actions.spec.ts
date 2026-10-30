import { describe, expect, it, vi } from 'vitest'
import type {
	CompanionActionCallbackContext,
	CompanionActionDefinitions,
	CompanionActionEvent,
	CompanionInputFieldDropdown,
	CompanionInputFieldTextInput,
} from '@companion-module/base'
import { ActionId, NO_LOCATIONS, UpdateActions, type ActionSchema } from '../actions.js'
import type { QueryType } from '../api.js'
import { SearchResponse, type Location } from '../interfaces.js'
import type BomAPI from '../main.js'
import { searchResponse } from './fixtures.js'

const SEARCH_RESULTS = SearchResponse.parse(searchResponse).data
const WOODEND = SEARCH_RESULTS.find((location) => location.name === 'Woodend')!

function fakeInstance(locations: Location[] = SEARCH_RESULTS) {
	return {
		locations: new Map(locations.map((location) => [location.geohash, location])),
		location: WOODEND,
		updateData: vi.fn(async (_geohash: string) => {}),
		updateActions: vi.fn(),
		query: vi.fn(async (type: QueryType, geohash: string, _signal?: AbortSignal) => ({ data: { type, geohash } })),
		setActionDefinitions: vi.fn<(actions: CompanionActionDefinitions<ActionSchema>) => void>(),
	}
}
type FakeInstance = ReturnType<typeof fakeInstance>

function definitions(self: FakeInstance) {
	UpdateActions(self as unknown as BomAPI)
	return self.setActionDefinitions.mock.calls.at(-1)![0]
}

function context(signal = new AbortController().signal) {
	return { signal } as CompanionActionCallbackContext
}

describe('select location action', () => {
	function selectLocation(self: FakeInstance) {
		const definition = definitions(self)[ActionId.SelectLocation]
		if (!definition) throw new Error('selectLocation not defined')
		return { definition, field: definition.options[0] as CompanionInputFieldDropdown<'location', string> }
	}

	async function run(self: FakeInstance, location: string, signal?: AbortSignal) {
		return await selectLocation(self).definition.callback(
			{ options: { location } } as CompanionActionEvent<{ location: string }>,
			context(signal),
		)
	}

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

	it('fetches the chosen location, without the action signal', async () => {
		const self = fakeInstance()
		await run(self, 'r1r0fsn')
		expect(self.location.name).toBe('Melbourne')
		expect(self.updateData).toHaveBeenCalledExactlyOnceWith('r1r0fsn')
	})

	it('redefines the actions, so Get Data defaults to the new location', async () => {
		const self = fakeInstance()
		await run(self, 'r1r0fsn')
		expect(self.updateActions).toHaveBeenCalledOnce()
	})

	it('does nothing for the placeholder or a location no longer in the results', async () => {
		const self = fakeInstance()
		await run(self, NO_LOCATIONS)
		await run(self, 'r7hgdp8')
		expect(self.updateData).not.toHaveBeenCalled()
		expect(self.updateActions).not.toHaveBeenCalled()
		expect(self.location).toBe(WOODEND)
	})
})

describe('get data action', () => {
	function getData(self: FakeInstance) {
		const definition = definitions(self)[ActionId.GetData]
		if (!definition) throw new Error('get_data not defined')
		return definition
	}

	async function run(self: FakeInstance, options: { geohash: string; data: QueryType }, signal?: AbortSignal) {
		return await getData(self).callback(
			{ options } as CompanionActionEvent<{ geohash: string; data: QueryType }>,
			context(signal),
		)
	}

	it('has a snake_case id', () => {
		expect(ActionId.GetData).toBe('get_data')
	})

	it('defaults to the current location and the first kind of data, and returns a result', () => {
		const self = fakeInstance()
		self.location = SEARCH_RESULTS.find((location) => location.name === 'Melbourne')!
		const definition = getData(self)
		const [geohash, data] = definition.options as [
			CompanionInputFieldTextInput<'geohash'>,
			CompanionInputFieldDropdown<'data', QueryType>,
		]
		expect(geohash.default).toBe('r1r0fsn')
		expect(data.default).toBe('observations')
		expect(data.choices).toHaveLength(5)
		expect(definition.hasResult).toBe(true)
	})

	it('returns what the query parsed, untouched', async () => {
		const self = fakeInstance()
		const { signal } = new AbortController()
		await expect(run(self, { geohash: 'r1r0fsn', data: 'forecast_hourly' }, signal)).resolves.toEqual({
			data: { type: 'forecast_hourly', geohash: 'r1r0fsn' },
		})
		expect(self.query).toHaveBeenCalledExactlyOnceWith('forecast_hourly', 'r1r0fsn', signal)
	})

	it('queries the current location when the geohash is blank', async () => {
		const self = fakeInstance()
		await run(self, { geohash: ' ', data: 'warnings' })
		expect(self.query).toHaveBeenCalledWith('warnings', 'r1qg2z3', expect.anything())
	})

	it('tidies up a geohash before querying it', async () => {
		const self = fakeInstance()
		await run(self, { geohash: ' R1QG2Z3XY ', data: 'location_information' })
		expect(self.query).toHaveBeenCalledWith('location_information', 'r1qg2z3', expect.anything())
	})

	it('fails without querying for something that is not a geohash', async () => {
		const self = fakeInstance()
		await expect(run(self, { geohash: 'Woodend', data: 'observations' })).rejects.toThrow('is not a geohash')
		expect(self.query).not.toHaveBeenCalled()
	})

	it('fails without querying for data this version does not offer', async () => {
		const self = fakeInstance()
		await expect(run(self, { geohash: '', data: 'tides' as QueryType })).rejects.toThrow('Unknown data "tides"')
		expect(self.query).not.toHaveBeenCalled()
	})
})
