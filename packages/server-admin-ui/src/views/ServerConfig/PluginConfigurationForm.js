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
    <div>
      {hasToolbar && hasRemove && (
        <div className="row">
          <div className="col-12">
            <RemoveButton
              className="array-item-remove"
              disabled={disabled || readonly}
              onClick={onDropIndexClick(index)}
              uiSchema={uiSchema}
              registry={registry}
            />
          </div>
        </div>
      )}
      <div className="row array-item">
        <div className="col-12">
          {children}
        </div>
      </div>
    </div>
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
    required,
    schema,
    title
  } = props

  const uiOptions = getUiOptions(uiSchema)
  const ArrayFieldTitleTemplate = getTemplate('ArrayFieldTitleTemplate', registry, uiOptions)
  const ArrayFieldDescriptionTemplate = getTemplate('ArrayFieldDescriptionTemplate', registry, uiOptions)
  const ArrayFieldItemTemplate = getTemplate('ArrayFieldItemTemplate', registry, uiOptions)
  const { ButtonTemplates: { AddButton } } = registry.templates

  return (
    <fieldset className="field-array">
      <ArrayFieldTitleTemplate
        idSchema={idSchema}
        title={uiOptions.title || title}
        schema={schema}
        uiSchema={uiSchema}
        required={required}
        registry={registry}
      />
      <ArrayFieldDescriptionTemplate
        idSchema={idSchema}
        description={uiOptions.description || schema.description}
        schema={schema}
        uiSchema={uiSchema}
        registry={registry}
      />
      <div className="array-item-list">
        {items && items.map(({ key, ...itemProps }) => (
          <ArrayFieldItemTemplate key={key} {...itemProps} />
        ))}
      </div>
      {canAdd && (
        <div className="row">
          <div className="col-12 text-right">
            <AddButton
              className="array-item-add btn-add"
              onClick={onAddClick}
              disabled={disabled || readonly}
              uiSchema={uiSchema}
              registry={registry}
            />
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
    AddButton: (props) => {
      const { onClick, disabled, className, ...otherProps } = props
      return (
        <button
          type="button"
          className={`btn btn-info ${className || ''}`}
          onClick={onClick}
          disabled={disabled}
        >
          <i className="glyphicon glyphicon-plus" />
        </button>
      )
    },
    RemoveButton: (props) => {
      const { onClick, disabled, className, ...otherProps } = props
      return (
        <button
          type="button"
          className={`btn btn-danger ${className || ''}`}
          onClick={onClick}
          disabled={disabled}
        >
          <i className="glyphicon glyphicon-remove" />
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
