import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, searchBy, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions, UpdateVariableValues, type VariablesSchema } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionSchema } from './actions.js'
import { UpdateFeedbacks, type FeedbackSchema } from './feedbacks.js'
import { SearchResponse } from './interfaces.js'
import {
	ForecastItem,
	ForecastRequest,
	HourlyForecastItem,
	HourlyForecastResponse,
	Location,
	LocationInformation,
	LocationInformationResponse,
	Oberservation,
	ObservationResponse,
	Warning,
	WarningResponse,
} from './interfaces.js'
import { StatusManager } from './status.js'
import { AxiosInstance, AxiosResponse } from 'axios'
import PQueue from 'p-queue'
import axios from 'axios'

const API_ENDPOINT = `https://api.weather.bom.gov.au/v1/`
const API_TIMEOUT = 5000
const API_HEADERS = { 'Content-Type': 'application/json' }
const API_PATHS = {
	LocationInformation: (geohash: string) => `locations/${geohash}`,
	LocationSearch: () => `locations`,
	ForecastDaily: (geohash: string) => `locations/${geohash.trim().substring(0, 7)}/forecasts/daily`,
	ForecastHourly: (geohash: string) => `locations/${geohash.trim().substring(0, 6)}/forecasts/hourly`, //geohash must be 6 digit for Hourly Forecast
	Observations: (geohash: string) => `locations/${geohash.trim().substring(0, 6)}/observations`, //geohash must be 6 digit for Observation Station
	Warnings: (geohash: string) => `locations/${geohash.trim().substring(0, 7)}/warnings`,
}

export type ModuleTypes = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionSchema
	feedbacks: FeedbackSchema
	variables: VariablesSchema
}

export { UpgradeScripts }

