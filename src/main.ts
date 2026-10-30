import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, searchBy, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions, UpdateVariableValues, type VariablesSchema } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionSchema } from './actions.js'
import { UpdateFeedbacks, type FeedbackSchema } from './feedbacks.js'
import { SearchResponse } from './interfaces.js'
import type {
	ForecastItem,
	HourlyForecastItem,
	Location,
	LocationInformation,
	Oberservation,
	Warning,
} from './interfaces.js'
import {
	API_ENDPOINT,
	API_HEADERS,
	API_PATHS,
	API_TIMEOUT,
	QUERIES,
	describeError,
	type QueryResponse,
	type QueryType,
} from './api.js'
import { StatusManager } from './status.js'
import { AxiosInstance, AxiosResponse } from 'axios'
import PQueue from 'p-queue'
import axios from 'axios'

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

	public async getForecastHourly(geohash: string = this.location.geohash): Promise<void> {
		try {
			const forecasts = await this.pollQuery('forecast_hourly', geohash)
			this.recentUpdate = forecasts.metadata.response_timestamp
			this.forecastHourly = forecasts.data
			this.forecaseHourlyIssuedAt = forecasts.metadata.issue_time
		} catch (e) {
			this.logRequestFailure('Hourly Forecast', e)
		}
	}

	public async getForecastDaily(geohash: string = this.location.geohash): Promise<void> {
		try {
			const forecasts = await this.pollQuery('forecast_daily', geohash)
			this.recentUpdate = forecasts.metadata.response_timestamp
			this.forecastDaily = forecasts.data
			this.forecastDailyIssuedAt = forecasts.metadata.issue_time
		} catch (e) {
			this.logRequestFailure('Daily Forecast', e)
		}
	}

	public async getWarnings(geohash: string = this.location.geohash): Promise<void> {
		try {
			const warnings = await this.pollQuery('warnings', geohash)
			this.recentUpdate = warnings.metadata.response_timestamp
			this.warnings = warnings.data
		} catch (e) {
			this.logRequestFailure('Warnings', e)
		}
	}

	public async getLocationInfo(geohash: string = this.location.geohash): Promise<void> {
		try {
			const localInfo = await this.pollQuery('location_information', geohash)
			this.locationInformation = localInfo.data
		} catch (e) {
			this.logRequestFailure('Location Infomation', e)
		}
	}

	public async getObservation(geohash: string = this.location.geohash): Promise<void> {
		try {
			const observation = await this.pollQuery('observations', geohash)
			this.recentUpdate = observation.metadata.response_timestamp
			this.observation = observation.data
		} catch (e) {
			this.logRequestFailure('Observation', e)
		}
	}

	private logRequestFailure(what: string, e: unknown): void {
		this.log('warn', `${what} request failed: ${describeError(e)}`)
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
	 * Fetch everything for a location, publish it, and schedule the next poll. Takes no abort signal: stopping part way
	 * would publish some data for this location beside the rest for the previous one
	 */
	public async updateData(geohash: string = this.location.geohash): Promise<void> {
		await this.getForecastDaily(geohash)
		await this.getForecastHourly(geohash)
		await this.getObservation(geohash)
		await this.getWarnings(geohash)
		await this.getLocationInfo(geohash)
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
	 * @returns Axios response or Void if error
	 */
	private async queryApi(path: string, searchParams?: string): Promise<AxiosResponse<any, any> | void> {
		return await this.queue.add(async () => {
			return await this.axios
				.get(path, searchParams ? { params: { search: searchParams } } : {})
				.then((response) => {
					this.statusManager.updateStatus(InstanceStatus.Ok)
					if (this.config.verbose) {
						this.log('debug', `Response from API call to ${path}:\n${JSON.stringify(response.data)}`)
					}
					return response
				})
				.catch((error) => {
					this.log('error', error.cause)
					this.statusManager.updateStatus(InstanceStatus.ConnectionFailure, error.code)
					if (this.config.verbose) this.log('error', JSON.stringify(error))
					return
				})
		})
	}

	/** Fetch and parse one kind of data for polling, reporting the outcome on the connection status as queryApi does */
	private async pollQuery<T extends QueryType>(type: T, geohash: string): Promise<QueryResponse<T>> {
		const { path, schema } = QUERIES[type]
		const response = await this.queryApi(path(geohash))
		return schema.parse(response?.data) as QueryResponse<T>
	}

	/**
	 * Fetch and parse one kind of data for a geohash, for the Get Data action. Leaves the module's state and connection
	 * status alone: a geohash typed into an action that the BOM rejects says nothing about whether it can be reached
	 * @param signal Drops the request from the queue, or cancels it in flight, once aborted
	 * @throws With the BOM's explanation if the request fails, or a ZodError if the response is not the expected shape
	 */
	public async query<T extends QueryType>(type: T, geohash: string, signal?: AbortSignal): Promise<QueryResponse<T>> {
		const { label, path, schema } = QUERIES[type]
		const response = await this.queue
			.add(async () => this.axios.get(path(geohash), { signal }), { signal })
			.catch((error: unknown) => {
				throw new Error(`${label} request for ${geohash} failed: ${describeError(error)}`, { cause: error })
			})
		return schema.parse(response.data) as QueryResponse<T>
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
