import React, { Component, Suspense } from 'react'
import {
  PLUGIN_CONFIG_PANEL,
  toLazyDynamicComponent,
  toSafeModuleId
} from '../Webapps/dynamicutilities'
import PluginConfigurationForm from '../ServerConfig/PluginConfigurationForm'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Plugin configurator error caught:', error)
    console.error('[ErrorBoundary] Error info:', errorInfo)
    console.error('[ErrorBoundary] Error stack:', error.stack)
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack)
    console.warn('[ErrorBoundary] Falling back to standard PluginConfigurationForm due to error')
  }

  render() {
    if (this.state.hasError) {
      console.warn('[ErrorBoundary] Rendering fallback component due to previous error')
      return this.props.fallback
    }
    return this.props.children
  }
}

export default class EmbeddedPluginConfigurationForm extends Component {
  constructor(props) {
    super(props)

    // Debug: Log platform and environment information
    console.log('[EmbeddedPluginConfigurationForm] User Agent:', navigator.userAgent)
    console.log('[EmbeddedPluginConfigurationForm] Platform:', navigator.platform)
    console.log('[EmbeddedPluginConfigurationForm] Window location:', window.location.href)

    // Debug: Log plugin information
    console.log('[EmbeddedPluginConfigurationForm] Plugin package name:', props.plugin.packageName)
    console.log('[EmbeddedPluginConfigurationForm] Plugin id:', props.plugin.id)

    const safeModuleId = toSafeModuleId(props.plugin.packageName)
    console.log('[EmbeddedPluginConfigurationForm] Safe module ID:', safeModuleId)

    // Check if the plugin's Module Federation container is available
    const containerExists = typeof window !== 'undefined' &&
                           window[safeModuleId] !== undefined

    console.log('[EmbeddedPluginConfigurationForm] Container exists:', containerExists)
    console.log('[EmbeddedPluginConfigurationForm] window object keys containing plugin-related names:',
      typeof window !== 'undefined' ? Object.keys(window).filter(key =>
        key.includes('signalk') || key.includes('plugin') || key.startsWith('_')
      ) : []
    )

    if (!containerExists) {
      console.warn(`[EmbeddedPluginConfigurationForm] Module Federation container NOT found for ${props.plugin.packageName} (${safeModuleId})`)
      console.warn('[EmbeddedPluginConfigurationForm] Falling back to standard PluginConfigurationForm')
      console.warn('[EmbeddedPluginConfigurationForm] Available Module Federation containers:',
        typeof window !== 'undefined' ? Object.keys(window).filter(key =>
          typeof window[key] === 'object' &&
          window[key] !== null &&
          typeof window[key].get === 'function'
        ) : []
      )
    } else {
      console.log(`[EmbeddedPluginConfigurationForm] Module Federation container found for ${props.plugin.packageName}`)
      console.log('[EmbeddedPluginConfigurationForm] Container object:', window[safeModuleId])
    }

    this.state = {
      component: containerExists ? toLazyDynamicComponent(
        props.plugin.packageName,
        PLUGIN_CONFIG_PANEL
      ) : null,
      configuration: this.props.plugin.data.configuration,
      useStandardForm: !containerExists
    }
  }

  render() {
    // If Module Federation container not found, use standard form
    if (this.state.useStandardForm) {
      return (
        <PluginConfigurationForm
          plugin={this.props.plugin}
          onSubmit={(data) => {
            this.props.saveData(data)
            this.props.history.replace(`/serverConfiguration/plugins/-`)
          }}
        />
      )
    }

    return (
      <div>
        <ErrorBoundary
          fallback={
            <PluginConfigurationForm
              plugin={this.props.plugin}
              onSubmit={(data) => {
                this.props.saveData(data)
                this.props.history.replace(`/serverConfiguration/plugins/-`)
              }}
            />
          }
        >
          <Suspense fallback="Loading...">
            {React.createElement(this.state.component, {
              configuration: this.state.configuration,
              save: (configuration) => {
                this.props.saveData({
                  ...this.props.plugin.data,
                  configuration
                })
                this.setState({ configuration })
              }
            })}
          </Suspense>
        </ErrorBoundary>
      </div>
    )
  }
}
