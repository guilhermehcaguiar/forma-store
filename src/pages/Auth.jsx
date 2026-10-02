import Button from '../components/Button'

function Auth() {
  return (
    <section className="page">
      <h1>Login / Cadastro</h1>

      <div className="auth-grid">
        <form className="auth-form" onSubmit={(event) => event.preventDefault()}>
          <h2>Entrar</h2>
          <label>
            E-mail
            <input type="email" name="email" autoComplete="email" />
          </label>
          <label>
            Senha
            <input type="password" name="password" autoComplete="current-password" />
          </label>
          <Button type="submit">Entrar</Button>
        </form>

        <form className="auth-form" onSubmit={(event) => event.preventDefault()}>
          <h2>Criar conta</h2>
          <label>
            Nome
            <input type="text" name="name" autoComplete="name" />
          </label>
          <label>
            E-mail
            <input type="email" name="email" autoComplete="email" />
          </label>
          <label>
            Senha
            <input type="password" name="password" autoComplete="new-password" />
          </label>
          <Button type="submit">Cadastrar</Button>
        </form>
      </div>
    </section>
  )
}

export default Auth
