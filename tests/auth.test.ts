import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from '../src/server/index.ts';
import {Store} from '../src/server/store.ts';
import {registerAccount,loginAccount,tokenHash} from '../src/server/auth.ts';
const secret='Training-only-password-42';
async function launch(path=':memory:'){
 const app=createServer({dbPath:path,tickMs:1000});await new Promise<void>(done=>app.server.listen(0,'127.0.0.1',done));const address=app.server.address();assert(address&&typeof address==='object');const base=`http://127.0.0.1:${address.port}`;
 const request=async(path:string,data?:unknown,token?:string)=>{const res=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{})},body:data===undefined?undefined:JSON.stringify(data)});return {status:res.status,data:await res.json() as any};};
 return {...app,request};
}
test('password registration hashes independently salted credentials and prevents case-insensitive duplicates',async()=>{
 const a=await launch();try{
  const x=await a.request('/api/register',{name:'CaptainOne',password:secret}),y=await a.request('/api/register',{name:'CaptainTwo',password:secret});assert.equal(x.status,201);assert.equal(y.status,201);assert.notEqual(x.data.user.id,y.data.user.id);assert.equal(x.data.user.accountType,'account');assert.equal(x.data.user.password,undefined);
  assert.equal((await a.request('/api/register',{name:'captainONE',password:secret})).status,409);
  const credentials=a.store.db.prepare('SELECT salt,password_hash FROM account_credentials').all();assert.equal(credentials.length,2);assert.notEqual(credentials[0].salt,credentials[1].salt);assert.notEqual(credentials[0].password_hash,credentials[1].password_hash);assert(credentials.every(c=>c.password_hash!==secret));
  const sessions=a.store.db.prepare('SELECT token_hash FROM account_sessions').all();assert(sessions.every(s=>s.token_hash!==x.data.token&&s.token_hash!==y.data.token));
  for(const bad of [{name:'ab',password:secret},{name:'bad user',password:secret},{name:'ValidUser',password:'short'},{name:'ValidUser',password:'x'.repeat(129)}])assert.equal((await a.request('/api/register',bad)).status,400);
 }finally{await a.close();}
});
test('account login retains identity, logout revokes only its token, and details/host controls stay separate',async()=>{
 const a=await launch();try{
  const x=(await a.request('/api/register',{name:'OwnerOne',password:secret})).data,y=(await a.request('/api/register',{name:'OwnerTwo',password:secret})).data;
  const login=await a.request('/api/login',{name:'ownerone',password:secret});assert.equal(login.status,200);assert.equal(login.data.user.id,x.user.id);assert.notEqual(login.data.token,x.token);
  assert.equal((await a.request('/api/login',{name:'ownerone',password:'IncorrectPassword'})).status,401);assert.equal((await a.request('/api/login',{name:'MissingUser',password:secret})).status,401);
  assert.equal((await a.request('/api/me',undefined,x.token)).data.id,x.user.id);assert.equal((await a.request('/api/me',undefined,y.token)).data.id,y.user.id);
  const t=(await a.request('/api/tournaments',{name:'Account private',teamCount:2,private:true},x.token)).data;assert.equal(t.hostId,x.user.id);
  assert.equal((await a.request('/api/tournaments',undefined,y.token)).data.length,0);assert.equal((await a.request(`/api/tournaments/${t.id}`,undefined,y.token)).status,400);assert.equal((await a.request(`/api/tournaments/${t.id}/action`,{type:'startAuction'},y.token)).status,400);
  assert.equal((await a.request('/api/logout',{},x.token)).status,200);assert.equal((await a.request('/api/me',undefined,x.token)).status,401);assert.equal((await a.request('/api/me',undefined,login.data.token)).status,200);assert.equal((await a.request('/api/me',undefined,y.token)).status,200);
 }finally{await a.close();}
});
test('expired sessions reject and permanent account identity survives database restart',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'acpl-account-')),path=join(directory,'auth.db');let a=await launch(path);
 try{
  const account=(await a.request('/api/register',{name:'PersistentOwner',password:secret})).data;
  a.store.db.prepare('UPDATE account_sessions SET expires_at=? WHERE token_hash=?').run(Date.now()-1,tokenHash(account.token));assert.equal((await a.request('/api/me',undefined,account.token)).status,401);
  const login=(await a.request('/api/login',{name:'PersistentOwner',password:secret})).data;await a.close();a=await launch(path);assert.equal((await a.request('/api/me',undefined,login.token)).data.id,account.user.id);assert.equal((await a.request('/api/login',{name:'persistentowner',password:secret})).data.user.id,account.user.id);
 }finally{await a.close();rmSync(directory,{recursive:true,force:true});}
});
test('legacy guest lookup remains separate and account rows cannot authenticate through placeholder guest hashes',async()=>{
 const store=new Store(':memory:');try{
  store.addUser('legacy','Legacy Guest',tokenHash('legacy-token'));assert.equal(store.user(tokenHash('legacy-token'))?.accountType,'guest');const account=await registerAccount(store,'RealAccount',secret,100000);assert.equal(store.user(tokenHash(account.token),100001)?.accountType,'account');assert.equal(store.user(tokenHash(account.token),account.expiresAt),undefined);
  const row=store.db.prepare('SELECT token_hash FROM users WHERE id=?').get(account.user.id)!;assert.equal(store.user(String(row.token_hash)),undefined);
  const logged=await loginAccount(store,'realaccount',secret,100002);assert.equal(logged.user.id,account.user.id);store.revokeSession(tokenHash('legacy-token'));assert.equal(store.user(tokenHash('legacy-token')),undefined);
 }finally{store.close();}
});
test('repeated incorrect credentials are rate limited',async()=>{
 const a=await launch();try{await a.request('/api/register',{name:'LimitedUser',password:secret});for(let i=0;i<12;i++)assert.equal((await a.request('/api/login',{name:'LimitedUser',password:'IncorrectPassword'})).status,401);assert.equal((await a.request('/api/login',{name:'LimitedUser',password:'IncorrectPassword'})).status,429);}finally{await a.close();}
});
