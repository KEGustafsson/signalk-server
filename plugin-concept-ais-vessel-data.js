/**
 * CONCEPT PLUGIN: AIS Vessel Data Collector
 *
 * Demonstrates how to use Option B (app.getPath) to:
 * 1. Get all vessels from SignalK data model
 * 2. Extract AIS-relevant data from each vessel
 * 3. Process/forward data without using REST API
 *
 * This is a concept/example - adapt for your specific needs.
 */

module.exports = function (app) {
  const plugin = {
    id: 'ais-vessel-data-collector',
    name: 'AIS Vessel Data Collector',
    description: 'Collects vessel data for AIS message generation'
  }

  let intervalId = null
  const SELF_CONTEXT = app.selfContext // e.g., 'vessels.urn:mrn:imo:mmsi:123456789'

  /**
   * Extract value from SignalK path object
   * SignalK stores values as { value: X, timestamp: Y, $source: Z }
   */
  function getValue(pathObj) {
    if (pathObj === undefined || pathObj === null) return null
    if (typeof pathObj === 'object' && 'value' in pathObj) {
      return pathObj.value
    }
    return pathObj
  }

  /**
   * Extract AIS-relevant data from a vessel object
   */
  function extractAISData(vesselId, vessel) {
    const nav = vessel.navigation || {}
    const design = vessel.design || {}
    const comms = vessel.communication || {}

    return {
      // Vessel identification
      vesselId: vesselId,
      mmsi: getValue(vessel.mmsi) || extractMMSIFromId(vesselId),
      name: getValue(vessel.name),
      callsign: getValue(comms.callsignVhf),
      imo: getValue(vessel.registrations?.imo),

      // Position & movement (Class A/B common)
      position: getValue(nav.position),  // { latitude, longitude }
      sog: getValue(nav.speedOverGround),  // m/s
      cog: getValue(nav.courseOverGroundTrue),  // radians
      heading: getValue(nav.headingTrue),  // radians
      rot: getValue(nav.rateOfTurn),  // rad/s

      // Ship dimensions (for Class A message 5)
      length: getValue(design.length?.overall),
      beam: getValue(design.beam),
      draft: getValue(design.draft?.current) || getValue(design.draft?.maximum),

      // Ship type
      shipType: getValue(design.aisShipType),

      // Destination & ETA (Class A message 5)
      destination: getValue(nav.destination?.commonName),
      eta: getValue(nav.destination?.eta),

      // Navigation status
      navStatus: getValue(nav.state),

      // Timestamps for data freshness
      positionTimestamp: nav.position?.timestamp,
      lastUpdate: vessel.timestamp
    }
  }

  /**
   * Try to extract MMSI from vessel ID
   * e.g., 'urn:mrn:imo:mmsi:123456789' -> '123456789'
   */
  function extractMMSIFromId(vesselId) {
    const match = vesselId.match(/mmsi:(\d+)/)
    return match ? match[1] : null
  }

  /**
   * Check if vessel has minimum required data for AIS
   */
  function hasMinimumAISData(aisData) {
    return aisData.mmsi &&
           aisData.position &&
           aisData.position.latitude !== undefined &&
           aisData.position.longitude !== undefined
  }

  /**
   * Convert radians to degrees (SignalK uses radians)
   */
  function radToDeg(rad) {
    return rad !== null && rad !== undefined ? rad * (180 / Math.PI) : null
  }

  /**
   * Convert m/s to knots (SignalK uses m/s)
   */
  function msToKnots(ms) {
    return ms !== null && ms !== undefined ? ms * 1.94384 : null
  }

  /**
   * Main function: Get all vessels and their AIS data
   */
  function getAllVesselsAISData(options = {}) {
    const includesSelf = options.includeSelf || false
    const onlyWithPosition = options.onlyWithPosition !== false  // default true

    // Option B: Direct data access - no REST API needed!
    const vessels = app.getPath('vessels')

    if (!vessels) {
      app.debug('No vessels data available')
      return { count: 0, vessels: [] }
    }

    const vesselIds = Object.keys(vessels)
    const result = []

    for (const vesselId of vesselIds) {
      // Skip self vessel if not requested
      const fullContext = `vessels.${vesselId}`
      if (!includesSelf && fullContext === SELF_CONTEXT) {
        continue
      }

      const vessel = vessels[vesselId]
      const aisData = extractAISData(vesselId, vessel)

      // Filter based on options
      if (onlyWithPosition && !hasMinimumAISData(aisData)) {
        continue
      }

      // Add converted values for convenience
      aisData.sogKnots = msToKnots(aisData.sog)
      aisData.cogDegrees = radToDeg(aisData.cog)
      aisData.headingDegrees = radToDeg(aisData.heading)
      aisData.rotDegPerMin = aisData.rot !== null ? radToDeg(aisData.rot) * 60 : null

      result.push(aisData)
    }

    return {
      count: result.length,
      totalVessels: vesselIds.length,
      vessels: result
    }
  }

  /**
   * Example: Process vessels and generate output
   * Replace this with your actual AIS message generation logic
   */
  function processVessels() {
    const data = getAllVesselsAISData({
      includeSelf: false,      // Exclude own vessel
      onlyWithPosition: true   // Only vessels with valid position
    })

    app.debug(`Found ${data.count} other vessels (of ${data.totalVessels} total)`)

    // Update plugin status
    app.setPluginStatus(`Tracking ${data.count} vessels`)

    // Process each vessel
    for (const vessel of data.vessels) {
      app.debug(`Vessel ${vessel.mmsi} (${vessel.name || 'Unknown'}):`)
      app.debug(`  Position: ${vessel.position?.latitude?.toFixed(4)}, ${vessel.position?.longitude?.toFixed(4)}`)
      app.debug(`  SOG: ${vessel.sogKnots?.toFixed(1)} kn, COG: ${vessel.cogDegrees?.toFixed(1)}°`)

      // Here you would generate your AIS NMEA sentences
      // Example: generateAISMessage(vessel)
    }

    // Report output (for dashboard statistics)
    if (data.count > 0) {
      app.reportOutputMessages(data.count)
    }

    return data
  }

  /**
   * Plugin start
   */
  plugin.start = function (options) {
    app.debug('Starting AIS Vessel Data Collector')

    const pollInterval = (options.pollInterval || 10) * 1000  // Default 10 seconds

    // Initial run
    processVessels()

    // Set up periodic polling
    intervalId = setInterval(() => {
      processVessels()
    }, pollInterval)

    app.setPluginStatus('Running')
  }

  /**
   * Plugin stop
   */
  plugin.stop = function () {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    app.debug('Stopped AIS Vessel Data Collector')
  }

  /**
   * Plugin configuration schema
   */
  plugin.schema = {
    type: 'object',
    properties: {
      pollInterval: {
        type: 'number',
        title: 'Poll interval (seconds)',
        description: 'How often to check for vessel updates',
        default: 10
      },
      includeSelf: {
        type: 'boolean',
        title: 'Include own vessel',
        description: 'Include own vessel in the output',
        default: false
      }
    }
  }

  // Expose the data getter for external use (e.g., from API endpoint)
  plugin.getAllVesselsAISData = getAllVesselsAISData

  return plugin
}
