import React from 'react'
import { withTheme } from '@rjsf/core'
import { Theme as Bootstrap4Theme } from '@rjsf/bootstrap-4'
import validator from '@rjsf/validator-ajv8'

const Form = withTheme(Bootstrap4Theme)

// Custom ArrayFieldItemTemplate to match the original layout
const ArrayFieldItemTemplate = (props) => {
  const {
    children,
    disabled,
    hasToolbar,
    hasMoveDown,
    hasMoveUp,
    hasRemove,
    index,
    onDropIndexClick,
    onReorderClick,
    readonly,
    registry,
    uiSchema
  } = props

  const { RemoveButton } = registry.templates.ButtonTemplates

  return (
    <div className="row array-item">
      <div className="col-xs-12">
        {children}
      </div>
      {hasToolbar && (
        <div className="col-xs-12">
          {hasRemove && (
            <RemoveButton
              className="array-item-remove"
              disabled={disabled || readonly}
              onClick={onDropIndexClick(index)}
              uiSchema={uiSchema}
              registry={registry}
            />
          )}
        </div>
      )}
    </div>
  )
}

// Custom ArrayFieldTemplate to match the original layout
const ArrayFieldTemplate = (props) => {
  const { canAdd, items, onAddClick, title, schema } = props

  return (
    <fieldset className="field field-array field-array-of-object">
      {title && <legend>{title}</legend>}
      <div className="row array-item-list">
        <div className="col-xs-12">
          {items && items.map((item) => item.children)}
        </div>
      </div>
      {canAdd && (
        <div className="row">
          <div className="col-xs-12">
            <button
              type="button"
              className="btn btn-info btn-add col-xs-3 col-xs-offset-9"
              onClick={onAddClick}
            >
              <i className="glyphicon glyphicon-plus" />
            </button>
          </div>
        </div>
      )}
    </fieldset>
  )
}

// Custom button templates to match the original styling
const customTemplates = {
  ArrayFieldTemplate,
  ArrayFieldItemTemplate,
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
        className="btn btn-danger array-item-remove"
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
