//import { combineRgb } from '@companion-module/base'
import type BomAPI from './main.js'

export type FeedbackSchema = Record<string, never>

export function UpdateFeedbacks(self: BomAPI): void {
	self.setFeedbackDefinitions({})
}
