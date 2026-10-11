import { describe, expect, it, vi } from 'vitest'
import type { CompanionVariableDefinitions, CompanionVariableValues } from '@companion-module/base'
import { UpdateVariableDefinitions, UpdateVariableValues, type VariablesSchema } from '../variables.js'
import {
	ForecastRequest,
	LocationInformationResponse,
	ObservationResponse,
	WarningResponse,
	type Oberservation,
} from '../interfaces.js'
import type BomAPI from '../main.js'
import { dailyForecastResponse, locationInfoResponse, observationResponse, warningsResponse } from './fixtures.js'

function fakeInstance() {
	const daily = ForecastRequest.parse(dailyForecastResponse)
	return {
		locationInformation: LocationInformationResponse.parse(locationInfoResponse).data,
		observation: ObservationResponse.parse(observationResponse).data as Oberservation | undefined,
		warnings: WarningResponse.parse(warningsResponse).data,
		forecastDaily: daily.data,
		forecastHourly: daily.data,
		recentUpdate: daily.metadata.response_timestamp,
		forecastDailyIssuedAt: daily.metadata.issue_time,
		forecaseHourlyIssuedAt: daily.metadata.issue_time,
		setVariableDefinitions: vi.fn<(defs: CompanionVariableDefinitions<VariablesSchema>) => void>(),
		setVariableValues: vi.fn<(values: CompanionVariableValues) => void>(),
	}
}

function publish(self: ReturnType<typeof fakeInstance>) {
	UpdateVariableDefinitions(self as unknown as BomAPI)
	UpdateVariableValues(self as unknown as BomAPI)
	return {
		definitions: self.setVariableDefinitions.mock.calls[0][0],
		values: self.setVariableValues.mock.calls[0][0],
	}
}

describe('variables', () => {
	it('defines exactly the variables it sets values for', () => {
		// API 2.x drops values for variables without a definition, so the two builders must not drift apart
		const { definitions, values } = publish(fakeInstance())
		expect(Object.keys(values).sort()).toEqual(Object.keys(definitions).sort())
	})

	it('keys definitions by variable id', () => {
		const { definitions } = publish(fakeInstance())
		expect(definitions['mostRecentData']).toEqual({ name: 'Most Recent Data' })
		expect(definitions['obs_wind_direction']).toEqual({ name: 'Observation: wind - direction' })
		expect(definitions['fc_day_0_rain_amount_max']).toEqual({ name: 'Daily Forecast [0]: rain - amount - max' })
		expect(definitions['fc_hour_1_temp_min']).toEqual({ name: 'Hourly Forecast [1]: temp_min' })
		expect(definitions['warn_0_title']).toEqual({ name: 'Warning [0]: title' })
	})

	it('flattens nested response fields into values', () => {
		const { values } = publish(fakeInstance())
		expect(values).toMatchObject({
			mostRecentData: '2026-10-11T07:46:07Z',
			fc_day_issued_at: '2026-10-11T07:30:58Z',
			locInfo_name: 'Woodend',
			obs_temp: 18.4,
			obs_wind_direction: 'NNW',
			obs_station_name: 'Some Station',
			warn_0_short_title: 'Severe Thunderstorm Warning',
			fc_day_0_now_temp_later: 18,
			fc_day_1_rain_chance: 85,
			fc_day_1_temp_min: 10,
		})
		// Nulls from the API become undefined
		expect(values).toHaveProperty('fc_day_0_temp_min', undefined)
		expect(values).toHaveProperty('fc_day_1_fire_danger_category_default_colour', undefined)
	})

	it('only defines the forecast fields each day carries', () => {
		const { definitions } = publish(fakeInstance())
		expect(definitions).toHaveProperty('fc_day_0_now_is_night')
		expect(definitions).not.toHaveProperty('fc_day_1_now_is_night')
	})

	it('strips fields the schemas do not declare', () => {
		const { definitions } = publish(fakeInstance())
		expect(definitions).not.toHaveProperty('obs_max_gust_time')
		expect(definitions).not.toHaveProperty('locInfo_has_wave')
		expect(definitions).not.toHaveProperty('fc_day_0_rain_amount_lower_range')
	})

	it('publishes everything else before any observation has arrived', () => {
		// The observation request failing on the first poll left observation undefined, and Object.entries threw
		const self = fakeInstance()
		self.observation = undefined
		const { definitions, values } = publish(self)
		expect(Object.keys(definitions).some((id) => id.startsWith('obs_'))).toBe(false)
		expect(values).toHaveProperty('locInfo_name', 'Woodend')
		expect(Object.keys(values).sort()).toEqual(Object.keys(definitions).sort())
	})
})
