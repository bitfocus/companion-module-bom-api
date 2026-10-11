/**
 * BOM API responses for Woodend (geohash r1qg2z3, observations from r1qg2z), as raw JSON before parsing.
 *
 * Not verbatim captures: every BOM response carries a copyright notice forbidding copying or sharing the data, so
 * these are hand-written. Their shape copies responses captured on 2026-10-11, including the parts that matter to
 * the module:
 * - fields the schemas don't declare (`max_gust`, `has_wave`, `lower_range`), which parsing strips
 * - only the first daily forecast carries `now`
 * - nulls where the API sends them (`temp_min` on the first day, `fire_danger_category` values, `postcode`)
 * - a warnings response with no warnings was the real state that day; one is added here so warn_ variables are covered
 */

const COPYRIGHT = 'Copyright notice'

export const searchResponse = {
	metadata: { response_timestamp: '2026-10-11T07:46:06Z', copyright: COPYRIGHT },
	data: [
		{ geohash: 'r1qg2z3', id: 'Woodend-r1qg2z3', name: 'Woodend', postcode: null, state: 'VIC' },
		{ geohash: 'r1r0fsn', id: 'Melbourne-r1r0fsn', name: 'Melbourne', postcode: '3000', state: 'VIC' },
	],
}

export const locationInfoResponse = {
	metadata: { response_timestamp: '2026-10-11T07:46:06Z', copyright: COPYRIGHT },
	data: {
		geohash: 'r1qg2z3',
		timezone: 'Australia/Melbourne',
		latitude: -37.35,
		longitude: 144.52,
		marine_area_id: null,
		tidal_point: null,
		has_wave: false,
		id: 'Woodend-r1qg2z3',
		name: 'Woodend',
		state: 'VIC',
	},
}

export const observationResponse = {
	metadata: {
		response_timestamp: '2026-10-11T07:46:07Z',
		issue_time: '2026-10-11T07:41:09Z',
		observation_time: '2026-10-11T07:40:00Z',
		copyright: COPYRIGHT,
	},
	data: {
		temp: 18.4,
		temp_feels_like: 15.9,
		wind: { speed_kilometre: 11, speed_knot: 6, direction: 'NNW' },
		gust: { speed_kilometre: 17, speed_knot: 9 },
		max_gust: { speed_kilometre: 35, speed_knot: 19, time: '2026-10-11T05:31:00Z' },
		rain_since_9am: 0.2,
		humidity: 52,
		station: { bom_id: '088000', name: 'Some Station', distance: 30000 },
	},
}

export const warningsResponse = {
	metadata: { response_timestamp: '2026-10-11T07:46:07Z', copyright: COPYRIGHT },
	data: [
		{
			id: 'VIC_RC000_IDV00000',
			type: 'severe_thunderstorm_warning',
			title: 'Severe Thunderstorm Warning for Central',
			short_title: 'Severe Thunderstorm Warning',
			state: 'VIC',
			warning_group_type: 'major',
			issue_time: '2026-10-11T06:00:00Z',
			expiry_time: '2026-10-11T12:00:00Z',
			phase: 'new',
		},
	],
}

