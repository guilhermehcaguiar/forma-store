import { Link } from 'react-router-dom'

function Button({ children, to, variant = 'primary', size = 'medium', ...props }) {
  const className = `button button--${variant} button--${size}`

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
