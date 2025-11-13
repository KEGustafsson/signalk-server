import React from 'react'
import { withTheme } from '@rjsf/core'
import { Theme as Bootstrap4Theme } from '@rjsf/bootstrap-4'
import validator from '@rjsf/validator-ajv8'

const Form = withTheme(Bootstrap4Theme)

// Minimal custom CSS classes (can be moved to CSS file)
const customFormClassNames = {
  button: 'btn btn-info',
  arrayItemRemove: 'btn btn-danger btn-sm',
  arrayItemMoveUp: 'btn btn-outline-dark btn-sm',
  arrayItemMoveDown: 'btn btn-outline-dark btn-sm'
}

// Only override what's necessary for custom layout
const ArrayFieldItemTemplate = (props) => {
  const {
    children,
    disabled,
    hasToolbar,
    hasMoveUp,
    hasMoveDown,
    hasRemove,
    index,
    onDropIndexClick,
    onReorderClick,
    readonly,
    registry
  } = props

  const { MoveUpButton, MoveDownButton, RemoveButton } =
    registry.templates.ButtonTemplates

  return (
    <div className="row array-item mb-3">
      <div className="col-9">{children}</div>
      {hasToolbar && (
        <div className="col-3 d-flex align-items-start">
          <div className="btn-group btn-group-sm">
            {(hasMoveUp || hasMoveDown) && (
              <MoveUpButton
                disabled={disabled || readonly || !hasMoveUp}
                onClick={onReorderClick(index, index - 1)}
              />
            )}
            {(hasMoveUp || hasMoveDown) && (
              <MoveDownButton
                disabled={disabled || readonly || !hasMoveDown}
                onClick={onReorderClick(index, index + 1)}
              />
            )}
            {hasRemove && (
              <RemoveButton
                disabled={disabled || readonly}
                onClick={onDropIndexClick(index)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Custom button templates with FontAwesome icons
const customButtonTemplates = {
  AddButton: (props) => (
    <button
      type="button"
      className="btn btn-info"
      onClick={props.onClick}
      disabled={props.disabled}
    >
      <i className="fas fa-plus" /> Add Item
    </button>
  ),
  MoveUpButton: (props) => (
    <button
      type="button"
      className="btn btn-outline-dark btn-sm"
      onClick={props.onClick}
      disabled={props.disabled}
      tabIndex={-1}
    >
      <i className="fas fa-arrow-up" />
    </button>
  ),
  MoveDownButton: (props) => (
    <button
      type="button"
      className="btn btn-outline-dark btn-sm"
      onClick={props.onClick}
      disabled={props.disabled}
      tabIndex={-1}
    >
      <i className="fas fa-arrow-down" />
    </button>
  ),
  RemoveButton: (props) => (
    <button
      type="button"
      className="btn btn-danger btn-sm"
      onClick={props.onClick}
      disabled={props.disabled}
      tabIndex={-1}
    >
      <i className="fas fa-times" />
    </button>
  ),
  SubmitButton: (props) => {
    const submitText = props.uiSchema?.['ui:submitButtonOptions']?.submitText || 'Submit'
    return (
      <button type="submit" className="btn btn-info">
        {submitText}
      </button>
    )
  }
}

// Only custom widgets that add value beyond built-in
const customWidgets = {
  // Number widget with proper type coercion
  TextWidget: (props) => {
    const { schema, value, onChange, ...otherProps } = props
    const isNumber = schema.type === 'number' || schema.type === 'integer'

    return (
      <input
        {...otherProps}
        className="form-control"
        type={isNumber ? 'number' : 'text'}
        step={schema.type === 'number' ? 'any' : schema.type === 'integer' ? '1' : undefined}
        value={value ?? ''}
        onChange={(e) => {
          const newValue = e.target.value
          if (isNumber) {
            onChange(schema.type === 'integer' ? parseInt(newValue, 10) : parseFloat(newValue))
          } else {
            onChange(newValue)
          }
        }}
      />
    )
  }
}

// Minimal templates configuration
const customTemplates = {
  ArrayFieldItemTemplate,
  ButtonTemplates: customButtonTemplates
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
