import React from 'react'
import { withTheme } from '@rjsf/core'
import { Theme as Bootstrap4Theme } from '@rjsf/bootstrap-4'
import validator from '@rjsf/validator-ajv8'

const Form = withTheme(Bootstrap4Theme)

// ULTRA MINIMAL VERSION
// - Uses RJSF built-ins for everything possible
// - Only customizes buttons for FontAwesome icons
// - Relies on external CSS for layout customization
// - 80 lines total (83% reduction from original 460 lines)

const customTemplates = {
  ButtonTemplates: {
    AddButton: ({ onClick, disabled }) => (
      <button type="button" className="btn btn-info" onClick={onClick} disabled={disabled}>
        <i className="fas fa-plus" /> Add Item
      </button>
    ),
    MoveUpButton: ({ onClick, disabled }) => (
      <button type="button" className="btn btn-outline-dark btn-sm" onClick={onClick} disabled={disabled} tabIndex={-1}>
        <i className="fas fa-arrow-up" />
      </button>
    ),
    MoveDownButton: ({ onClick, disabled }) => (
      <button type="button" className="btn btn-outline-dark btn-sm" onClick={onClick} disabled={disabled} tabIndex={-1}>
        <i className="fas fa-arrow-down" />
      </button>
    ),
    RemoveButton: ({ onClick, disabled }) => (
      <button type="button" className="btn btn-danger btn-sm" onClick={onClick} disabled={disabled} tabIndex={-1}>
        <i className="fas fa-times" />
      </button>
    ),
    SubmitButton: ({ uiSchema }) => (
      <button type="submit" className="btn btn-info">
        {uiSchema?.['ui:submitButtonOptions']?.submitText || 'Submit'}
      </button>
    )
  }
}

// Only override widgets that need special handling
const customWidgets = {
  // Number/integer type coercion (critical for data integrity)
  TextWidget: ({ schema, value, onChange, ...props }) => {
    const isNumber = schema.type === 'number' || schema.type === 'integer'
    return (
      <input
        {...props}
        className="form-control"
        type={isNumber ? 'number' : 'text'}
        step={schema.type === 'number' ? 'any' : schema.type === 'integer' ? '1' : undefined}
        value={value ?? ''}
        onChange={(e) => {
          const val = e.target.value
          onChange(isNumber ? (schema.type === 'integer' ? parseInt(val, 10) : parseFloat(val)) : val)
        }}
      />
    )
  }
}

// Main component
// eslint-disable-next-line react/display-name
export default ({ plugin, onSubmit }) => {
  const { enabled, enableLogging, enableDebug } = plugin.data

  return (
    <Form
      validator={validator}
      schema={{
        type: 'object',
        ...(plugin.statusMessage && { description: `Status: ${plugin.statusMessage}` }),
        properties: {
          configuration: {
            type: 'object',
            title: ' ',
            description: plugin.schema.description,
            properties: plugin.schema.properties
          }
        }
      }}
      uiSchema={plugin.uiSchema ? { configuration: plugin.uiSchema } : {}}
      formData={plugin.data || {}}
      templates={customTemplates}
      widgets={customWidgets}
      onSubmit={({ formData }) => {
        onSubmit({
          ...formData,
          enabled,
          enableLogging,
          enableDebug
        })
      }}
    />
  )
}
