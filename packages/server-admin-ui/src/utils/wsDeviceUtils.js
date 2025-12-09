/**
 * Utility functions for WebSocket device name resolution
 *
 * WS device IDs have the format "ws.{clientId}" where the clientId
 * may have dots replaced with underscores. These IDs are not
 * user-friendly, so we provide utilities to resolve them to
 * human-readable device descriptions when available.
 */

/**
 * Converts a WebSocket provider/source ID to the original client ID
 * by removing the "ws." prefix and converting underscores back to dots.
 *
 * The WS source is created in ws.js as: 'ws.' + identifier.replace(/\./g, '_')
 * So we need to reverse this: remove 'ws.' prefix and convert '_' back to '.'
 *
 * @param {string} wsId - The WebSocket ID (e.g., "ws.my_device_id")
 * @returns {string|null} The client ID (e.g., "my.device.id") or null if not a WS ID
 */
export function extractClientId(wsId) {
  if (!wsId || !wsId.startsWith('ws.')) {
    return null
  }
  // Remove 'ws.' prefix and convert underscores back to dots
  return wsId.slice(3).replace(/_/g, '.')
}

/**
 * Finds a device by its client ID from a list of devices
 *
 * @param {Array} devices - Array of device objects with clientId property
 * @param {string} clientId - The client ID to search for
 * @returns {Object|null} The device object or null if not found
 */
export function findDeviceByClientId(devices, clientId) {
  if (!devices || !Array.isArray(devices) || !clientId) {
    return null
  }
  return devices.find((d) => d.clientId === clientId) || null
}

/**
 * Gets the display name for a WebSocket device ID.
 * Returns the device description if available, otherwise the original ID.
 *
 * @param {string} wsId - The WebSocket ID (e.g., "ws.client_id_123")
 * @param {Array} devices - Array of device objects with clientId and description
 * @returns {string} The display name (description or original ID)
 */
export function getWsDeviceDisplayName(wsId, devices) {
  if (!wsId || !wsId.startsWith('ws.')) {
    return wsId
  }

  const clientId = extractClientId(wsId)
  const device = findDeviceByClientId(devices, clientId)

  // Return description if it exists and is not empty
  if (device && device.description && device.description.trim() !== '') {
    return device.description
  }

  return wsId
}

/**
 * Gets the display name for any source ID, handling both WS and non-WS sources.
 * For WS sources, attempts to resolve to device description.
 * For non-WS sources, returns the ID as-is.
 *
 * @param {string} sourceId - The source ID (e.g., "ws.client_123" or "nmea0183-1")
 * @param {Array} devices - Array of device objects (can be null/undefined)
 * @returns {string} The display name
 */
export function getSourceDisplayName(sourceId, devices) {
  if (!sourceId) {
    return sourceId
  }

  if (sourceId.startsWith('ws.')) {
    return getWsDeviceDisplayName(sourceId, devices)
  }

  return sourceId
}

/**
 * Checks if a source/provider ID is a WebSocket device
 *
 * @param {string} id - The source or provider ID
 * @returns {boolean} True if it's a WebSocket device ID
 */
export function isWsDevice(id) {
  return id && typeof id === 'string' && id.startsWith('ws.')
}
