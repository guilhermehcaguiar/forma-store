import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
const privateKeys=['DATABASE_URL','MERCADOPAGO_TEST_ACCESS_TOKEN','MERCADOPAGO_WEBHOOK_SECRET','MELHOR_ENVIO_CLIENT_SECRET','MELHOR_ENVIO_ACCESS_TOKEN','MELHOR_ENVIO_REFRESH_TOKEN','FORMA_SMTP_PASS','SESSION_SECRET','JWT_SECRET']
const marker=`PRIVATE_CANARY_${randomUUID()}`
const result=spawnSync('npm',['run','build'],{encoding:'utf8',env:{...process.env,...Object.fromEntries(privateKeys.map(k=>[k,k==='DATABASE_URL'?`postgres://forma:${marker}@localhost/forma`:marker]))}})
assert.equal(result.status,0,'Build com variáveis privadas deve funcionar sem publicá-las')
let count=0
async function scan(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+entry.name;if(entry.isDirectory())await scan(path);else{count++;const content=await readFile(path);assert.ok(!content.includes(marker),'Canário privado encontrado no bundle')}}}
await scan('dist')
const blocked=spawnSync('npm',['run','build'],{encoding:'utf8',env:{...process.env,VITE_MERCADOPAGO_ACCESS_TOKEN:marker}})
assert.notEqual(blocked.status,0,'Variável VITE privada deve impedir o build')
assert.ok(!(blocked.stdout+blocked.stderr).includes(marker),'Erro de configuração não deve refletir o segredo')
await mkdir('.tmp/security-audit',{recursive:true})
const report={privateEnvVariables:privateKeys.length,bundleFiles:count,privateCanaryOccurrences:0,privateViteVariableBuild:'rejected without echo',build:'passed'}
await writeFile('.tmp/security-audit/bundle.json',JSON.stringify(report,null,2))
console.log(JSON.stringify(report))
