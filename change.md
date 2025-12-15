# Device Label Names Feature

## Overview
Adds human-readable device names (descriptions) to WebSocket device sources in the UI.

## Changes

### Server-side

**`src/security.ts`**
- Added `showDeviceLabelNames?: boolean` to SecurityConfig interface

**`src/deltastats.ts`**
- Strip device descriptions from SERVERSTATISTICS `devices` array when toggle is OFF
- Include `showDeviceLabelNames` in SERVERSTATISTICS event

### UI Components

**`packages/server-admin-ui/src/views/security/Settings.js`**
- Added "Show Device Names in UI" toggle (default: ON)

**`packages/server-admin-ui/src/views/Dashboard/Dashboard.js`**
- Display device descriptions instead of IDs for WS sources

**`packages/server-admin-ui/src/views/DataBrowser/DataBrowser.js`**
- Added `getSourceDisplayName()` to resolve WS source IDs to device names
- Connected to `serverStatistics` for device lookup

**`packages/server-admin-ui/src/views/ServerConfig/SourcePriorities.js`**
- Added `getSourceDisplayLabel()` to show device names in dropdown
- Connected to `serverStatistics` for device lookup

## Behavior

| Location | Toggle ON | Toggle OFF |
|----------|-----------|------------|
| Dashboard | Device name | Device ID |
| Data Browser | Device name | Device ID |
| Source Priorities | Device name | Device ID |

## Notes

- Device names are resolved via the `devices` array in SERVERSTATISTICS events
- The `devices` array contains device descriptions from `securityStrategy.getDevices()`
- When toggle is OFF, descriptions are stripped from the array so UI shows IDs
- WS source matching uses prefix matching (`ws.<clientId>.`) to handle sources with suffixes

## Future Work

- Add `labelName` to delta `source` object for WS devices
- Add `labelName` to `/signalk/v1/api/sources/ws.*` REST API responses
