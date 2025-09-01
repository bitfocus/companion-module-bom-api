import { z } from 'zod'

export const Location = z.object({
	geohash: z
		.string()
		.min(6, { message: 'Must be at least 6 characters long' })
		.max(7, { message: 'Must be no more than 7 characters long' }),
	id: z.string(),
	name: z.string(),
	postcode: z.string().nullable(),
	state: z.string(),
})

export type Location = z.infer<typeof Location>

export const LocationInformation = z.object({
	geohash: z
		.string()
		.min(6, { message: 'Must be at least 6 characters long' })
		.max(7, { message: 'Must be no more than 7 characters long' }),
	timezone: z.string(),
	latitude: z.number(),
	longitude: z.number(),
	marine_area_id: z.string().nullable().optional(),
	tidal_point: z.string().nullable().optional(),
	id: z.string(),
	name: z.string(),
	state: z.string(),
})

export type LocationInformation = z.infer<typeof LocationInformation>

export const LocationInformationResponse = z.object({
	metadata: z.object({
		response_timestamp: z.string(),
	}),
	data: LocationInformation,
})

export type LocationInformationResponse = z.infer<typeof LocationInformationResponse>

export const SearchResponse = z.object({
	metadata: z.object({
		response_timestamp: z.string(),
		copyright: z.string().nullable().optional(),
	}),
	data: z.array(Location),
})

export type SearchResponse = z.infer<typeof SearchResponse>

export const ForecastItem = z.object({
	rain: z.object({
		amount: z.object({
			min: z.number().min(0).nullable().optional(),
			max: z.number().min(0).nullable().optional(),
			units: z.string().nullable().optional(),
		}),
		chance: z.number().min(0).max(100).nullable().optional(),
		chance_of_no_rain_category: z.string().nullable(),
		precipitation_amount_25_percent_chance: z.number().min(0).nullable(),
		precipitation_amount_50_percent_chance: z.number().min(0).nullable(),
		precipitation_amount_75_percent_chance: z.number().min(0).nullable(),
	}),
	uv: z.object({
		category: z.string().nullable().optional(),
		end_time: z.string().nullable().optional(),
		max_index: z.number().nullable().optional(),
		start_time: z.string().nullable(),
	}),
	astronomical: z.object({
		sunrise_time: z.string(),
		sunset_time: z.string(),
	}),
	fire_danger_category: z.object({
		text: z.string().nullable(),
		default_colour: z.string().nullable(),
		dark_mode_colour: z.string().nullable(),
	}),
	now: z
		.object({
			is_night: z.boolean(),
			now_label: z.string(),
			later_label: z.string(),
			temp_now: z.number(),
			temp_later: z.number(),
		})
		.optional(),
	date: z.string(),
	temp_max: z.number().nullable().optional(),
	temp_min: z.number().nullable().optional(),
	extended_text: z.string().nullable(),
	short_text: z.string().nullable(),
	icon_descriptor: z.string().nullable(),
	fire_danger: z.string().nullable().optional(),
	surf_danger: z.string().nullable(),
})

export type ForecastItem = z.infer<typeof ForecastItem>

export const ForecastRequest = z.object({
	data: z.array(ForecastItem),
	metadata: z.object({
		response_timestamp: z.string(),
		issue_time: z.string(),
		next_issue_time: z.string(),
		forecast_region: z.string(),
		forecast_type: z.string(),
		copyright: z.string(),
	}),
})

export type ForecastRequest = z.infer<typeof ForecastRequest>

export const Oberservation = z.object({
	temp: z.number().nullable().optional(),
	temp_feels_like: z.number().nullable().optional(),
	rain_since_9am: z.number().min(0).nullable().optional(),
	humidity: z.number().min(0).nullable().optional(),
	wind: z
		.object({
			speed_kilometre: z.number().min(0).nullable().optional(),
			speed_knot: z.number().min(0).nullable().optional(),
			direction: z.string().nullable().optional(),
		})
		.optional(),
	gust: z
		.object({
			speed_kilometre: z.number().min(0).nullable().optional(),
			speed_knot: z.number().min(0).nullable().optional(),
		})
		.optional(),
	station: z
		.object({
			bom_id: z.string(),
			name: z.string(),
			distance: z.number(),
		})
		.optional(),
})

export type Oberservation = z.infer<typeof Oberservation>

export const ObservationResponse = z.object({
	metadata: z.object({
		response_timestamp: z.string(),
		issue_time: z.string(),
	}),
	data: Oberservation,
})

export type ObservationResponse = z.infer<typeof ObservationResponse>

export const Warning = z.object({
	id: z.string(),
	type: z.string(),
	title: z.string(),
	short_title: z.string(),
	state: z.string(),
	warning_group_type: z.string(),
	issue_time: z.string(),
	expiry_time: z.string(),
	phase: z.string(),
})

export type Warning = z.infer<typeof Warning>

export const WarningResponse = z.object({
	metadata: z.object({
		response_timestamp: z.string(),
	}),
	data: z.array(Warning),
})

export type WarningResponse = z.infer<typeof WarningResponse>
