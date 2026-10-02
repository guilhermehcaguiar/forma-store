import { Link } from 'react-router-dom'

function Button({ children, to, variant = 'primary', ...props }) {
  const className = `button button--${variant}`

  if (to) {
    return (
      <Link to={to} className={className} {...props}>
        {children}
      </Link>
    )
  }

  return (
    <button className={className} {...props}>
      {children}
    </button>
  )
}

export default Button
