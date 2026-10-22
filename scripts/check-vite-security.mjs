import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir,writeFile,unlink } from 'node:fs/promises'
import { createServer } from 'vite'
const server=await createServer({server:{port:5190,strictPort:true}})
const files=[],checks=[],marker=randomUUID(),suffix=randomUUID()
try {
  await server.listen()
  for(const dir of ['.local','server/.local'])await mkdir(dir,{recursive:true})
  for(const file of [`.local/security-${suffix}.txt`,`server/.local/security-${suffix}.txt`,`.env.security-${suffix}`,`server/.env.security-${suffix}`]) {
    files.push(file);await writeFile(file,marker,{mode:0o600})
    for(const path of [`/${file}`,`/@fs/${process.cwd()}/${file}`,`/${file}?raw`,`/${file}?import`]) {
      const response=await fetch('http://127.0.0.1:5190'+path),body=await response.text()
      const result={path: path.replaceAll(suffix,'CANARY'),status:response.status,type:response.headers.get('content-type'),leaked:body.includes(marker)}
      checks.push(result)
    }
  }
  await mkdir('.tmp/security-audit',{recursive:true});await writeFile('.tmp/security-audit/vite.json',JSON.stringify(checks,null,2));console.log(JSON.stringify(checks))
  assert.ok(checks.every(c=>!c.leaked),'Vite expôs conteúdo privado')
}finally{for(const file of files)await unlink(file).catch(()=>{});await server.close()}
