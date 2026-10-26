import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createServer } from '../src/server/index.ts';

async function launch(dbPath=':memory:',tickMs=1000) {
 const app=createServer({dbPath,tickMs});await new Promise<void>(done=>app.server.listen(0,'127.0.0.1',done));
 const address=app.server.address();assert(address&&typeof address==='object');const base=`http://127.0.0.1:${address.port}`;
 async function req(path:string,token?:string,data?:unknown){const response=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data)});return {status:response.status,data:await response.json() as any};}
 async function guest(name:string){return (await req('/api/guest',undefined,{name})).data as {token:string,user:{id:string,name:string}};}
 return {...app,base,req,guest};
}
test('API authentication, host controls, one-owner rule and safe phase transitions',async()=>{
 const a=await launch();try{
  assert.equal((await a.req('/api/tournaments')).status,401);
  const host=await a.guest('Host'),other=await a.guest('Other');
  const created=await a.req('/api/tournaments',host.token,{name:'Night League',teamCount:2,overs:1});assert.equal(created.status,201);const id=created.data.id;
  assert.equal((await a.req(`/api/tournaments/${id}/join`,host.token,{name:'Owls'})).status,200);
  assert.equal((await a.req(`/api/tournaments/${id}/join`,host.token,{name:'Duplicate'})).status,400);
  assert.equal((await a.req(`/api/tournaments/${id}/action`,other.token,{type:'startAuction'})).status,400);
  assert.equal((await a.req(`/api/tournaments/${id}/action`,host.token,{type:'startAuction'})).status,400);
  await a.req(`/api/tournaments/${id}/join`,other.token,{name:'Tigers'});
  assert.equal((await a.req(`/api/tournaments/${id}/action`,host.token,{type:'startAuction'})).data.status,'AUCTION');
  assert.equal((await a.req(`/api/tournaments/${id}/action`,host.token,{type:'finishAuction'})).status,400);
  assert.equal((await a.req(`/api/tournaments/${id}/action`,host.token,{type:'setScore',runs:999})).status,400);
  assert.equal((await a.req(`/api/tournaments/${id}/action`,host.token,{type:'fixtures'})).status,400);
 }finally{await a.close();}
});
test('concurrent HTTP bids resolve serially, preserve history, reject replay conflicts and early sales',async()=>{
 const a=await launch();try{
  const x=await a.guest('First'),y=await a.guest('Second');const t=(await a.req('/api/tournaments',x.token,{name:'Atomic',teamCount:2,overs:1})).data;
  for(const [owner,name] of [[x,'Alpha'],[y,'Beta']] as const)await a.req(`/api/tournaments/${t.id}/join`,owner.token,{name});
  const action=(token:string,data:unknown)=>a.req(`/api/tournaments/${t.id}/action`,token,data);
  await action(x.token,{type:'startAuction'});await action(x.token,{type:'nominate',playerId:'player-1'});
  const bids=await Promise.all([action(x.token,{type:'bid',amount:100,requestId:'request_first'}),action(y.token,{type:'bid',amount:100,requestId:'request_second'})]);
  assert.equal(bids.filter(r=>r.status===200).length,1);assert.equal(bids.filter(r=>r.status===400).length,1);
  const winner=bids[0].status===200?x:y;assert.equal((await action(winner.token,{type:'bid',amount:100,requestId:winner===x?'request_first':'request_second'})).status,200);
  assert.equal((await action(winner.token,{type:'bid',amount:500,requestId:winner===x?'request_first':'request_second'})).status,400);
  assert.equal((await action(x.token,{type:'closeLot'})).status,400);
  const stored=(await a.req(`/api/tournaments/${t.id}`,x.token)).data;assert.equal(stored.auction.current.bids.length,1);assert.equal(stored.auction.lots[0].bids.length,1);assert(stored.teams.every((team:any)=>team.purse===12000));
 }finally{await a.close();}
});
test('SQLite restart preserves identity, tournament rules, auction bid ownership and audit records',async()=>{
 const path=mkdtempSync(join(tmpdir(),'acpl-server-'));const db=join(path,'test.db');let a=await launch(db);
 try{
  const owner=await a.guest('Persistent'),second=await a.guest('Second');const t=(await a.req('/api/tournaments',owner.token,{name:'Persistent League',teamCount:2,overs:2})).data;
  await a.req(`/api/tournaments/${t.id}/join`,owner.token,{name:'Owls'});await a.req(`/api/tournaments/${t.id}/join`,second.token,{name:'Hawks'});
  await a.req(`/api/tournaments/${t.id}/action`,owner.token,{type:'startAuction'});await a.req(`/api/tournaments/${t.id}/action`,owner.token,{type:'nominate',playerId:'player-1'});await a.req(`/api/tournaments/${t.id}/action`,owner.token,{type:'bid',amount:100,requestId:'persistent_bid'});
  await a.close();a=await launch(db);
  const reread=await a.req(`/api/tournaments/${t.id}`,owner.token);assert.equal(reread.status,200);assert.equal(reread.data.auction.current.highestTeamId,reread.data.teams[0].id);assert.equal(reread.data.overs,2);assert.equal((await a.req('/api/me',owner.token)).data.id,owner.user.id);
  assert((await a.req(`/api/tournaments/${t.id}/audit`,owner.token)).data.length>=5);assert.equal((await a.req(`/api/tournaments/${t.id}/audit`,second.token)).status,400);
 }finally{await a.close();rmSync(path,{recursive:true,force:true});}
});
test('private tournaments require invitation for outsiders; websocket token is validated',async()=>{
 const a=await launch();try{
  const x=await a.guest('Host'),y=await a.guest('Outside');const t=(await a.req('/api/tournaments',x.token,{name:'Private',teamCount:2,private:true})).data;
  assert.equal((await a.req('/api/tournaments',y.token)).data.length,0);assert.equal((await a.req(`/api/tournaments/${t.id}`,y.token)).status,400);assert.equal((await a.req(`/api/tournaments/${t.inviteCode}`,y.token)).data.id,t.id);
  assert.equal((await a.req(`/api/tournaments/${t.id}/join`,y.token,{name:'Invited',inviteCode:t.inviteCode})).status,200);
  const ws=new WebSocket(a.base.replace('http','ws')+`/ws?token=${y.token}`);await new Promise<void>((done,fail)=>{ws.once('open',done);ws.once('error',fail);});
  const got=new Promise<any>(done=>ws.once('message',raw=>done(JSON.parse(raw.toString()))));ws.send(JSON.stringify({type:'subscribe',tournamentId:t.id}));assert.equal((await got).data.id,t.id);ws.close();
  const outsider=await a.guest('Uninvited');const outsiderSocket=new WebSocket(a.base.replace('http','ws')+`/ws?token=${outsider.token}`);await new Promise<void>((done,fail)=>{outsiderSocket.once('open',done);outsiderSocket.once('error',fail);});const denied=new Promise<any>(done=>outsiderSocket.once('message',raw=>done(JSON.parse(raw.toString()))));outsiderSocket.send(JSON.stringify({type:'subscribe',tournamentId:t.id}));assert.equal((await denied).type,'error');outsiderSocket.terminate();
  const bad=new WebSocket(a.base.replace('http','ws')+'/ws?token=invalid');await new Promise<void>(done=>bad.once('error',()=>done()));
 }finally{await a.close();}
});