export const dailyForecastResponse = {
	metadata: {
		response_timestamp: '2026-10-11T07:46:07Z',
		issue_time: '2026-10-11T07:30:58Z',
		next_issue_time: '2026-10-11T17:00:00Z',
		forecast_region: 'Central',
		forecast_type: 'public-district',
		copyright: COPYRIGHT,
	},
	data: [
		{
			rain: {
				amount: { min: 0, max: 2, lower_range: 0, upper_range: 2, units: 'mm' },
				chance: 40,
				chance_of_no_rain_category: 'medium',
				precipitation_amount_25_percent_chance: 2,
				precipitation_amount_50_percent_chance: 0,
				precipitation_amount_75_percent_chance: 0,
			},
			uv: {
				category: 'high',
				end_time: '2026-10-11T05:30:00Z',
				max_index: 7,
				start_time: '2026-10-10T22:40:00Z',
			},
			astronomical: { sunrise_time: '2026-10-10T19:43:26Z', sunset_time: '2026-10-11T08:34:40Z' },
			date: '2026-10-10T13:00:00Z',
			temp_max: 21,
			temp_min: null,
			extended_text: 'Partly cloudy. Slight chance of a shower.',
			icon_descriptor: 'shower',
			short_text: 'Shower or two.',
			surf_danger: null,
			fire_danger: null,
			fire_danger_category: { text: null, default_colour: null, dark_mode_colour: null },
			now: {
				is_night: false,
				now_label: 'Overnight min',
				later_label: "Tomorrow's max",
				temp_now: 10,
				temp_later: 18,
			},
		},
		{
			rain: {
				amount: { min: 2, max: 6, lower_range: 1, upper_range: 6, units: 'mm' },
				chance: 85,
				chance_of_no_rain_category: 'very low',
				precipitation_amount_25_percent_chance: 6,
				precipitation_amount_50_percent_chance: 2,
				precipitation_amount_75_percent_chance: 1,
			},
			uv: {
				category: 'high',
				end_time: '2026-10-12T05:40:00Z',
				max_index: 7,
				start_time: '2026-10-11T22:40:00Z',
			},
			astronomical: { sunrise_time: '2026-10-11T19:41:59Z', sunset_time: '2026-10-12T08:35:36Z' },
			date: '2026-10-11T13:00:00Z',
			temp_max: 18,
			temp_min: 10,
			extended_text: 'Cloudy. High chance of showers.',
			icon_descriptor: 'shower',
			short_text: 'Showers.',
			surf_danger: null,
			fire_danger: 'No Rating',
			fire_danger_category: { text: 'No Rating', default_colour: null, dark_mode_colour: null },
		},
	],
}

/** Requested with the 6 character geohash (r1qg2z), as the hourly endpoint rejects 7. The real response has 73 hours */
export const hourlyForecastResponse = {
	metadata: { issue_time: '2026-10-11T07:30:59Z', response_timestamp: '2026-10-11T07:59:48Z', copyright: COPYRIGHT },
	data: [
		{
			rain: {
				amount: { min: 0, max: null, units: 'mm' },
				chance: 5,
				precipitation_amount_10_percent_chance: 0,
				precipitation_amount_25_percent_chance: 0,
				precipitation_amount_50_percent_chance: 0,
			},
			temp: 18,
			temp_feels_like: 13,
			dew_point: 6,
			wind: {
				speed_knot: 11,
				speed_kilometre: 20,
				direction: 'NNW',
				gust_speed_knot: 18,
				gust_speed_kilometre: 33,
			},
			relative_humidity: 47,
			uv: 1,
			icon_descriptor: 'sunny',
			next_three_hourly_forecast_period: '2026-10-11T09:00:00Z',
			time: '2026-10-11T07:00:00Z',
			is_night: false,
			next_forecast_period: '2026-10-11T08:00:00Z',
		},
		{
			rain: {
				amount: { min: 0, max: 1, units: 'mm' },
				chance: 30,
				precipitation_amount_10_percent_chance: 1,
				precipitation_amount_25_percent_chance: 0,
				precipitation_amount_50_percent_chance: 0,
			},
			temp: 16,
			temp_feels_like: 11,
			dew_point: 7,
			wind: {
				speed_knot: 10,
				speed_kilometre: 19,
				direction: 'N',
				gust_speed_knot: 17,
				gust_speed_kilometre: 31,
			},
			relative_humidity: 55,
			uv: 0,
			icon_descriptor: 'mostly_sunny',
			next_three_hourly_forecast_period: '2026-10-11T09:00:00Z',
			time: '2026-10-11T08:00:00Z',
			is_night: true,
			next_forecast_period: '2026-10-11T09:00:00Z',
		},
	],
}