export default class BomAPI extends InstanceBase<ModuleTypes> {
	config!: ModuleConfig // Setup in init()
	queue = new PQueue({ concurrency: 1 })
	private statusManager = new StatusManager(this, { status: InstanceStatus.Connecting, message: 'Initialising' }, 2000)
	axios: AxiosInstance = axios.create({
		baseURL: API_ENDPOINT,
		timeout: API_TIMEOUT,
		headers: API_HEADERS,
	})
	location: Location = {
		geohash: 'r1qg2z3',
		id: 'Woodend-r1qg2z3',
		name: 'Woodend',
		postcode: null,
		state: 'VIC',
	}
	locationInformation: LocationInformation = {
		geohash: 'r1qg2z3',
		id: 'Woodend-r1qg2z3',
		name: 'Woodend',
		state: 'VIC',
		timezone: '',
		latitude: -37.3568,
		longitude: 144.5274,
	}
	locations: Map<string, Location> = new Map()
	observation: Oberservation | undefined = undefined // Until the first observation request succeeds
	forecastDaily: ForecastItem[] = []
	forecastDailyIssuedAt: string = ''
	forecastHourly: HourlyForecastItem[] = []
	forecaseHourlyIssuedAt: string = ''
	warnings: Warning[] = []
	recentUpdate: string = ''
	pollTimer!: NodeJS.Timeout

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
		this.configUpdated(config).catch(() => {})
	}
	// When module gets deleted
	async destroy(): Promise<void> {
		this.log('debug', `destroy ${this.id}:${this.label}`)
		if (this.pollTimer) clearInterval(this.pollTimer)
		this.statusManager.destroy()
		this.queue.clear()
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		if (this.pollTimer) clearInterval(this.pollTimer)
		this.config = config
		this.queue.clear()
		await this.searchLocations(config)
		this.updateData().catch(() => {})
		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updateVariableDefinitions() // export variable definitions
	}

	public async getForecastHourly(geohash: string = this.location.geohash, signal?: AbortSignal): Promise<void> {
		try {
			const response = await this.queryApi(API_PATHS.ForecastHourly(geohash), undefined, signal)
			const forecasts = HourlyForecastResponse.parse(response?.data)
			this.recentUpdate = forecasts.metadata.response_timestamp
			this.forecastHourly = forecasts.data
			this.forecaseHourlyIssuedAt = forecasts.metadata.issue_time
		} catch (e: any) {
			this.log('warn', `Hourly Forecast request failed: ${typeof e == 'object' ? JSON.stringify(e) : String(e)}`)
		}
	}

	public async getForecastDaily(geohash: string = this.location.geohash, signal?: AbortSignal): Promise<void> {
		try {
			const response = await this.queryApi(API_PATHS.ForecastDaily(geohash), undefined, signal)
			const forecasts = ForecastRequest.parse(response?.data)
			this.recentUpdate = forecasts.metadata.response_timestamp
			this.forecastDaily = forecasts.data
			this.forecastDailyIssuedAt = forecasts.metadata.issue_time
		} catch (e: any) {
			this.log('warn', `Daily Forecast request failed: ${typeof e == 'object' ? JSON.stringify(e) : String(e)}`)
		}
	}

	public async getWarnings(geohash: string = this.location.geohash, signal?: AbortSignal): Promise<void> {
		try {
			const response = await this.queryApi(API_PATHS.Warnings(geohash), undefined, signal)
			const warnings = WarningResponse.parse(response?.data)
			this.recentUpdate = warnings.metadata.response_timestamp
			this.warnings = warnings.data
		} catch (e: any) {
			this.log('warn', `Warnings request failed: ${typeof e == 'object' ? JSON.stringify(e) : String(e)}`)
		}
	}

	public async getLocationInfo(geohash: string = this.location.geohash, signal?: AbortSignal): Promise<void> {
		try {
			const response = await this.queryApi(API_PATHS.LocationInformation(geohash), undefined, signal)
			const localInfo = LocationInformationResponse.parse(response?.data)
			this.locationInformation = localInfo.data
		} catch (e: any) {
			this.log('warn', `Location Infomation request failed: ${typeof e == 'object' ? JSON.stringify(e) : String(e)}`)
		}
	}

	public async getObservation(geohash: string = this.location.geohash, signal?: AbortSignal): Promise<void> {
		try {
			const response = await this.queryApi(API_PATHS.Observations(geohash), undefined, signal)
			const observation = ObservationResponse.parse(response?.data)
			this.recentUpdate = observation.metadata.response_timestamp
			this.observation = observation.data
		} catch (e: any) {
			this.log('warn', `Observation request failed: ${typeof e == 'object' ? JSON.stringify(e) : String(e)}`)
		}
	}

	private locationSearchParams(config: ModuleConfig): string {
		if (config.searchBy == searchBy.Name) return config.location.trim()
		return config.latitude.toString() + ',' + config.longitude.toString()
	}

	public async searchLocations(config: ModuleConfig = this.config): Promise<void> {
		const response = await this.queryApi(API_PATHS.LocationSearch(), this.locationSearchParams(config))
		if (response) {
			try {
				const results = SearchResponse.parse(response.data)
				this.locations.clear()
				results.data.forEach((location) => {
					this.locations.set(location.geohash, location)
					this.location = location
				})
			} catch (e: any) {
				this.log('warn', `Unexpected response to Location Search ${JSON.stringify(e)}`)
				return
			}
		}
	}

	/**
	 * Fetch everything for a location, publish it, and schedule the next poll
	 * @param signal From the action that asked for this. Once it aborts no further requests are issued, but what has
	 * already come back is still published and polling carries on
	 */
	public async updateData(geohash: string = this.location.geohash, signal?: AbortSignal): Promise<void> {
		const requests = [
			async () => this.getForecastDaily(geohash, signal),
			async () => this.getForecastHourly(geohash, signal),
			async () => this.getObservation(geohash, signal),
			async () => this.getWarnings(geohash, signal),
			async () => this.getLocationInfo(geohash, signal),
		]
		for (const request of requests) {
			if (signal?.aborted) break
			await request()
		}
		this.updateVariableDefinitions() // export variable definitions
		this.updateVariableValues()
		if (this.pollTimer) clearInterval(this.pollTimer)
		this.pollTimer = setTimeout(() => {
			this.updateData(geohash).catch(() => {})
		}, this.config.pollInterval * 60000)
	}

	/**
	 * Make a query of the BOM API
	 * @param path API path to query
	 * @param searchParams To include in query, only required for location search
	 * @param signal Drops the request from the queue, or cancels it in flight, once aborted
	 * @returns Axios response or Void if error
	 */
	private async queryApi(
		path: string,
		searchParams?: string,
		signal?: AbortSignal,
	): Promise<AxiosResponse<any, any> | void> {
		return await this.queue.add(
			async () => {
				return await this.axios
					.get(path, searchParams ? { params: { search: searchParams }, signal } : { signal })
					.then((response) => {
						this.statusManager.updateStatus(InstanceStatus.Ok)
						if (this.config.verbose) {
							this.log('debug', `Response from API call to ${path}:\n${JSON.stringify(response.data)}`)
						}
						return response
					})
					.catch((error) => {
						// Cancelled by the caller, so says nothing about whether the API is reachable
						if (axios.isCancel(error)) return
						this.log('error', error.cause)
						this.statusManager.updateStatus(InstanceStatus.ConnectionFailure, error.code)
						if (this.config.verbose) this.log('error', JSON.stringify(error))
						return
					})
			},
			{ signal },
		)
	}

	updateVariableValues(): void {
		UpdateVariableValues(this)
	}

	// Return config fields for web config
	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}
}
