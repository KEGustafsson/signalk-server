import React from 'react'
import { withTheme } from '@rjsf/core'
import { Theme as Bootstrap4Theme } from '@rjsf/bootstrap-4'
import validator from '@rjsf/validator-ajv8'
import { getTemplate, getUiOptions } from '@rjsf/utils'

const Form = withTheme(Bootstrap4Theme)

// Custom ArrayFieldItemTemplate matching old react-jsonschema-form-bs4 layout
const ArrayFieldItemTemplate = (props) => {
  const {
    children,
    disabled,
    hasToolbar,
    hasRemove,
    index,
    onDropIndexClick,
    readonly,
    registry,
    uiSchema
  } = props

  const { RemoveButton } = registry.templates.ButtonTemplates

  return (
    <div className="row array-item">
      <div className="col-9">
        {children}
      </div>
      <div className="col-3 array-item-toolbox">
        {hasToolbar && hasRemove && (
          <div className="btn-group" style={{ display: 'flex', justifyContent: 'space-around' }}>
            <RemoveButton
              className="array-item-remove"
              disabled={disabled || readonly}
              onClick={onDropIndexClick(index)}
              uiSchema={uiSchema}
              registry={registry}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Custom ObjectFieldTemplate matching old react-jsonschema-form-bs4 layout
const ObjectFieldTemplate = (props) => {
  const { properties, idSchema } = props

  return (
    <fieldset id={idSchema.$id}>
      {properties.map((prop) => prop.content)}
    </fieldset>
  )
}

// Custom ArrayFieldTemplate matching old react-jsonschema-form-bs4 layout
const ArrayFieldTemplate = (props) => {
  const {
    canAdd,
    disabled,
    idSchema,
    uiSchema,
    items,
    onAddClick,
    readonly,
    registry,
    schema,
    title
  } = props

  const uiOptions = getUiOptions(uiSchema)
  const ArrayFieldItemTemplate = getTemplate('ArrayFieldItemTemplate', registry, uiOptions)
  const { ButtonTemplates: { AddButton } } = registry.templates

  return (
    <fieldset className="field field-array field-array-of-object" id={idSchema.$id}>
      {(uiOptions.title || title) && (
        <legend id={`${idSchema.$id}__title`}>
          {uiOptions.title || title}
        </legend>
      )}
      {(uiOptions.description || schema.description) && (
        <div className="field-description">
          {uiOptions.description || schema.description}
        </div>
      )}
      <div className="array-item-list">
        {items && items.map(({ key, ...itemProps }) => (
          <ArrayFieldItemTemplate key={key} {...itemProps} />
        ))}
      </div>
      {canAdd && (
        <div className="row">
          <p className="col-3 offset-9 text-right array-item-add">
            <AddButton
              className="btn-add col-12"
              onClick={onAddClick}
              disabled={disabled || readonly}
              uiSchema={uiSchema}
              registry={registry}
            />
          </p>
        </div>
      )}
    </fieldset>
  )
}

// Custom button templates to match the original styling
const customTemplates = {
  ObjectFieldTemplate,
  ArrayFieldTemplate,
  ArrayFieldItemTemplate,
  ButtonTemplates: {
    AddButton: (props) => {
      const { onClick, disabled, className } = props
      return (
        <button
          type="button"
          className={`btn btn-info ${className || ''}`}
          onClick={onClick}
          disabled={disabled}
          tabIndex={0}
        >
          <i className="fas fa-plus" />
        </button>
      )
    },
    RemoveButton: (props) => {
      const { onClick, disabled, className } = props
      const btnStyle = {
        flex: 1,
        paddingLeft: 6,
        paddingRight: 6,
        fontWeight: 'bold'
      }
      return (
        <button
          type="button"
          className={`btn btn-danger ${className || ''}`}
          onClick={onClick}
          disabled={disabled}
          tabIndex={-1}
          style={btnStyle}
        >
          <i className="fas fa-times" />
        </button>
      )
    }
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