test('five live websocket sessions isolate physics inputs, enforce capacity and recover committed checkpoints',async()=>{
 const path=mkdtempSync(join(tmpdir(),'acpl-live-')),db=join(path,'test.db');let a=await launch(db,20);const sockets:WebSocket[]=[];
 try{
  const owners=await Promise.all(Array.from({length:10},(_,i)=>a.guest(`Owner ${i}`)));const host=owners[0];
  const t=(await a.req('/api/tournaments',host.token,{name:'Isolation',teamCount:10,overs:1})).data;
  for(let i=0;i<10;i++)await a.req(`/api/tournaments/${t.id}/join`,owners[i].token,{name:`Team ${i}`});
  // Seed purchased rosters for transport/orchestration testing only; auction ownership has separate real API tests.
  const seeded=a.store.get<any>(t.id)!;seeded.status='SQUAD_VALIDATION';const used=new Set<string>();
  for(const team of seeded.teams){const pick=(predicate:(p:any)=>boolean)=>{const p=seeded.players.find((p:any)=>!used.has(p.id)&&!p.overseas&&predicate(p));assert(p);used.add(p.id);return p.id;};const ids=[pick(p=>p.role==='WICKETKEEPER'),...Array.from({length:4},()=>pick(p=>p.role==='BOWLER'||p.role==='ALL_ROUNDER')),...Array.from({length:6},()=>pick(()=>true))];team.roster=ids;team.xi=ids;team.captainId=ids[1];team.keeperId=ids[0];team.ready=true;}
  a.store.save(seeded);
  const fixtureResponse=await a.req(`/api/tournaments/${t.id}/action`,host.token,{type:'fixtures',format:'single'});assert.equal(fixtureResponse.status,200);
  const fixtures=fixtureResponse.data.fixtures;const chosen:any[]=[];const occupied=new Set<string>();
  // Complete round robin includes a perfect matching; select ten distinct franchises explicitly.
  for(let i=0;i<10;i+=2){const ids=[seeded.teams[i].id,seeded.teams[i+1].id];const f=fixtures.find((f:any)=>ids.includes(f.teamAId)&&ids.includes(f.teamBId));assert(f);chosen.push(f);occupied.add(f.teamAId);occupied.add(f.teamBId);}assert.equal(occupied.size,10);
  const states:any[]=[];for(const f of chosen){const r=await a.req(`/api/tournaments/${t.id}/action`,host.token,{type:'startMatch',fixtureId:f.id});assert.equal(r.status,200);states.push(r.data);}assert.equal(a.sessions.size,5);
  const extra=fixtures.find((f:any)=>!chosen.some(c=>c.id===f.id));assert.equal((await a.req(`/api/tournaments/${t.id}/action`,host.token,{type:'startMatch',fixtureId:extra.id})).status,400);
  const received=new Map<string,any[]>();
  for(let i=0;i<10;i++){const owner=owners[i];const ws=new WebSocket(a.base.replace('http','ws')+`/ws?token=${owner.token}`);await new Promise<void>((done,fail)=>{ws.once('open',done);ws.once('error',fail);});sockets.push(ws);received.set(owner.user.id,[]);ws.on('message',raw=>received.get(owner.user.id)!.push(JSON.parse(raw.toString())));const state=states.find(s=>s.teams.some((team:any)=>team.ownerId===owner.user.id));ws.send(JSON.stringify({type:'joinMatch',matchId:state.id}));}
  await new Promise(done=>setTimeout(done,40));
  const first=states[0],bowlerId=first.teams[1].ownerId,bowlerIndex=owners.findIndex(o=>o.user.id===bowlerId);
  sockets[bowlerIndex].send(JSON.stringify({type:'input',matchId:first.id,sequence:0,action:{type:'bowl',targetX:0,speed:24,spin:0}}));
  await new Promise(done=>setTimeout(done,80));
  assert.equal(a.sessions.get(first.id)!.state.phase,'DELIVERY');assert(a.sessions.get(first.id)!.state.ball.z>-9,'authoritative physics advances only released session');for(const other of states.slice(1))assert.equal(a.sessions.get(other.id)!.state.phase,'READY');
  sockets[bowlerIndex].send(JSON.stringify({type:'input',matchId:first.id,sequence:0,action:{type:'bowl',targetX:0,speed:24,spin:0}}));await new Promise(done=>setTimeout(done,30));assert(received.get(bowlerId)!.some(m=>m.type==='error'));
  // A completed authoritative state still reaches attached clients even when worker admission is released.
  const finishing=a.sessions.get(states[1].id)!;finishing.state.phase='COMPLETE';finishing.state.winnerId=finishing.state.teams[0].id;finishing.state.inningsScores=finishing.state.teams.map((team,index)=>({teamId:team.id,runs:index===0?10:5,wickets:0,balls:6,quotaBalls:6,superOver:false}));
  await new Promise(done=>setTimeout(done,45));assert(!a.sessions.has(finishing.id));assert(received.get(finishing.state.teams[0].ownerId)!.some(m=>m.type==='match'&&m.data.phase==='COMPLETE'));
  const table=(await a.req(`/api/tournaments/${t.id}`,host.token)).data.standings;assert.equal(table.find((r:any)=>r.teamId===finishing.state.winnerId).points,2);
  const leavingOwner=first.teams[0].ownerId,leavingIndex=owners.findIndex(o=>o.user.id===leavingOwner);sockets[leavingIndex].send(JSON.stringify({type:'leaveMatch'}));await new Promise(done=>setTimeout(done,30));assert.equal((await a.req(`/api/matches/${first.id}`,host.token)).data.connectionStatus,'waiting');assert(received.get(leavingOwner)!.some(m=>m.type==='matchLeft'));
  // The tournament subscription and socket remain usable after leaving the match.
  sockets[leavingIndex].send(JSON.stringify({type:'subscribe',tournamentId:t.id}));await new Promise(done=>setTimeout(done,20));assert(received.get(leavingOwner)!.some(m=>m.type==='tournament'));
  const before=structuredClone(a.sessions.get(first.id)!.state);for(const ws of sockets)ws.terminate();await a.close();a=await launch(db);
  assert.equal(a.sessions.size,0);const restored=(await a.req(`/api/matches/${first.id}`,host.token)).data;assert.equal(restored.connectionStatus,'paused');assert.equal(restored.phase,before.phase);assert.deepEqual(restored.ball,before.ball);assert.equal(restored.runs,before.runs);assert.equal(restored.sequence[bowlerId],0);
  const resumed=await a.req(`/api/tournaments/${t.id}/action`,host.token,{type:'startMatch',fixtureId:chosen[0].id});assert.equal(resumed.status,200);assert.equal(resumed.data.id,first.id);assert.deepEqual(resumed.data.ball,before.ball);
 }finally{for(const ws of sockets)ws.terminate();await a.close();rmSync(path,{recursive:true,force:true});}
});

