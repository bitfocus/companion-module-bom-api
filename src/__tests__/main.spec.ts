import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { InstanceStatus, type CompanionActionCallbackContext, type CompanionActionEvent } from '@companion-module/base'
import BomAPI from '../main.js'
import { ActionId } from '../actions.js'
import { SearchResponse } from '../interfaces.js'
import { searchBy, type ModuleConfig } from '../config.js'
import { StatusManager } from '../status.js'
import {
	dailyForecastResponse,
	hourlyForecastResponse,
	httpError,
	searchResponse,
	locationInfoResponse,
	notFoundResponse,
	observationResponse,
	warningsResponse,
} from './fixtures.js'

vi.mock('@companion-module/base', async (importOriginal) =>
	(await import('./instance-base.js')).mockBase(importOriginal),
)

const CONFIG: ModuleConfig = {
	latitude: -37.3568,
	longitude: 144.5274,
	location: 'Woodend',
	pollInterval: 5,
	searchBy: searchBy.LatLong,
	verbose: false,
}
const POLL_MS = CONFIG.pollInterval * 60000
const REQUESTS_PER_UPDATE = 5

function responseFor(path: string): unknown {
	if (path.endsWith('/forecasts/daily')) return dailyForecastResponse
	if (path.endsWith('/forecasts/hourly')) return hourlyForecastResponse
	if (path.endsWith('/observations')) return observationResponse
	if (path.endsWith('/warnings')) return warningsResponse
	if (/^locations\/\w+$/.test(path)) return locationInfoResponse
	throw new Error(`No fixture for ${path}`)
}

