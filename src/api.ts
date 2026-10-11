import type { DropdownChoice } from '@companion-module/base'
import { isAxiosError } from 'axios'
import type { z } from 'zod'
import {
	ApiErrorResponse,
	ForecastRequest,
	HourlyForecastResponse,
	LocationInformationResponse,
	ObservationResponse,
	WarningResponse,
} from './interfaces.js'

export const API_ENDPOINT = `https://api.weather.bom.gov.au/v1/`
export const API_TIMEOUT = 5000
export const API_HEADERS = { 'Content-Type': 'application/json' }
export const API_PATHS = {
	LocationInformation: (geohash: string): string => `locations/${geohash}`,
	LocationSearch: (): string => `locations`,
	ForecastDaily: (geohash: string): string => `locations/${geohash.trim().substring(0, 7)}/forecasts/daily`,
	ForecastHourly: (geohash: string): string => `locations/${geohash.trim().substring(0, 6)}/forecasts/hourly`, //geohash must be 6 digit for Hourly Forecast
	Observations: (geohash: string): string => `locations/${geohash.trim().substring(0, 6)}/observations`, //geohash must be 6 digit for Observation Station
	Warnings: (geohash: string): string => `locations/${geohash.trim().substring(0, 7)}/warnings`,
}

/** The kinds of data that can be fetched for a geohash */
export const QueryType = [
	'observations',
	'forecast_daily',
	'forecast_hourly',
	'warnings',
	'location_information',
] as const
export type QueryType = (typeof QueryType)[number]

/** The path and schema for each kind of data, kept together so a query can never parse with the wrong schema */
export const QUERIES = {
	observations: { label: 'Observations', path: API_PATHS.Observations, schema: ObservationResponse },
	forecast_daily: { label: 'Daily Forecast', path: API_PATHS.ForecastDaily, schema: ForecastRequest },
	forecast_hourly: { label: 'Hourly Forecast', path: API_PATHS.ForecastHourly, schema: HourlyForecastResponse },
	warnings: { label: 'Warnings', path: API_PATHS.Warnings, schema: WarningResponse },
	location_information: {
		label: 'Location Information',
		path: API_PATHS.LocationInformation,
		schema: LocationInformationResponse,
	},
} as const satisfies Record<QueryType, { label: string; path: (geohash: string) => string; schema: z.ZodType }>

export type QueryResponse<T extends QueryType> = z.infer<(typeof QUERIES)[T]['schema']>

export const QUERY_CHOICES: DropdownChoice<QueryType>[] = QueryType.map((id) => ({ id, label: QUERIES[id].label }))

const GEOHASH = /^[0-9b-hjkmnp-z]{6,}$/

/**
 * The geohash to query for what a user typed, or undefined when it is blank. Lower cased, and cut to the 7 characters
 * the API takes: a longer geohash is a smaller cell inside the 7 character one, so that is still the right place.
 * @throws If it is not a geohash of at least 6 characters
 */
export function parseGeohash(input: string): string | undefined {
	const geohash = input.trim().toLowerCase()
	if (geohash === '') return undefined
	if (!GEOHASH.test(geohash)) throw new Error(`"${input}" is not a geohash of at least 6 characters`)
	return geohash.substring(0, 7)
}

/** Why a request failed, in the BOM's own words where it gave any, eg "No locations: Location cannot be found." */
export function describeError(error: unknown): string {
	if (isAxiosError(error) && error.response) {
		const body = ApiErrorResponse.safeParse(error.response.data)
		if (body.success) return body.data.errors.map(({ title, detail }) => `${title}: ${detail}`).join(', ')
		return `HTTP ${error.response.status}`
	}
	return error instanceof Error ? error.message : String(error)
}
