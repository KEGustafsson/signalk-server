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
    console.error('Plugin configurator error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

export default class EmbeddedPluginConfigurationForm extends Component {
  constructor(props) {
    super(props)

    // Check if the plugin's Module Federation container is available
    const containerExists = typeof window !== 'undefined' &&
                           window[toSafeModuleId(props.plugin.packageName)] !== undefined

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
