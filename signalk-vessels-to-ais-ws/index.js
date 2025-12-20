/* eslint-disable no-bitwise */
/*
MIT License

Copyright (c) 2020 Karl-Erik Gustafsson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/**
 * Modified version using app.getPath() instead of REST API
 * - No HTTP/HTTPS configuration needed
 * - No node-fetch dependency
 * - Direct access to SignalK data model
 */

const AisEncode = require('ggencoder').AisEncode
const haversine = require('haversine-distance')

module.exports = function createPlugin(app) {
  const plugin = {}
  plugin.id = 'signalk-vessels-to-ais-ws'
  plugin.name = 'Other vessels data to AIS NMEA0183 (WebSocket)'
  plugin.description =
    'SignalK server plugin to convert other vessel data to NMEA0183 AIS format using direct data access (no REST API)'

  let intervalId = null
  let positionUpdate = 60
  let distance = 100
  let sendOwn = true
  let useTag = false
  let eventName = 'nmea0183out'

  const setStatus = app.setPluginStatus || app.setProviderStatus

  // State Mapping
  const stateMapping = {
    motoring: 0,
    UnderWayUsingEngine: 0,
    'under way using engine': 0,
    'underway using engine': 0,
    anchored: 1,
    AtAnchor: 1,
    'at anchor': 1,
    'not under command': 2,
    'restricted manouverability': 3,
    'constrained by draft': 4,
    'constrained by her draught': 4,
    moored: 5,
    Moored: 5,
    aground: 6,
    fishing: 7,
    'engaged in fishing': 7,
    sailing: 8,
    UnderWaySailing: 8,
    'under way sailing': 8,
    'underway sailing': 8,
    'hazardous material high speed': 9,
    'hazardous material wing in ground': 10,
    'reserved for future use': 13,
    'ais-sart': 14,
    default: 15,
    UnDefined: 15,
    undefined: 15
  }

  /**
   * Extract value from SignalK data structure
   * Handles both { value: X } objects and direct values
   */
  function getValue(obj, path) {
    if (obj === undefined || obj === null) return null

    const parts = path.split('.')
    let current = obj

    for (const part of parts) {
      if (current === undefined || current === null) return null
      current = current[part]
    }

    if (current === undefined || current === null) return null

    // Handle SignalK value wrapper
    if (typeof current === 'object' && 'value' in current) {
      return current.value
    }

    return current
  }

  /**
   * Get timestamp from SignalK data
   */
  function getTimestamp(obj, path) {
    if (obj === undefined || obj === null) return null

    const parts = path.split('.')
    let current = obj

    for (const part of parts) {
      if (current === undefined || current === null) return null
      current = current[part]
    }

    if (current === undefined || current === null) return null

    if (typeof current === 'object' && 'timestamp' in current) {
      return current.timestamp
    }

    return null
  }

  // Rad to Deg
  function radToDegrees(radians) {
    if (radians === null || radians === undefined) return null
    return (radians * 180) / Math.PI
  }

  // m/s to knots
  function msToKnots(speed) {
    if (speed === null || speed === undefined) return null
    return (speed * 3.6) / 1.852
  }

  // NMEA checksum hex conversion
  const mHex = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F']

  function toHexString(v) {
    const msn = (v >> 4) & 0x0f
    const lsn = (v >> 0) & 0x0f
    return mHex[msn] + mHex[lsn]
  }

  function createTagBlock() {
    let tagBlock = ''
    tagBlock += 's:SK0001,'
    tagBlock += `c:${Date.now()},`
    tagBlock = tagBlock.slice(0, -1)
    let tagBlockChecksum = 0
    for (let i = 0; i < tagBlock.length; i++) {
      tagBlockChecksum ^= tagBlock.charCodeAt(i)
    }
    return `\\${tagBlock}*${toHexString(tagBlockChecksum)}\\`
  }

  // NMEA output
  function aisOut(encMsg) {
    const enc = new AisEncode(encMsg)
    const sentence = enc.nmea
    let tagString = ''
    if (useTag) {
      tagString = createTagBlock()
    }
    if (sentence && sentence.length > 0) {
      app.debug(tagString + sentence)
      app.emit(eventName, tagString + sentence)
    }
  }

  /**
   * Main data processing function
   * Uses app.getPath() instead of REST API
   */
  function processVessels() {
    // Get own position for distance calculation
    const ownPosition = app.getSelfPath('navigation.position.value')
    if (!ownPosition || ownPosition.latitude === undefined || ownPosition.longitude === undefined) {
      app.debug('Own position not available, skipping')
      return
    }

    const ownLat = ownPosition.latitude
    const ownLon = ownPosition.longitude

    // Get all vessels using direct data access - NO REST API!
    const vessels = app.getPath('vessels')
    if (!vessels) {
      app.debug('No vessels data available')
      return
    }

    const vesselIds = Object.keys(vessels)
    let processedCount = 0
    let isFirst = true

    for (const vesselId of vesselIds) {
      const vessel = vessels[vesselId]

      // Determine if this is own vessel
      const isOwn = isFirst
      isFirst = false

      // Skip own vessel if not configured to send
      if (isOwn && !sendOwn) {
        continue
      }

      // Extract AIS timestamp for freshness check
      let aisTime = getValue(vessel, 'sensors.ais.class.timestamp')
      if (!aisTime) {
        aisTime = getTimestamp(vessel, 'navigation.position')
      }

      // Check data freshness
      let aisDelay = false
      if (aisTime) {
        const ageSeconds = (Date.now() - new Date(aisTime).getTime()) / 1000
        aisDelay = ageSeconds < positionUpdate
      }

      // Extract vessel data
      const mmsi = getValue(vessel, 'mmsi')
      let shipName = getValue(vessel, 'name')
      if (typeof shipName === 'number') shipName = ''

      const lat = getValue(vessel, 'navigation.position.latitude')
      const lon = getValue(vessel, 'navigation.position.longitude')

      // Skip if no position
      if (lat === null || lon === null) {
        continue
      }

      const sog = msToKnots(getValue(vessel, 'navigation.speedOverGround'))
      const cog = radToDegrees(getValue(vessel, 'navigation.courseOverGroundTrue'))
      const rot = radToDegrees(getValue(vessel, 'navigation.rateOfTurn'))
      const hdg = radToDegrees(getValue(vessel, 'navigation.headingTrue'))

      const navStateValue = getValue(vessel, 'navigation.state')
      const navStat = stateMapping[navStateValue] !== undefined ? stateMapping[navStateValue] : ''

      let dst = getValue(vessel, 'navigation.destination.commonName')
      if (typeof dst === 'number') dst = ''

      let callSign = getValue(vessel, 'communication.callsignVhf')
      if (typeof callSign === 'number') callSign = ''

      let imo = getValue(vessel, 'registrations.imo')
      if (imo && typeof imo === 'string' && imo.startsWith('IMO ')) {
        imo = imo.substring(4)
      }

      const id = getValue(vessel, 'design.aisShipType.id')
      let type = getValue(vessel, 'design.aisShipType.name')
      if (typeof type === 'number') type = ''

      let draftCur = getValue(vessel, 'design.draft.current')
      if (draftCur !== null) draftCur = draftCur / 10

      const length = getValue(vessel, 'design.length.overall')
      let beam = getValue(vessel, 'design.beam')
      if (beam !== null) beam = beam / 2

      const aisClass = getValue(vessel, 'sensors.ais.class')

      // Calculate distance from own vessel
      const a = { lat: ownLat, lon: ownLon }
      const b = { lat, lon }
      const dist = (haversine(a, b) / 1000).toFixed(2)

      // Check if within distance range
      if (parseFloat(dist) > distance) {
        continue
      }

      // Prepare AIS messages
      const encMsg3 = {
        own: isOwn,
        aistype: 3, // class A position report
        repeat: 0,
        mmsi,
        navstatus: navStat,
        sog,
        lon,
        lat,
        cog,
        hdg,
        rot
      }

      const encMsg5 = {
        own: isOwn,
        aistype: 5, // class A static
        repeat: 0,
        mmsi,
        imo,
        cargo: id,
        callsign: callSign,
        shipname: shipName,
        draught: draftCur,
        destination: dst,
        dimA: 0,
        dimB: length,
        dimC: beam,
        dimD: beam
      }

      const encMsg18 = {
        own: isOwn,
        aistype: 18, // class B position report
        repeat: 0,
        mmsi,
        sog,
        accuracy: 0,
        lon,
        lat,
        cog,
        hdg
      }

      const encMsg240 = {
        own: isOwn,
        aistype: 24, // class B static part A
        repeat: 0,
        part: 0,
        mmsi,
        shipname: shipName
      }

      const encMsg241 = {
        own: isOwn,
        aistype: 24, // class B static part B
        repeat: 0,
        part: 1,
        mmsi,
        cargo: id,
        callsign: callSign,
        dimA: 0,
        dimB: length,
        dimC: beam,
        dimD: beam
      }

      // Send AIS messages based on class
      if (aisDelay && (aisClass === 'A' || aisClass === 'B' || aisClass === 'BASE')) {
        app.debug(
          `Distance range: ${distance}km, AIS target distance: ${dist}km, Class ${aisClass} Vessel, MMSI:${mmsi}`
        )

        if (aisClass === 'A') {
          app.debug(`Class A, MMSI: ${mmsi}, Name: ${shipName || 'Unknown'}`)
          aisOut(encMsg3)
          aisOut(encMsg5)
          processedCount++
        }

        if (aisClass === 'B') {
          app.debug(`Class B, MMSI: ${mmsi}, Name: ${shipName || 'Unknown'}`)
          aisOut(encMsg18)
          aisOut(encMsg240)
          aisOut(encMsg241)
          processedCount++
        }

        if (aisClass === 'BASE') {
          app.debug(`Base Station, MMSI: ${mmsi}`)
          aisOut(encMsg3)
          processedCount++
        }

        app.debug('--------------------------------------------------------')
      }
    }

    const dateObj = new Date(Date.now())
    const date = dateObj.toISOString()
    setStatus(`${processedCount} AIS targets sent: ${date}`)

    if (processedCount > 0) {
      app.reportOutputMessages(processedCount)
    }
  }

  plugin.start = function (options) {
    positionUpdate = (options.position_update || 1) * 60
    distance = options.distance || 100
    sendOwn = options.sendOwn !== false
    useTag = options.useTag || false
    eventName = options.eventName || 'nmea0183out'

    app.debug('Plugin starting with direct data access (no REST API)')
    app.debug(`Update interval: ${positionUpdate}s, Distance: ${distance}km`)

    // Initial run
    processVessels()

    // Set up periodic processing
    intervalId = setInterval(processVessels, positionUpdate * 1000)

    setStatus('Running')
    app.debug('Plugin started')
  }

  plugin.stop = function () {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    app.debug('Plugin stopped')
  }

  plugin.schema = {
    type: 'object',
    properties: {
      position_update: {
        type: 'number',
        default: 1,
        title: 'How often AIS data is sent to NMEA0183 out (in minutes)',
        description: 'E.g. 0.5 = 30s, 1 = 1min'
      },
      sendOwn: {
        type: 'boolean',
        title: 'Send own AIS data (VDO)',
        default: true
      },
      useTag: {
        type: 'boolean',
        title: 'Add Tag-block',
        default: false
      },
      distance: {
        type: 'integer',
        default: 100,
        title: 'AIS target within range [km]'
      },
      eventName: {
        type: 'string',
        default: 'nmea0183out',
        title: 'Output event name'
      }
    }
  }

  return plugin
}
