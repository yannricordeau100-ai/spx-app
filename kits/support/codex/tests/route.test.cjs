const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function setup({ dbStatus = 200, email = '', mailStatus = 200 } = {}) {
 const calls = [];
 const vars = { SUPPORT_ORIGIN:'https://mettrik.test', NEXT_PUBLIC_SUPABASE_URL:'https://db.test', NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-test', SUPABASE_SERVICE_ROLE_KEY:'private-test', SUPPORT_EMAIL:'support@mettrik.ai', SUPPORT_FROM_EMAIL:'assistance@mettrik.ai', RESEND_API_KEY:'test-only' };
 function load(name) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,'../api/support',name),'utf8'), { compilerOptions: { module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Buffer, Response, Request, URL, AbortSignal, process:{ env:vars }, require: name => {
   if(name==='next/headers') return { cookies:async()=>({ getAll:()=>[], set:()=>{} }) };
   if(name==='@supabase/ssr') return { createServerClient:()=>({ auth:{ getUser:async()=>({ data:{ user:email?{email}:null }, error:null }) } }) };
   if(name==='./validation') return load('validation.ts');
   throw Error(name);
  }, fetch:async(url, init) => {
   calls.push({url,init});
   if(url.includes('/rpc/')) return Response.json(dbStatus===200?'00000000-0000-0000-0000-000000000001':{message:dbStatus===429?'SUPPORT_RATE_LIMIT':'internal detail'}, {status:dbStatus});
   if(url.includes('resend')) return Response.json({}, {status:mailStatus});
   return new Response(null,{status:204});
  } });
  return exports;
 }
 return { route:load('route.ts'), calls };
}
const body = { email:'client@exemple.fr',subject:'Besoin d’aide',category:'Compte',message:'Je ne parviens pas à me connecter.',website:'',capture:'' };
const request = (value=body,origin='https://mettrik.test')=>new Request('https://mettrik.test/api/support',{ method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(value) });
test('ticket puis notification et accusé, contenu échappé',async()=>{ const {route,calls}=setup(); const r=await route.POST(request({...body,message:'Une question <script>alert(1)</script>'})); assert.equal(r.status,201); assert.equal(calls.length,4); const mail=JSON.parse(calls[1].init.body); assert.ok(mail.html.includes('&lt;script&gt;')); assert.equal(JSON.parse(calls[2].init.body).to[0],body.email); });
test('la session serveur impose l’adresse du compte',async()=>{ const {route,calls}=setup({email:'compte@exemple.fr'}); await route.POST(request()); assert.equal(JSON.parse(calls[0].init.body).p_email,'compte@exemple.fr'); });
test('limitation en base : 429 sans e-mail',async()=>{ const {route,calls}=setup({dbStatus:429}); const r=await route.POST(request()); assert.equal(r.status,429); assert.equal(r.headers.get('retry-after'),'3600'); assert.equal(calls.length,1); });
test('échec insertion : aucun e-mail et pas de détail interne',async()=>{ const {route,calls}=setup({dbStatus:500}); const r=await route.POST(request()); assert.equal(r.status,503); assert.equal(calls.length,1); assert.ok(!(await r.text()).includes('internal detail')); });
test('échec Resend : ticket conservé et avertissement explicite',async()=>{ const {route,calls}=setup({mailStatus:500}); const r=await route.POST(request()); assert.equal(r.status,201); assert.ok((await r.json()).message.includes('incomplète')); assert.equal(JSON.parse(calls[3].init.body).receipt_sent,false); });
test('champ piège : aucun appel externe',async()=>{ const {route,calls}=setup(); assert.equal((await route.POST(request({...body,website:'robot'}))).status,200); assert.equal(calls.length,0); });
test('origine étrangère : refus avant insertion',async()=>{ const {route,calls}=setup(); assert.equal((await route.POST(request(body,'https://autre.test'))).status,403); assert.equal(calls.length,0); });
test('requête trop volumineuse sans Content-Length',async()=>{ const {route,calls}=setup(); assert.equal((await route.POST(request({...body,message:'x'.repeat(740000)}))).status,400); assert.equal(calls.length,0); });
test('GET renvoie seulement l’adresse et interdit la mise en cache',async()=>{ const {route}=setup({email:'compte@exemple.fr'}); const r=await route.GET(); assert.deepEqual(await r.json(),{email:'compte@exemple.fr'}); assert.equal(r.headers.get('cache-control'),'no-store'); });
