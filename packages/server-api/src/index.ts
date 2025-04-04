import { IRouter } from 'express'
import { PropertyValuesCallback } from './propertyvalues'

export interface Position {
  latitude: number
  longitude: number
  altitude?: number
}

export interface ActionResult {
  state: 'COMPLETED' | 'PENDING' | 'FAILED'
  statusCode: number
  message?: string
  resultStatus?: number
}

export enum SKVersion {
  v1 = 'v1',
  v2 = 'v2'
}

export type Brand<K, T> = K & { __brand: T }

export * from './deltas'
export * from './coursetypes'
export * from './resourcetypes'
export * from './resourcesapi'
export { ResourceProviderRegistry } from './resourcesapi'
import { ResourceProviderRegistry } from './resourcesapi'
export * from './autopilotapi'
import { AutopilotProviderRegistry } from './autopilotapi'
export { AutopilotProviderRegistry } from './autopilotapi'
export * from './autopilotapi.guard'
import { PointDestination, RouteDestination, CourseInfo } from './coursetypes'

export type SignalKApiId =
  | 'resources'
  | 'course'
  | 'history'
  | 'autopilot'
  | 'anchor'
  | 'logbook'
  | 'historyplayback' //https://signalk.org/specification/1.7.0/doc/streaming_api.html#history-playback
  | 'historysnapshot' //https://signalk.org/specification/1.7.0/doc/rest_api.html#history-snapshot-retrieval

export {
  PropertyValue,
  PropertyValues,
  PropertyValuesCallback
} from './propertyvalues'

type Unsubscribe = () => void
export interface PropertyValuesEmitter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emitPropertyValue: (name: string, value: any) => void
  onPropertyValues: (name: string, cb: PropertyValuesCallback) => Unsubscribe
}

/**
 * A plugin constructor is the interface that all plugins must export.
 * It is called by the server when the server is starting up.
 */
export type PluginConstructor = (app: ServerAPI) => Plugin

/**
 * This is the API that the server exposes in the app object that
 * is passed in Plugin "constructor" call.
 *
 * INCOMPLETE, work in progress.
 */

export interface PluginServerApp
  extends PropertyValuesEmitter,
    ResourceProviderRegistry,
    AutopilotProviderRegistry {}

/**
 * This is the API that a [server plugin](https://github.com/SignalK/signalk-server/blob/master/SERVERPLUGINS.md) must implement.
 *
 * Typing is INCOMPLETE.
 */
export interface Plugin {
  /**
   * Used to identify the plugin in the server, for example
   * when storing the plugin's configuration and in http endpoints.
   */
  id: string

  /**
   * Human oriented name for the plugin. This is used in the
   * server's plugin configuration user interface.
   */
  name: string

  /**
   * Called to start the plugin with latest saved configuration. Called
   * - for enabled (by configuration or by default) plugins during server startup
   * - after stop() when the configuration of an enabled plugin has been updated
   * in the admin UI
   * - when a plugin is Enabled in the admin UI
   */
  start: (config: object, restart: (newConfiguration: object) => void) => void

  /**
   * Called to stop the plugin. Called when the user disables the plugin in the admin UI.
   */
  stop: () => void
  schema: object | (() => object)
  uiSchema?: object | (() => object)
  registerWithRouter?: (router: IRouter) => void
  signalKApiRoutes?: (router: IRouter) => IRouter
  enabledByDefault?: boolean
  getOpenApi?: () => object
  description?: string
  statusMessage?: () => string | void
}

export type DeltaInputHandler = (
  delta: object,
  next: (delta: object) => void
) => void

export interface Ports {
  byId: string[]
  byPath: string[]
  byOpenPlotter: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serialports: any
}

export interface Metadata {
  units?: string
  description?: string
}

export interface FeatureInfo {
  apis: SignalKApiId[]
  plugins: Array<{
    id: string
    name: string
    version: string
    enabled: boolean
  }>
}

export interface ServerAPI extends PluginServerApp {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSelfPath: (path: string) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPath: (path: string) => any
  getMetadata: (path: string) => Metadata | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  putSelfPath: (aPath: string, value: any, updateCb: () => void) => Promise<any>
  putPath: (
    aPath: string,
    value: number | string | object | boolean,
    updateCb: (err?: Error) => void,
    source: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any>
  //TSTODO convert queryRequest to ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryRequest: (requestId: string) => Promise<any>
  error: (msg: string) => void
  debug: (msg: string) => void
  registerDeltaInputHandler: (handler: DeltaInputHandler) => void
  setPluginStatus: (msg: string) => void
  setPluginError: (msg: string) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleMessage: (id: string, msg: any, skVersion?: SKVersion) => void
  savePluginOptions: (
    configuration: object,
    cb: (err: NodeJS.ErrnoException | null) => void
  ) => void
  readPluginOptions: () => object
  getDataDirPath: () => string
  registerPutHandler: (
    context: string,
    path: string,
    callback: () => void,
    source: string
  ) => void
  registerActionHandler: (
    context: string,
    path: string,
    callback: () => void,
    source: string
  ) => void
  registerHistoryProvider: (provider: {
    hasAnydata: (options: object, cb: (hasResults: boolean) => void) => void
    getHistory: (
      date: Date,
      path: string,
      cb: (deltas: object[]) => void
    ) => void
    streamHistory: (
      // TSTODO propert type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      spark: any,
      options: object,
      onDelta: (delta: object) => void
    ) => void
  }) => void
  getSerialPorts: () => Promise<Ports>

  getFeatures: () => FeatureInfo

  getCourse: () => Promise<CourseInfo>
  clearDestination: () => Promise<void>
  setDestination: (
    dest: (PointDestination & { arrivalCircle?: number }) | null
  ) => Promise<void>
  activateRoute: (dest: RouteDestination | null) => Promise<void>

  /**
   * A plugin can report that it has handled output messages. This will
   * update the output message rate and icon in the Dashboard.
   *
   * This is for traffic that the plugin is sending outside the server,
   * for example network packets, http calls or messages sent to
   * a broker. This should NOT be used for deltas that the plugin
   * sends with handleMessage, they are reported as input from the
   * server's perspective.
   *
   * @param count optional count of handled messages between the last
   * call and this one. If omitted the call will count as one output
   * message.
   */

  reportOutputMessages: (count?: number) => void
}
