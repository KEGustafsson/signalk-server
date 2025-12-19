/**
 * CONCEPT PLUGIN: AIS Hybrid Approach
 *
 * Demonstrates the hybrid approach:
 * - WebSocket subscription to get notified of vessel updates
 * - app.getPath() to fetch full vessel data when needed
 *
 * This is more efficient than polling because:
 * - Only processes when data actually changes
 * - Gets full vessel snapshot on-demand
 * - No REST API required
 */

module.exports = function (app) {
  const plugin = {
    id: 'ais-hybrid-collector',
    name: 'AIS Hybrid Collector',
    description: 'Efficient vessel data collection using subscriptions + getPath'
  }

  let unsubscribes = []
  const vesselLastProcessed = new Map()  // Track when each vessel was last processed
  const DEBOUNCE_MS = 1000  // Don't process same vessel more than once per second

  const SELF_CONTEXT = app.selfContext

  /**
   * Extract value from SignalK path object
   */
  function getValue(pathObj) {
    if (pathObj === undefined || pathObj === null) return null
    if (typeof pathObj === 'object' && 'value' in pathObj) {
      return pathObj.value
    }
    return pathObj
  }

  /**
   * Get full vessel data and extract AIS fields
   */
  function getVesselAISData(context) {
    // Use app.getPath to get full vessel data - no REST needed!
    const vessel = app.getPath(context)

    if (!vessel) {
      app.debug(`No data found for ${context}`)
      return null
    }

    const vesselId = context.replace('vessels.', '')
    const nav = vessel.navigation || {}
    const design = vessel.design || {}
    const comms = vessel.communication || {}

    // Extract MMSI from context if not in data
    let mmsi = getValue(vessel.mmsi)
    if (!mmsi) {
      const match = vesselId.match(/mmsi:(\d+)/)
      mmsi = match ? match[1] : null
    }

    return {
      context: context,
      vesselId: vesselId,
      mmsi: mmsi,
      name: getValue(vessel.name),
      callsign: getValue(comms.callsignVhf),

      // Position & movement
      position: getValue(nav.position),
      sog: getValue(nav.speedOverGround),
      cog: getValue(nav.courseOverGroundTrue),
      heading: getValue(nav.headingTrue),
      rot: getValue(nav.rateOfTurn),

      // Dimensions
      length: getValue(design.length?.overall),
      beam: getValue(design.beam),
      draft: getValue(design.draft?.current) || getValue(design.draft?.maximum),
      shipType: getValue(design.aisShipType),

      // Destination
      destination: getValue(nav.destination?.commonName),
      eta: getValue(nav.destination?.eta),
      navStatus: getValue(nav.state),

      // Metadata
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Process a vessel update (debounced)
   */
  function processVesselUpdate(context, triggerPath) {
    // Skip self
    if (context === SELF_CONTEXT) {
      return
    }

    // Debounce: don't process same vessel too frequently
    const now = Date.now()
    const lastProcessed = vesselLastProcessed.get(context) || 0
    if (now - lastProcessed < DEBOUNCE_MS) {
      return
    }
    vesselLastProcessed.set(context, now)

    // Get full vessel data
    const aisData = getVesselAISData(context)

    if (!aisData || !aisData.position) {
      app.debug(`Vessel ${context} has no position data`)
      return
    }

    app.debug(`Processing ${aisData.mmsi} (${aisData.name || 'Unknown'}) - triggered by ${triggerPath}`)

    // Convert units for AIS message generation
    const sogKnots = aisData.sog ? aisData.sog * 1.94384 : null
    const cogDeg = aisData.cog ? aisData.cog * (180 / Math.PI) : null
    const hdgDeg = aisData.heading ? aisData.heading * (180 / Math.PI) : null

    app.debug(`  Pos: ${aisData.position.latitude?.toFixed(4)}, ${aisData.position.longitude?.toFixed(4)}`)
    app.debug(`  SOG: ${sogKnots?.toFixed(1)} kn, COG: ${cogDeg?.toFixed(1)}°, HDG: ${hdgDeg?.toFixed(1)}°`)

    // HERE: Generate your AIS NMEA message
    // generateAISMessage(aisData)

    app.reportOutputMessages(1)
  }

  /**
   * Handle incoming delta from subscription
   */
  function handleDelta(delta) {
    if (!delta.context) return

    // Find what paths changed
    const changedPaths = []
    if (delta.updates) {
      for (const update of delta.updates) {
        if (update.values) {
          for (const v of update.values) {
            changedPaths.push(v.path)
          }
        }
      }
    }

    // Process the vessel
    const triggerPath = changedPaths.join(', ')
    processVesselUpdate(delta.context, triggerPath)
  }

  /**
   * Get current vessel count for status
   */
  function getVesselCount() {
    const vessels = app.getPath('vessels')
    if (!vessels) return 0

    let count = 0
    for (const id of Object.keys(vessels)) {
      const ctx = `vessels.${id}`
      if (ctx !== SELF_CONTEXT) {
        const vessel = vessels[id]
        if (vessel.navigation?.position) {
          count++
        }
      }
    }
    return count
  }

  /**
   * Plugin start
   */
  plugin.start = function (options) {
    app.debug('Starting AIS Hybrid Collector')

    // Subscribe to position updates for all vessels
    // This triggers processing when any vessel's position changes
    const subscribeMessage = {
      context: 'vessels.*',
      subscribe: [
        { path: 'navigation.position', policy: 'instant' },
        { path: 'navigation.speedOverGround', policy: 'instant' },
        { path: 'navigation.courseOverGroundTrue', policy: 'instant' },
        { path: 'navigation.headingTrue', policy: 'instant' }
      ]
    }

    app.subscriptionmanager.subscribe(
      subscribeMessage,
      unsubscribes,
      (err) => {
        app.error(`Subscription error: ${err}`)
        app.setPluginError(`Subscription failed: ${err}`)
      },
      handleDelta
    )

    // Update status periodically
    const statusInterval = setInterval(() => {
      const count = getVesselCount()
      app.setPluginStatus(`Tracking ${count} vessels`)
    }, 5000)

    unsubscribes.push(() => clearInterval(statusInterval))

    app.setPluginStatus('Subscribed to vessel updates')
    app.debug('Subscribed to vessels.* navigation paths')
  }

  /**
   * Plugin stop
   */
  plugin.stop = function () {
    unsubscribes.forEach((unsub) => {
      if (typeof unsub === 'function') {
        unsub()
      }
    })
    unsubscribes = []
    vesselLastProcessed.clear()
    app.debug('Stopped AIS Hybrid Collector')
  }

  /**
   * Plugin schema
   */
  plugin.schema = {
    type: 'object',
    properties: {
      debounceMs: {
        type: 'number',
        title: 'Debounce (ms)',
        description: 'Minimum time between processing same vessel',
        default: 1000
      }
    }
  }

  return plugin
}
