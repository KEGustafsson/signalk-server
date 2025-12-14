# Device Label Names Feature

## Overview
Adds human-readable device names (descriptions) to WebSocket device sources throughout the system.

## Changes

### Server-side

**`src/tokensecurity.js`**
- Added `labelName` property to device principal (uses device description)

**`src/app.ts`**
- Added `providerDisplayNames` mapping to ServerApp interface

**`src/index.ts`**
- Initialize `providerDisplayNames` mapping
- Add `labelName` to delta `source` object when available

**`src/interfaces/ws.js`**
- Store device `labelName` in `providerDisplayNames` on WS connection
- Clean up mapping on disconnect

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
| Delta `source.labelName` | Always included | Always included |
| `/signalk/v1/api/sources/ws.*` | Shows `labelName` | Shows `labelName` |
| Dashboard | Device name | Device ID |
| Data Browser | Device name | Device ID |
| Source Priorities | Device name | Device ID |

## Test Coverage
- Added test case `'Device delta includes labelName in source'` in `test/security.js`
