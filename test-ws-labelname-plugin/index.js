module.exports = function (app) {
  const plugin = {
    id: 'test-ws-labelname',
    name: 'Test WS LabelName Plugin',
    description: 'Subscribes to WS device deltas and logs source.labelName'
  }

  plugin.start = function (options) {
    app.debug('Starting test-ws-labelname plugin')

    app.signalk.on('delta', (delta) => {
      if (!delta.updates) return

      delta.updates.forEach((update) => {
        const source = update.$source || ''

        // Only process WS sources
        if (!source.startsWith('ws.')) return

        const sourceObj = update.source || {}
        const labelName = sourceObj.labelName || '(no labelName)'
        const label = sourceObj.label || source

        app.debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        app.debug('WS Delta Received:')
        app.debug(`  $source:   ${source}`)
        app.debug(`  label:     ${label}`)
        app.debug(`  labelName: ${labelName}`)
        app.debug(`  timestamp: ${update.timestamp}`)

        if (update.values) {
          app.debug('  values:')
          update.values.forEach((v) => {
            app.debug(`    ${v.path}: ${JSON.stringify(v.value)}`)
          })
        }

        // Pretty print full source object
        if (Object.keys(sourceObj).length > 0) {
          app.debug('  source object:')
          app.debug(JSON.stringify(sourceObj, null, 4).split('\n').map(l => '    ' + l).join('\n'))
        }
      })
    })

    app.debug('Subscribed to WS deltas')
  }

  plugin.stop = function () {
    app.debug('Stopping test-ws-labelname plugin')
  }

  plugin.schema = {
    type: 'object',
    properties: {}
  }

  return plugin
}
