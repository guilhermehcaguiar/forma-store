// Autorização reutilizável por papel (RNF08), independente de banco.
// Usar sempre DEPOIS de requireAuth (server/src/middleware/auth.js), que
// preenche req.user. Ex.:
//   router.get('/usuarios', requireAuth, requireRole('administrador'), handler)
//
// Papéis válidos: 'cliente' (padrão de toda conta nova) e 'administrador'
// (concedido somente pelo comando local `npm run admin`).
import { forbidden, unauthorized } from '../utils/httpError.js'

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(unauthorized('sessao_ausente', 'Envie o token de acesso no cabeçalho Authorization.'))
    }
    if (!roles.includes(req.user.role)) {
      return next(forbidden('acesso_negado', 'Você não tem permissão para acessar esta área.'))
    }
    return next()
  }
}
