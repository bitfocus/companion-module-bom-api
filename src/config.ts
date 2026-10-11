import { type DropdownChoice, type SomeCompanionConfigField } from '@companion-module/base'

export enum searchBy {
	LatLong = 'latLong',
	Name = 'name',
}

export const SEARCH_BY_CHOICES = [
	{ id: searchBy.LatLong, label: 'Latitude & Longitude' },
	{ id: searchBy.Name, label: 'Name' },
] as const satisfies DropdownChoice<searchBy>[]

// A type alias, not an interface: InstanceTypes requires config to satisfy JsonObject, and interfaces don't
export type ModuleConfig = {
	latitude: number
	longitude: number
	location: string
	pollInterval: number
	searchBy: searchBy
	verbose: boolean
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'dropdown',
			id: 'searchBy',
			label: 'Search Geohash by',
			width: 6,
			default: SEARCH_BY_CHOICES[0].id,
			choices: SEARCH_BY_CHOICES,
		},
		{
			type: 'number',
			id: 'latitude',
			label: 'Latitude',
			width: 4,
			min: -45,
			max: -10,
			default: -37.3568,
			step: 0.0001,
			isVisibleExpression: `$(options:searchBy) == '${searchBy.LatLong}'`,
		},
		{
			type: 'number',
			id: 'longitude',
			label: 'Longitude',
			width: 4,
			min: 110,
			max: 160,
			default: 144.5274,
			step: 0.0001,
			isVisibleExpression: `$(options:searchBy) == '${searchBy.LatLong}'`,
		},
		{
			type: 'textinput',
			id: 'location',
			label: 'Location',
			width: 8,
			regex: '/^([0-9a-zA-Z]{1})([0-9a-zA-Z -]{1,})([0-9a-zA-Z]{1})$/',
			default: 'Adelaide',
			isVisibleExpression: `$(options:searchBy) == '${searchBy.Name}'`,
		},
		{
			type: 'number',
			id: 'pollInterval',
			label: 'Poll Interval (m)',
			width: 4,
			min: 1,
			max: 120,
			default: 5,
			range: true,
			step: 1,
		},
		{
			type: 'checkbox',
			id: 'verbose',
			label: 'Verbose Logs',
			default: false,
			width: 4,
		},
	]
}