test('server timer settles an actual bid into purchased roster and durable purse transaction',async()=>{
 const path=mkdtempSync(join(tmpdir(),'acpl-sale-')),db=join(path,'sale.db');let a=await launch(db,20);
 try{
  const x=await a.guest('SellerHost'),y=await a.guest('Bidder');const t=(await a.req('/api/tournaments',x.token,{name:'Sale',teamCount:2,auctionRules:{lotDurationMs:100,extensionMs:100}})).data;
  for(const owner of [x,y])assert.equal((await a.req(`/api/tournaments/${t.id}/join`,owner.token,{name:owner.user.name})).status,200);
  const action=(token:string,data:unknown)=>a.req(`/api/tournaments/${t.id}/action`,token,data);
  await action(x.token,{type:'startAuction'});await action(x.token,{type:'nominate',playerId:'player-1'});assert.equal((await action(y.token,{type:'bid',amount:100,requestId:'sale_request'})).status,200);
  await new Promise(done=>setTimeout(done,1120));const sold=(await a.req(`/api/tournaments/${t.id}`,y.token)).data;const buyer=sold.teams.find((team:any)=>team.ownerId===y.user.id);assert.equal(sold.auction.current.status,'SOLD');assert.equal(buyer.purse,11900);assert.deepEqual(buyer.roster,['player-1']);
  assert.equal((await action(x.token,{type:'nominate',playerId:'player-1'})).status,400);
  await a.close();a=await launch(db);const persisted=(await a.req(`/api/tournaments/${t.id}`,y.token)).data;assert.equal(persisted.auction.current.status,'SOLD');assert.equal(persisted.teams.find((team:any)=>team.id===buyer.id).purse,11900);
 }finally{await a.close();rmSync(path,{recursive:true,force:true});}
});

