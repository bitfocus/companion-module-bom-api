import { afterEach, describe, expect, it, vi } from 'vitest'
import BomAPI from '../main.js'
import { searchBy, type ModuleConfig } from '../config.js'

vi.mock('@companion-module/base', async (importOriginal) =>
	(await import('./instance-base.js')).mockBase(importOriginal),
)

/**
 * Runs the module against the real BOM API, to catch the API changing shape under the schemas. The fixtures can't
 * be real captures (see fixtures.ts), so this is what checks them against reality.
 *
 * Skipped unless BOM_LIVE is set, so CI never depends on the BOM being up: run with `yarn test:live`.
 */
const CONFIGS: Record<string, ModuleConfig> = {
	'Woodend, by latitude and longitude': {
		latitude: -37.3568,
		longitude: 144.5274,
		location: '',
		pollInterval: 5,
		searchBy: searchBy.LatLong,
		verbose: false,
	},
	'Darwin, by name': {
		latitude: 0,
		longitude: 0,
		location: 'Darwin',
		pollInterval: 5,
		searchBy: searchBy.Name,
		verbose: false,
	},
}

describe.runIf(process.env.BOM_LIVE)('BOM API (live)', () => {
	let instance: BomAPI | undefined
	afterEach(async () => {
		await instance?.destroy()
	})

	it.each(Object.entries(CONFIGS))(
		'%s: every response parses and becomes variables',
		async (_name, config) => {
			instance = new BomAPI({})
			instance.config = config
			const log = vi.spyOn(instance, 'log')
			const setVariableDefinitions = vi.spyOn(instance, 'setVariableDefinitions')
			const setVariableValues = vi.spyOn(instance, 'setVariableValues')

			await instance.searchLocations(config)
			expect(instance.locations.size).toBeGreaterThan(0)
			await instance.updateData()

			// Every failed request or parse is logged as a warning or error
			expect(log.mock.calls.filter(([level]) => level === 'warn' || level === 'error')).toEqual([])
			expect(instance.forecastDaily.length).toBeGreaterThan(0)
			expect(instance.forecastHourly.length).toBeGreaterThan(0)
			expect(instance.forecastHourly[0]).toHaveProperty('dew_point')
			expect(instance.observation).toBeDefined()
			expect(instance.locationInformation.geohash).toBe(instance.location.geohash)

			const definitions = setVariableDefinitions.mock.calls.at(-1)![0]
			const values = setVariableValues.mock.calls.at(-1)![0]
			expect(Object.keys(values).sort()).toEqual(Object.keys(definitions).sort())
		},
		60000,
	)
})
