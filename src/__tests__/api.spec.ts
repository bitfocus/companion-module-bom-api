import { describe, expect, it } from 'vitest'
import { AxiosError } from 'axios'
import { z } from 'zod'
import { describeError, parseGeohash, QUERIES, QUERY_CHOICES, QueryType } from '../api.js'
import { httpError, notFoundResponse } from './fixtures.js'

describe('parseGeohash', () => {
	it('treats blank as no geohash', () => {
		expect(parseGeohash('')).toBeUndefined()
		expect(parseGeohash('   ')).toBeUndefined()
	})

	it('accepts 6 and 7 character geohashes, trimmed and lower cased', () => {
		expect(parseGeohash('r1qg2z')).toBe('r1qg2z')
		expect(parseGeohash(' R1QG2Z3 ')).toBe('r1qg2z3')
	})

	it('cuts a longer geohash to the 7 characters the API takes', () => {
		// The API rejects anything over 7 with 400 "The geohash string was not 6-7 character."
		expect(parseGeohash('r1qg2z3xy')).toBe('r1qg2z3')
	})

	it.each(['r1qg2', 'r1qg2a', 'r1qg2i3', 'woodend', '$(local:geohash)'])('rejects "%s"', (input) => {
		expect(() => parseGeohash(input)).toThrow('is not a geohash')
	})
})

describe('describeError', () => {
	it("gives the BOM's own explanation where the response has one", () => {
		expect(describeError(httpError(404, notFoundResponse))).toBe('No locations: Location cannot be found.')
	})

	it('lists what zod found wrong with a response that is not the expected shape', () => {
		const result = z.object({ data: z.object({ temp: z.number() }) }).safeParse({ data: { temp: 'hot' } })
		expect(describeError(result.error)).toBe('✖ Invalid input: expected number, received string\n  → at data.temp')
	})

	it('falls back to the status for a response without one, and the message for no response', () => {
		expect(describeError(httpError(502, '<html>Bad Gateway</html>'))).toBe('HTTP 502')
		expect(describeError(new AxiosError('timeout of 5000ms exceeded', 'ECONNABORTED'))).toBe(
			'timeout of 5000ms exceeded',
		)
		expect(describeError('odd')).toBe('odd')
	})
})

describe('queries', () => {
	it('offers every query type, in order', () => {
		expect(QUERY_CHOICES.map((choice) => choice.id)).toEqual([...QueryType])
		expect(QUERY_CHOICES.map((choice) => choice.label)).toEqual([
			'Observations',
			'Daily Forecast',
			'Hourly Forecast',
			'Warnings',
			'Location Information',
		])
	})

	it('uses the geohash length each endpoint accepts', () => {
		// Observations and hourly forecasts take exactly 6 characters, the rest 6 or 7
		expect(QUERIES.observations.path('r1qg2z3')).toBe('locations/r1qg2z/observations')
		expect(QUERIES.forecast_hourly.path('r1qg2z3')).toBe('locations/r1qg2z/forecasts/hourly')
		expect(QUERIES.forecast_daily.path('r1qg2z3')).toBe('locations/r1qg2z3/forecasts/daily')
		expect(QUERIES.warnings.path('r1qg2z3')).toBe('locations/r1qg2z3/warnings')
		expect(QUERIES.location_information.path('r1qg2z3')).toBe('locations/r1qg2z3')
	})
})
