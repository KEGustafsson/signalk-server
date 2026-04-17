---
title: Source Priority
---

# Source Priority

When multiple data sources provide the same Signal K path (e.g. two GPS devices both providing `navigation.position`), Signal K Server needs to decide which source to use. The Source Priority system lets you control this on a per-path basis.

These features are available in the Admin UI under _Data -> Source Priority_.

## Understanding Multi-Source Paths

A **multi-source path** is any Signal K path that receives data from two or more sources. This is common on boats with:

- Multiple GPS receivers (e.g. a chartplotter GPS and a standalone GPS antenna)
- NMEA 0183 and NMEA 2000 devices providing the same data (e.g. depth from both buses)
- Plugins that derive or calculate values also provided by hardware (e.g. true wind)

Multi-source paths are not errors — they are a normal part of a multi-device installation. The Source Priority system helps you choose which source should be preferred for each path.

### Sidebar Badge

The sidebar shows a yellow warning badge on the _Data_ menu item when there are multi-source paths that have no priority configuration. The number indicates how many such paths exist. As you configure priorities, this count decreases. The badge updates in real time as sources come and go.

## How It Works

For each path, you list the sources that may provide it, in order of preference. The top row is the **preferred** source — while it is publishing data, its values always win. Every other row has a **Fallback after** value: the number of milliseconds the **currently-winning** source must be silent before this row is allowed to take over.

![Fallback timeline with three sources showing the cascade behaviour](../img/source-priority-timeline.svg)

The important subtlety: each row's timer is measured against whichever source is **currently winning**, not against row 1.

- When the preferred source goes silent, the second row's Fallback clock starts.
- If and when the second row takes over, it becomes the winner. From that moment, the **third** row's Fallback clock starts ticking against the **second row**, not against row 1.
- So if Backup 1 keeps actively sending after taking over, Backup 2 never wins — the chain cascades one step at a time.

The preferred source has no Fallback value because nothing ranks higher. When it returns after any silence, it immediately resumes winning — the backups do not "hold" their position.

### A Worked Example

Three GPS sources on the boat all publish `navigation.position`. In the Admin UI they appear with human-readable labels; the underlying `$source` values are CAN Names:

| Row | Shown as                         | `$source` (CAN Name)    | Fallback after |
| --- | -------------------------------- | ----------------------- | -------------- |
| 1   | Furuno (`can0.c0788c00e7e04312`) | `can0.c0788c00e7e04312` | _preferred_    |
| 2   | Garmin (`can0.c0328400e7e00a86`) | `can0.c0328400e7e00a86` | `5000` (5 s)   |
| 3   | serial0.GP                       | `serial0.GP`            | `30000` (30 s) |

Scenarios:

- **Furuno is healthy:** only Furuno values reach subscribers. Garmin and serial0.GP are ignored even though they publish continuously.
- **Furuno unplugged, Garmin healthy:** after 5 s of Furuno silence, Garmin takes over and keeps winning as long as it keeps publishing. serial0.GP is still ignored — its 30 s clock is measured against Garmin, but Garmin is never silent.
- **Furuno unplugged AND Garmin unplugged:** after 5 s of Furuno silence, Garmin takes over. 30 s later (measured from Garmin's last value), serial0.GP takes over.
- **Furuno returns:** it immediately wins again, regardless of which backup was winning.

### Disabling a Source on a Path

Uncheck **Enabled** on a row (internally, _Fallback after_ = `-1`) to block that source on this path entirely, no matter how silent the others become.

### Sources Not Listed

Data from a source that is not listed in the priority table for a path is allowed to take over only after **every listed source has been silent for a default of 10 seconds**. This is a safety fallback so an unconfigured new device on the bus doesn't suddenly hijack a path you have not thought about.

### What is Not Filtered

`notifications.*` paths bypass source priority entirely — every source's notifications are delivered unchanged. Notifications are events, not measurements, so suppressing one source's alarm because another source is "preferred" is never the right behaviour.

All source data is preserved in the server's data model regardless of priority configuration. Priority only affects which source's values are delivered to subscribers by default. See [Source Priority in the Data Browser](#source-priority-in-the-data-browser) for how to view every source's data.

## Source Priority in the Data Browser

The Data Browser (_Data -> Browser_) has a **Sources** dropdown that controls which source's data is displayed:

- **Priority filtered** (default): shows only the preferred source's data for each path, respecting your priority configuration.
- **All sources**: shows data from every source. The preferred source for each path is marked with a green checkmark (**&#10003;**) so you can see which one would win under filtering.

Use **All sources** to:

- Verify that priority configuration is working correctly
- Compare values from different sources
- Debug sensor issues by seeing all incoming data

The **View** dropdown lets you switch between a flat path listing (**Paths**) and a source-grouped view (**By Source**) that shows the same full table grouped under source headers.

## Source Identification

Signal K Server identifies sources differently depending on the connection type:

### NMEA 2000 Sources

N2K sources are identified by their **CAN Name** — a globally unique 64-bit identifier derived from the ISO Address Claim (PGN 60928). Each device on the bus has a unique NAME even if the manufacturer and model are identical (the NAME includes a per-device unique number). This is more reliable than the source address (which can change when devices are added or removed from the bus).

The `$source` field contains the hex-encoded CAN Name, e.g. `can0.c0788c00e7e04312`, not the source address. If the Address Claim has not been received yet, the server falls back to the address, e.g. `can0.22`.

The Admin UI shows a human-readable label derived from the manufacturer and model (PGN 60928 + 126996), e.g. _Furuno (can0.c0788c00e7e04312)_. You can set a custom alias via the pencil icon next to any source label. Two identical devices (same manufacturer and model) have different CAN Names, so aliases help distinguish them — e.g. "Bow GPS" and "Stern GPS".

See [NMEA 2000 Device Management](./n2k-device-management.md) for details.

### NMEA 0183 Sources

NMEA 0183 sources are identified by the connection name and talker ID, e.g. `serial0.GP`.

### Plugin Sources

Plugin sources use the plugin ID as their `$source`, e.g. `derived-data` or `signalk-venus-plugin`.

## REST API

The configuration is read and written via `GET` / `PUT /skServer/sourcePriorities` (admin write). For the request and response shapes, see the route handlers in [`src/serverroutes.ts`](https://github.com/SignalK/signalk-server/blob/master/src/serverroutes.ts).

The persisted JSON keeps the field name `timeout` for backwards compatibility; it carries the _Fallback after_ value described above. A `timeout` of `-1` on a source disables it for that path.
