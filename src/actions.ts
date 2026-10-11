import type BomAPI from './main.js'
import type { CompanionActionDefinitions, DropdownChoice } from '@companion-module/base'
// A default import: lodash is CommonJS, and Node's ESM loader cannot see its named exports
import _ from 'lodash'

export const NO_LOCATIONS = 'No Locations available'

export enum ActionId {
	SelectLocation = 'selectLocation',
}

export type ActionSchema = {
	[ActionId.SelectLocation]: { options: { location: string } }
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
					await self.updateData(location.geohash, context.signal)
				}
			},
		},
	}
	self.setActionDefinitions(actions)
}
