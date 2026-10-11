import type BomAPI from './main.js'
import type { CompanionVariableDefinitions, CompanionVariableValues } from '@companion-module/base'

// Variable ids are built from whatever fields the API returns, so they are not known ahead of time
export type VariablesSchema = CompanionVariableValues

export function UpdateVariableDefinitions(self: BomAPI): void {
	const variableDefs: CompanionVariableDefinitions<VariablesSchema> = {}
	variableDefs[`mostRecentData`] = { name: `Most Recent Data` }
	for (const [key, _value] of Object.entries(self.locationInformation)) {
		variableDefs[`locInfo_${key}`] = { name: `Location Info: ${key}` }
	}
	for (const [key, value] of Object.entries(self.observation ?? {})) {
		if (typeof value == 'object' && value !== null) {
			for (const [key2, _value2] of Object.entries(value)) {
				variableDefs[`obs_${key}_${key2}`] = { name: `Observation: ${key} - ${key2}` }
			}
		} else {
			variableDefs[`obs_${key}`] = { name: `Observation: ${key}` }
		}
	}
	for (const [i, warning] of self.warnings.entries()) {
		for (const [key, _value] of Object.entries(warning)) {
			variableDefs[`warn_${i}_${key}`] = { name: `Warning [${i}]: ${key}` }
		}
	}
	for (const [i, forecast] of self.forecastDaily.entries()) {
		for (const [key, value] of Object.entries(forecast)) {
			if (typeof value == 'object' && value !== null) {
				for (const [key2, value2] of Object.entries(value)) {
					if (typeof value2 == 'object' && value2 !== null) {
						for (const [key3, _value3] of Object.entries(value2)) {
							variableDefs[`fc_day_${i}_${key}_${key2}_${key3}`] = {
								name: `Daily Forecast [${i}]: ${key} - ${key2} - ${key3}`,
							}
						}
					} else {
						variableDefs[`fc_day_${i}_${key}_${key2}`] = {
							name: `Daily Forecast [${i}]: ${key} - ${key2}`,
						}
					}
				}
			} else {
				variableDefs[`fc_day_${i}_${key}`] = { name: `Daily Forecast [${i}]: ${key}` }
			}
		}
	}
	for (const [i, forecast] of self.forecastHourly.entries()) {
		for (const [key, value] of Object.entries(forecast)) {
			if (typeof value == 'object' && value !== null) {
				for (const [key2, value2] of Object.entries(value)) {
					if (typeof value2 == 'object' && value2 !== null) {
						for (const [key3, _value3] of Object.entries(value2)) {
							variableDefs[`fc_hour_${i}_${key}_${key2}_${key3}`] = {
								name: `Hourly Forecast [${i}]: ${key} - ${key2} - ${key3}`,
							}
						}
					} else {
						variableDefs[`fc_hour_${i}_${key}_${key2}`] = {
							name: `Hourly Forecast [${i}]: ${key} - ${key2}`,
						}
					}
				}
			} else {
				variableDefs[`fc_hour_${i}_${key}`] = { name: `Hourly Forecast [${i}]: ${key}` }
			}
		}
	}
	variableDefs[`fc_hour_issued_at`] = {
		name: `Hourly Forecast Issued At`,
	}
	variableDefs[`fc_day_issued_at`] = {
		name: `Daliy Forecast Issued At`,
	}
	self.setVariableDefinitions(variableDefs)
}

export function UpdateVariableValues(self: BomAPI): void {
	const values: CompanionVariableValues = {}
	values['mostRecentData'] = self.recentUpdate
	values['fc_day_issued_at'] = self.forecastDailyIssuedAt
	values['fc_hour_issued_at'] = self.forecaseHourlyIssuedAt
	for (const [key, value] of Object.entries(self.locationInformation)) {
		values[`locInfo_${key}`] = value ?? undefined
	}
	for (const [key, value] of Object.entries(self.observation ?? {})) {
		if (typeof value == 'object' && value !== null) {
			for (const [key2, value2] of Object.entries(value)) {
				values[`obs_${key}_${key2}`] = value2 ?? undefined
			}
		} else {
			values[`obs_${key}`] = value ?? undefined
		}
	}
	for (const [i, warning] of self.warnings.entries()) {
		for (const [key, value] of Object.entries(warning)) {
			values[`warn_${i}_${key}`] = value
		}
	}
	for (const [i, forecast] of self.forecastDaily.entries()) {
		for (const [key, value] of Object.entries(forecast)) {
			if (typeof value == 'object' && value !== null) {
				for (const [key2, value2] of Object.entries(value)) {
					if (typeof value2 == 'object' && value2 !== null) {
						for (const [key3, value3] of Object.entries(value2)) {
							if (typeof value3 == 'number' || typeof value3 == 'string') {
								values[`fc_day_${i}_${key}_${key2}_${key3}`] = value3
							} else {
								values[`fc_day_${i}_${key}_${key2}_${key3}`] = undefined
							}
						}
					} else {
						values[`fc_day_${i}_${key}_${key2}`] = value2 ?? undefined
					}
				}
			} else {
				values[`fc_day_${i}_${key}`] = value ?? undefined
			}
		}
	}
	for (const [i, forecast] of self.forecastHourly.entries()) {
		for (const [key, value] of Object.entries(forecast)) {
			if (typeof value == 'object' && value !== null) {
				for (const [key2, value2] of Object.entries(value)) {
					if (typeof value2 == 'object' && value2 !== null) {
						for (const [key3, value3] of Object.entries(value2)) {
							if (typeof value3 == 'number' || typeof value3 == 'string') {
								values[`fc_hour_${i}_${key}_${key2}_${key3}`] = value3
							} else {
								values[`fc_hour_${i}_${key}_${key2}_${key3}`] = undefined
							}
						}
					} else {
						values[`fc_hour_${i}_${key}_${key2}`] = value2 ?? undefined
					}
				}
			} else {
				values[`fc_hour_${i}_${key}`] = value ?? undefined
			}
		}
	}
	self.setVariableValues(values)
}
