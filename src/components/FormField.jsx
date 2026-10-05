function FormField({ id, label, error, hint, ...inputProps }) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>

      <input
        id={id}
        className={`field__input${error ? ' field__input--error' : ''}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...inputProps}
      />

      {hint && !error ? <p className="field__hint" id={hintId}>{hint}</p> : null}
      {error ? (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export default FormField