describe('BomAPI', () => {
	let instance: BomAPI
	let get: ReturnType<typeof vi.fn<(path: string, config?: object) => Promise<{ data: unknown }>>>

	beforeEach(() => {
		vi.useFakeTimers()
		instance = new BomAPI({})
		instance.config = CONFIG
		get = vi.fn(async (path: string) => ({ data: responseFor(path) }))
		instance.axios = { get } as unknown as AxiosInstance
	})
	afterEach(async () => {
		await instance.destroy()
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	const paths = () => get.mock.calls.map(([path]) => path)

	it('fetches all five endpoints and polls again after the interval', async () => {
		await instance.updateData('r1qg2z3')
		expect(get).toHaveBeenCalledTimes(REQUESTS_PER_UPDATE)
		await vi.advanceTimersByTimeAsync(POLL_MS)
		expect(get).toHaveBeenCalledTimes(2 * REQUESTS_PER_UPDATE)
	})

	it('fetches the hourly forecast from the hourly endpoint, with the 6 character geohash it requires', async () => {
		// The hourly request went to the daily endpoint, so the hourly variables held daily forecasts
		await instance.updateData('r1qg2z3')
		expect(paths()).toContain('locations/r1qg2z/forecasts/hourly')
		expect(paths().filter((path) => path.endsWith('/forecasts/daily'))).toHaveLength(1)
		expect(instance.forecastHourly.map((hour) => hour.time)).toEqual(['2026-10-11T07:00:00Z', '2026-10-11T08:00:00Z'])
		expect(instance.forecaseHourlyIssuedAt).toBe('2026-10-11T07:30:59Z')
	})

	it('keeps polling when the observation request fails on the first poll', async () => {
		get.mockImplementation(async (path) => {
			if (path.endsWith('/observations')) throw Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })
			return { data: responseFor(path) }
		})
		await instance.updateData('r1qg2z3')
		expect(instance.observation).toBeUndefined()
		await vi.advanceTimersByTimeAsync(POLL_MS)
		expect(get).toHaveBeenCalledTimes(2 * REQUESTS_PER_UPDATE)
	})

	it('finishes fetching a location chosen with Select Location, even when the action is aborted', async () => {
		// Aborting doesn't undo the change of location. Stopping part way left variables from both locations
		for (const location of SearchResponse.parse(searchResponse).data) instance.locations.set(location.geohash, location)
		const setActionDefinitions = vi.spyOn(instance, 'setActionDefinitions')
		instance.updateActions()
		const selectLocation = setActionDefinitions.mock.calls[0][0][ActionId.SelectLocation]
		if (!selectLocation) throw new Error('selectLocation not defined')
		const controller = new AbortController()
		get.mockImplementationOnce(async (path) => {
			controller.abort()
			return { data: responseFor(path) }
		})
		await selectLocation.callback(
			{ options: { location: 'r1r0fsn' } } as CompanionActionEvent<{ location: string }>,
			{ signal: controller.signal } as CompanionActionCallbackContext,
		)
		expect(paths()).toHaveLength(REQUESTS_PER_UPDATE)
		expect(paths().every((path) => path.includes('r1r0fs'))).toBe(true)
		// Including the response to the request that was in flight when the action aborted
		expect(instance.forecastDaily).toHaveLength(2)
	})

	it('logs why a request failed, rather than an error object stringified as {}', async () => {
		const log = vi.spyOn(instance, 'log')
		get.mockImplementationOnce(() => {
			throw new TypeError('something unexpected')
		})
		get.mockResolvedValueOnce({ data: warningsResponse })
		await instance.getForecastDaily('r1qg2z3')
		await instance.getForecastDaily('r1qg2z3')
		expect(log).toHaveBeenCalledWith('warn', 'Daily Forecast request failed: something unexpected')
		// A response that fails the schema logs each problem zod found, and where
		expect(log).toHaveBeenCalledWith(
			'warn',
			expect.stringMatching(
				/^Daily Forecast request failed: ✖ .*\n✖ Invalid input: expected object, received undefined\n {2}→ at data\[0\]\.rain\n/s,
			),
		)
	})

	it('reports a failed request as a connection failure', async () => {
		const updateStatus = vi.spyOn(StatusManager.prototype, 'updateStatus')
		get.mockRejectedValueOnce(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }))
		await instance.getForecastDaily('r1qg2z3')
		expect(updateStatus).toHaveBeenCalledWith(InstanceStatus.ConnectionFailure, 'ECONNREFUSED')
	})

	describe('query, for the Get Data action', () => {
		it('returns the whole parsed response, leaving the module state alone', async () => {
			const { signal } = new AbortController()
			const result = await instance.query('forecast_daily', 'r1qg2z3', signal)
			expect(get).toHaveBeenCalledExactlyOnceWith('locations/r1qg2z3/forecasts/daily', { signal })
			expect(result.metadata.issue_time).toBe('2026-10-11T07:30:58Z')
			expect(result.data).toHaveLength(2)
			expect(result.data[0].now?.temp_later).toBe(18)
			// Parsed, not passed through: fields the schema does not declare are gone
			expect(result.data[0].rain.amount).not.toHaveProperty('lower_range')
			expect(instance.forecastDaily).toEqual([])
		})

		it('requests each kind of data with the geohash length its endpoint takes', async () => {
			const result = await instance.query('forecast_hourly', 'r1qg2z3')
			expect(paths()).toEqual(['locations/r1qg2z/forecasts/hourly'])
			expect(result.data[0].wind.gust_speed_kilometre).toBe(33)
		})

		it("fails with the BOM's explanation, leaving the connection status alone", async () => {
			const updateStatus = vi.spyOn(StatusManager.prototype, 'updateStatus')
			get.mockRejectedValueOnce(httpError(404, notFoundResponse))
			await expect(instance.query('location_information', 'r7zzzzz')).rejects.toThrow(
				'Location Information request for r7zzzzz failed: No locations: Location cannot be found.',
			)
			expect(updateStatus).not.toHaveBeenCalled()
		})

		it('fails on a response that does not match the schema', async () => {
			get.mockResolvedValueOnce({ data: warningsResponse })
			await expect(instance.query('observations', 'r1qg2z3')).rejects.toThrow('expected object')
		})
	})
})
