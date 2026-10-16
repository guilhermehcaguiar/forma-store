import test from 'node:test'
import assert from 'node:assert/strict'
import {parseEmailChange,parsePasswordChange} from '../src/modules/auth/auth.schemas.js'

test('e-mail normalizado exige senha atual e rejeita formatos e tipos inválidos',()=>{
  assert.deepEqual(parseEmailChange({email:' Aluno@Example.TEST ',currentPassword:' atual123 '}),{email:'aluno@example.test',currentPassword:' atual123 '})
  for(const body of [null,{email:[]},{email:'x@example.test'},{email:'inválido',currentPassword:'atual123'},{email:'a'.repeat(255)+'@ex.test',currentPassword:'atual123'}])assert.throws(()=>parseEmailChange(body),e=>e.status===400)
})
test('senha exige atual, mínimo/máximo, diferença e confirmação sem normalizar espaços',()=>{
  assert.deepEqual(parsePasswordChange({currentPassword:'antes123',newPassword:' nova123 ',confirmPassword:' nova123 '}),{currentPassword:'antes123',newPassword:' nova123 '})
  for(const body of [null,{currentPassword:'antes123',newPassword:'123',confirmPassword:'123'},{currentPassword:'antes123',newPassword:'antes123',confirmPassword:'antes123'},{currentPassword:'antes123',newPassword:'depois123',confirmPassword:'diferente'},{currentPassword:'antes123',newPassword:'a'.repeat(129),confirmPassword:'a'.repeat(129)}])assert.throws(()=>parsePasswordChange(body),e=>e.status===400)
})
