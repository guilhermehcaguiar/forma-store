// Carrega o server/.env antes da configuração da API, a partir do caminho
// deste arquivo. Permite executar os scripts da pasta server/ (como
// criar-admin.js) de qualquer diretório — inclusive pela raiz do projeto —
// sem depender do CWD. Variáveis já definidas no ambiente não são sobrescritas.
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') })
