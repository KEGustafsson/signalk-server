import React from 'react'

export const toLazyDynamicComponent = (moduleName, component) =>
  React.lazy(
    () =>
      new Promise((resolve, reject) => {
        const safeModuleId = toSafeModuleId(moduleName)
        console.log('[toLazyDynamicComponent] Loading module:', moduleName)
        console.log('[toLazyDynamicComponent] Safe module ID:', safeModuleId)
        console.log('[toLazyDynamicComponent] Component to load:', component)

        const container = window[safeModuleId]
        console.log('[toLazyDynamicComponent] Container lookup result:', container)

        if (container === undefined) {
          console.error(`[toLazyDynamicComponent] Could not load module ${moduleName} (${safeModuleId})`)
          console.error('[toLazyDynamicComponent] Container is undefined, loading error component')
          resolve(import('./loadingerror'))
          return
        }

        console.log('[toLazyDynamicComponent] Container found, initializing...')
        console.log('[toLazyDynamicComponent] Container type:', typeof container)
        console.log('[toLazyDynamicComponent] Container keys:', Object.keys(container))

        try {
          // eslint-disable-next-line no-undef
          console.log('[toLazyDynamicComponent] Calling container.init with webpack share scopes')
          container.init(__webpack_share_scopes__.default)
          console.log('[toLazyDynamicComponent] Container initialized successfully')

          console.log('[toLazyDynamicComponent] Getting component:', component)
          const module = container.get(component)
          console.log('[toLazyDynamicComponent] Module get result:', module)

          module.then((factory) => {
            console.log('[toLazyDynamicComponent] Factory received:', factory)
            const result = factory()
            console.log('[toLazyDynamicComponent] Factory result:', result)
            resolve(result)
          }).catch((err) => {
            console.error('[toLazyDynamicComponent] Module promise rejected:', err)
            reject(err)
          })
        } catch (ex) {
          console.error('[toLazyDynamicComponent] Exception during module loading:', ex)
          console.error('[toLazyDynamicComponent] Module name:', moduleName)
          console.error('[toLazyDynamicComponent] Component:', component)
          console.error('[toLazyDynamicComponent] Stack trace:', ex.stack)
          reject(ex)
        }
      })
  )

export const toSafeModuleId = (moduleName) => moduleName.replace(/[-@/]/g, '_')

export const APP_PANEL = './AppPanel'
export const ADDON_PANEL = './AddonPanel'
export const PLUGIN_CONFIG_PANEL = './PluginConfigurationPanel'