test('deployment capacity rejects unmeasured overload and invalid runtime configuration',()=>{
 for(const maxMatches of [0,6,NaN,Infinity,1.5])assert.throws(()=>createServer({dbPath:':memory:',maxMatches}),/capacity/);
 assert.throws(()=>createServer({dbPath:':memory:',graceMs:-1}),/grace/);
 assert.throws(()=>createServer({dbPath:':memory:',tickMs:0}),/interval/);
});
test('heartbeat removes a dead socket while a responsive owner stays connected',async()=>{
 const a=createServer({dbPath:':memory:',heartbeatMs:20});await new Promise<void>(done=>a.server.listen(0,'127.0.0.1',done));const address=a.server.address();assert(address&&typeof address==='object');const base=`http://127.0.0.1:${address.port}`;
 const {token}=await (await fetch(base+'/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Heartbeat QA'})})).json() as {token:string};
 const live=new WebSocket(base.replace('http','ws')+`/ws?token=${token}`),dead=new WebSocket(base.replace('http','ws')+`/ws?token=${token}`,{autoPong:false});
 try{await Promise.all([live,dead].map(ws=>new Promise<void>((done,fail)=>{ws.once('open',done);ws.once('error',fail);})));await new Promise<void>((done,fail)=>{const timeout=setTimeout(()=>fail(Error('Dead socket was not closed')),1000);dead.once('close',()=>{clearTimeout(timeout);done();});});assert.equal(live.readyState,WebSocket.OPEN);assert.equal(dead.readyState,WebSocket.CLOSED);}finally{live.terminate();dead.terminate();await a.close();}
});

