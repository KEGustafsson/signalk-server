# Signal K Server Patches

These patches can be applied to the signalk-server master branch.

## Patches Included

### Build Configuration

| Patch | Description |
|-------|-------------|
| `01-eslint-config.patch` | Add `.__mf__temp` to ESLint ignore (for Vite Module Federation) |
| `02-prettierignore.patch` | Add `.__mf__temp` to Prettier ignore |

### Server Features

| Patch | Description |
|-------|-------------|
| `03-serverroutes-vite-logo.patch` | Add routes for Vite-built admin UI logo assets (`/admin/assets/...`) |
| `04-security-showDeviceLabelNames.patch` | Add `showDeviceLabelNames` field to SecurityConfig interface |
| `05-deltastats-enhanced.patch` | Add CPU load average, device list, and showDeviceLabelNames to server statistics |
| `06-deltaPriority-enhanced.patch` | Enhanced source priority handling with `highestPrecedenceSources` optimization |
| `07-tokensecurity-null-checks.patch` | Add null checks for valuePath in ACL checking code |
| `08-ws-null-checks.patch` | Add null checks for valuePath in WebSocket processUpdates |

## Applying Patches

To apply all patches:

```bash
cd /path/to/signalk-server
for patch in patches/*.patch; do
  echo "Applying $patch..."
  git apply "$patch"
done
```

To apply a single patch:

```bash
git apply patches/01-eslint-config.patch
```

To test if patches apply cleanly (dry run):

```bash
git apply --check patches/*.patch
```

## Already Merged to Master

The following features from the original patch set are already in master:

- Trust proxy configuration (`trustProxy` setting)
- `getRateLimitValidationOptions()` function
- Using `req.ip` instead of `x-forwarded-for` header
- Rate limit validation options
- Reverse proxy documentation in `docs/security.md`
- Rate limit tests with trustProxy in `test/rate-limit.js`
- nginx syntax highlighting in typedoc.json

## Admin UI Patches (Separate Package)

The following patches are for `@signalk/server-admin-ui` which is a separate npm package
and should be applied to that repository:

- Webpack to Vite migration
- Module Federation compatibility
- Dashboard enhancements (CPU load, device labels)
- Device display labels in DataBrowser and SourcePriorities
- showDeviceLabelNames toggle in Security Settings
- SCSS updates for Sass module syntax

## Notes

- Patches 05, 06, 07, 08 are interconnected - they work together to support
  the device label names feature and protect against null valuePath entries
- Patch 03 is needed if Admin UI is migrated to Vite build system
- Patches 01 and 02 are only needed if using Vite Module Federation
