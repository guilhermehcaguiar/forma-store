import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { sendSmtpEmail } from '../src/modules/notifications/smtp.client.js'

test('resposta SMTP hostil não devolve credencial bruta nem codificada no erro', async () => {
  const secret=randomUUID(),encoded=Buffer.from(`\0fixture-user\0${secret}`).toString('base64')
  const server=net.createServer(socket=>{
    socket.write('220 capture\r\n');let buffer=''
    socket.on('error',()=>{})
    socket.on('data',chunk=>{
      buffer+=chunk
      while(buffer.includes('\r\n')) {
        const i=buffer.indexOf('\r\n'),line=buffer.slice(0,i);buffer=buffer.slice(i+2)
        if(line.startsWith('EHLO'))socket.write('250-capture\r\n250 AUTH PLAIN\r\n')
        else if(line==='AUTH PLAIN')socket.write('334 continue\r\n')
        else socket.write(`535 recusado ${secret} ${encoded}\r\n`)
      }
    })
  })
  server.listen(0,'127.0.0.1');await once(server,'listening')
  try {
    await assert.rejects(sendSmtpEmail({host:'127.0.0.1',port:server.address().port,user:'fixture-user',password:secret,from:'forma@example.test',to:'destino@example.test',subject:'Fixture',text:'Fixture'}),error=>{
      assert.match(error.message,/535/);assert.ok(!error.message.includes(secret));assert.ok(!error.message.includes(encoded));return true
    })
  } finally {await new Promise(resolve=>server.close(resolve))}
})