test('new leagues enforce 120 crore purse and 20 crore purchase ceiling through HTTP',async()=>{
 const a=await launch();try{
  const x=await a.guest('BudgetHost'),y=await a.guest('BudgetRival');
  assert.equal((await a.req('/api/tournaments',x.token,{name:'Invalid purse',teamCount:2,purse:13000})).status,400);
  assert.equal((await a.req('/api/tournaments',x.token,{name:'Invalid cap',teamCount:2,auctionRules:{maxPlayerPrice:2001}})).status,400);
  const t=(await a.req('/api/tournaments',x.token,{name:'Crore league',teamCount:2})).data;
  assert.equal(t.currency,'INR_LAKH');assert(t.teams.every((team:any)=>team.purse===12000));assert.equal(t.auction.rules.maxPlayerPrice,2000);
  for(const owner of [x,y])await a.req(`/api/tournaments/${t.id}/join`,owner.token,{name:owner.user.name});
  const action=(token:string,data:unknown)=>a.req(`/api/tournaments/${t.id}/action`,token,data);
  await action(x.token,{type:'startAuction'});await action(x.token,{type:'nominate',playerId:'player-1'});
  assert.equal((await action(x.token,{type:'bid',amount:2001,requestId:'over_20crore'})).status,400);
  assert.equal((await action(x.token,{type:'bid',amount:2000,requestId:'exact20crore'})).status,200);
  assert.equal((await action(y.token,{type:'bid',amount:2100,requestId:'rival_over20'})).status,400);
  const actual=(await a.req(`/api/tournaments/${t.id}`,x.token)).data;assert.equal(actual.auction.current.highestBid,2000);assert.equal(actual.auction.current.bids.length,1);
 }finally{await a.close();}
});
