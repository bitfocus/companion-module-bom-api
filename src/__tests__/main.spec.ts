import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CanceledError, type AxiosInstance } from 'axios'
import { InstanceStatus } from '@companion-module/base'
import BomAPI from '../main.js'
import { searchBy, type ModuleConfig } from '../config.js'
import { StatusManager } from '../status.js'
import {
	dailyForecastResponse,
	hourlyForecastResponse,
	locationInfoResponse,
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
	let get: ReturnType<typeof vi.fn<(path: string) => Promise<{ data: unknown }>>>

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

	it('stops issuing requests once the signal aborts, but still publishes and keeps polling', async () => {
		const controller = new AbortController()
		const setVariableValues = vi.spyOn(instance, 'setVariableValues')
		const log = vi.spyOn(instance, 'log')
		get.mockImplementationOnce(async (path) => {
			controller.abort()
			return { data: responseFor(path) }
		})
		await instance.updateData('r1r0fsn', controller.signal)
		expect(get).toHaveBeenCalledTimes(1)
		expect(setVariableValues).toHaveBeenCalledOnce()
		// The queue would drop the rest anyway, but each would then be logged as a failed request
		expect(log).not.toHaveBeenCalledWith('warn', expect.anything())

		// The poll it schedules is not tied to the aborted action, and fetches the location that action chose
		await vi.advanceTimersByTimeAsync(POLL_MS)
		expect(get).toHaveBeenCalledTimes(1 + REQUESTS_PER_UPDATE)
		expect(
			paths()
				.slice(1)
				.every((path) => path.includes('r1r0fs')),
		).toBe(true)
	})

	it('drops a request still waiting in the queue once its signal aborts', async () => {
		// Hold the queue with a poll whose first request has not returned
		let release!: () => void
		get.mockImplementationOnce(async (path) => {
			await new Promise<void>((resolve) => (release = resolve))
			return { data: responseFor(path) }
		})
		const poll = instance.updateData('r1qg2z3')
		await vi.advanceTimersByTimeAsync(0)

		const controller = new AbortController()
		const action = instance.updateData('r1r0fsn', controller.signal)
		await vi.advanceTimersByTimeAsync(0)
		controller.abort()
		await action
		release()
		await poll

		expect(paths().some((path) => path.includes('r1r0fs'))).toBe(false)
	})

	it('does not report a cancelled request as a connection failure', async () => {
		const updateStatus = vi.spyOn(StatusManager.prototype, 'updateStatus')
		get.mockRejectedValueOnce(new CanceledError())
		get.mockRejectedValueOnce(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }))
		await instance.getForecastDaily('r1qg2z3')
		expect(updateStatus).not.toHaveBeenCalledWith(InstanceStatus.ConnectionFailure, expect.anything())

		// Anything else still is
		await instance.getForecastDaily('r1qg2z3')
		expect(updateStatus).toHaveBeenCalledWith(InstanceStatus.ConnectionFailure, 'ECONNREFUSED')
	})
})
