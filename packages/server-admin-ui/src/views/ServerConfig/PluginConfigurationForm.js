import React from 'react'
import { withTheme } from '@rjsf/core'
import { Theme as Bootstrap4Theme } from '@rjsf/bootstrap-4'
import validator from '@rjsf/validator-ajv8'

const Form = withTheme(Bootstrap4Theme)

// Custom button templates to match the original styling
const customTemplates = {
  ButtonTemplates: {
    AddButton: (props) => (
      <button
        {...props}
        type="button"
        className="btn btn-info btn-add col-xs-3 col-xs-offset-9"
      >
        <i className="glyphicon glyphicon-plus" />
      </button>
    ),
    RemoveButton: (props) => (
      <button
        {...props}
        type="button"
        className="btn btn-danger col-xs-2 array-item-remove"
      >
        <i className="glyphicon glyphicon-remove" />
      </button>
    )
  }
}

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
      validator={validator}
      schema={topSchema}
      uiSchema={uiSchema}
      formData={plugin.data || {}}
      templates={customTemplates}
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
