import type BomAPI from './main.js'
import type { CompanionActionDefinitions, DropdownChoice } from '@companion-module/base'
// A default import: lodash is CommonJS, and Node's ESM loader cannot see its named exports
import _ from 'lodash'
import { parseGeohash, QUERY_CHOICES, QueryType, type QueryResponse } from './api.js'

export const NO_LOCATIONS = 'No Locations available'

export enum ActionId {
	SelectLocation = 'selectLocation',
	GetData = 'get_data',
}

export type ActionSchema = {
	[ActionId.SelectLocation]: { options: { location: string } }
	[ActionId.GetData]: { options: { geohash: string; data: QueryType }; result: QueryResponse<QueryType> }
}

export function UpdateActions(self: BomAPI): void {
	let locations: DropdownChoice<string>[] = []
	self.locations.forEach((location) => {
		locations.push({ id: location.geohash, label: `${location.name} (${location.state}:${location.postcode})` })
	})
	locations = _.orderBy(locations, ['label'], ['asc'])
	const actions: CompanionActionDefinitions<ActionSchema> = {
		[ActionId.SelectLocation]: {
			name: 'Select Location',
			options: [
				{
					id: 'location',
					type: 'dropdown',
					label: 'Location',
					choices: locations,
					// The first location by label, or a placeholder when the search found none
					default: locations[0]?.id ?? NO_LOCATIONS,
				},
			],
			callback: async (action, context) => {
				if (action.options.location == NO_LOCATIONS) return
				const location = self.locations.get(action.options.location)
				if (location) {
					self.location = location
					self.updateActions() // so Get Data defaults to the new location
					await self.updateData(location.geohash, context.signal)
				}
			},
		},
		[ActionId.GetData]: {
			name: 'Get Data',
			description: 'Fetch data for a geohash, and return the whole response as the action result',
			options: [
				{
					id: 'geohash',
					type: 'textinput',
					label: 'Geohash',
					// The location current when the action is added. Blank uses whatever is current when it runs
					default: self.location.geohash,
					tooltip: 'Leave blank to use the current location',
					useVariables: true,
				},
				{
					id: 'data',
					type: 'dropdown',
					label: 'Data',
					choices: QUERY_CHOICES,
					default: QUERY_CHOICES[0].id,
				},
			],
			hasResult: true,
			callback: async (action, context) => {
				// A saved value this version no longer offers
				if (!QueryType.includes(action.options.data)) throw new Error(`Unknown data "${action.options.data}"`)
				const geohash = parseGeohash(action.options.geohash) ?? self.location.geohash
				return await self.query(action.options.data, geohash, context.signal)
			},
		},
	}
	self.setActionDefinitions(actions)
}
