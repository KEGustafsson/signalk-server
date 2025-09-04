import React from 'react'
import Form from '@rjsf/core'
import { Theme as Bootstrap4Theme } from '@rjsf/bootstrap-4'
import validator from '@rjsf/validator-ajv8'

// eslint-disable-next-line react/display-name
export default ({ plugin, onSubmit }) => {
  const schema = JSON.parse(JSON.stringify(plugin.schema))
  var uiSchema = {}

  if (typeof plugin.uiSchema !== 'undefined') {
    uiSchema['configuration'] = JSON.parse(JSON.stringify(plugin.uiSchema))
  }

  const topSchema = {
    type: 'object',
    properties: {
      configuration: {
        type: 'object',
        title: ' ',
        description: schema.description,
        properties: schema.properties
      }
    }
  }

  if (plugin.statusMessage) {
    topSchema.description = `Status: ${plugin.statusMessage}`
  }

  const { enabled, enableLogging, enableDebug } = plugin.data
  return (
    <Form
      schema={topSchema}
      uiSchema={uiSchema}
      formData={plugin.data || {}}
      validator={validator}
      theme={Bootstrap4Theme}
      onSubmit={(submitData) => {
        onSubmit({
          ...submitData.formData,
          enabled,
          enableLogging,
          enableDebug
        })
      }}
    />
  )
}
