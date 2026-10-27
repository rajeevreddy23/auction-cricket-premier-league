/** Real HTTP auction + socket inputs + wall-clock server physics; never injects game state. */
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WebSocket} from 'ws';
import {createServer} from '../src/server/index.ts';
import type {GameInput,MatchState} from '../src/core/cricket.ts';

const dir=mkdtempSync(join(tmpdir(),'acpl-online-'));
let app=createServer({dbPath:join(dir,'acceptance.db'),tickMs:1000/60});
const sockets:WebSocket[]=[];
async function listen(){await new Promise<void>(done=>app.server.listen(0,'127.0.0.1',done));const address=app.server.address();assert(address&&typeof address==='object');return `http://127.0.0.1:${address.port}`;}
let base=await listen();
async function request(path:string,token?:string,data?:unknown){const r=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data)});const result=await r.json() as any;assert.ok(r.ok,`${path}: ${result.error??r.status}`);return result;}
const sleep=(ms:number)=>new Promise(done=>setTimeout(done,ms));
async function setup(label:string){
 const owners=await Promise.all([0,1].map(i=>request('/api/guest',undefined,{name:`${label} owner ${i}`})));
 const host=owners[0];let t=await request('/api/tournaments',host.token,{name:`${label} Online League`,teamCount:2,overs:1,auctionRules:{lotDurationMs:100,extensionMs:100}});
 for(const [i,owner] of owners.entries())t=await request(`/api/tournaments/${t.id}/join`,owner.token,{name:`${label} XI ${i+1}`});
 const action=(data:unknown,owner=host)=>request(`/api/tournaments/${t.id}/action`,owner.token,data);
 t=await action({type:'startAuction'});
 for(let i=0;i<22;i++){
  const player=t.players[i],owner=owners[Math.floor(i/11)];
  t=await action({type:'nominate',playerId:player.id});
  t=await action({type:'bid',amount:player.basePrice,requestId:`${label}-purchase-${i}`},owner);
  await sleep(Math.max(0,t.auction.current.deadline-Date.now()+5));
  // The server clock may already have settled it; never attempt a second settlement.
  t=await request(`/api/tournaments/${t.id}`,host.token);
  if(t.auction.current.status==='OPEN')t=await action({type:'closeLot'});
 }
 t=await action({type:'finishAuction'});
 for(const owner of owners){const team=t.teams.find((team:any)=>team.ownerId===owner.user.id);const keeper=team.roster.find((id:string)=>t.players.find((p:any)=>p.id===id).role==='WICKETKEEPER');t=await action({type:'selectXI',playerIds:team.roster,captainId:team.roster[1],keeperId:keeper},owner);}
 t=await action({type:'fixtures',format:'single'});
 const connections=new Map<string,WebSocket>();
 for(const owner of owners){const ws=new WebSocket(base.replace('http','ws')+`/ws?token=${owner.token}`);sockets.push(ws);await new Promise<void>((done,fail)=>{ws.once('open',done);ws.once('error',fail);});connections.set(owner.user.id,ws);}
 return {t,host,owners,action,connections};
}
type Bundle=Awaited<ReturnType<typeof setup>>;
async function play(bundle:Bundle,fixtureId:string){
 const initial=await bundle.action({type:'startMatch',fixtureId});
 for(const team of initial.teams){const purchased=bundle.t.teams.find((t:any)=>t.id===team.id);assert.deepEqual(team.players.map((p:any)=>p.id),purchased.xi);}
 const sent=new Set<string>(),sequences=new Map<string,number>();
 return await new Promise<MatchState>((done,fail)=>{
  const timeout=setTimeout(()=>finish(Error(`Online match ${initial.id} exceeded 90 seconds`)),90000);
  function finish(error?:Error,state?:MatchState){clearTimeout(timeout);for(const ws of bundle.connections.values())ws.off('message',message);error?fail(error):done(state!);}
  function send(s:MatchState,owner:string,key:string,action:GameInput){if(sent.has(key))return;sent.add(key);const sequence=Math.max(sequences.get(owner)??-1,s.sequence[owner]??-1)+1;sequences.set(owner,sequence);bundle.connections.get(owner)!.send(JSON.stringify({type:'input',matchId:s.id,sequence,action}));}
  function message(raw:Buffer){try{
   const msg=JSON.parse(raw.toString());if(msg.type==='error')throw Error(msg.data.message);if(msg.type!=='match'||msg.data.id!==initial.id)return;
   const s=msg.data as MatchState&{connectionStatus:string};
   assert(s.teams.every(t=>bundle.connections.has(t.ownerId)),'Cross-tournament owner leak');
   if(s.phase==='COMPLETE'){assert(s.winnerId);assert.equal(s.inningsScores.length,2);assert.equal(s.inningsScores[0].runs,0);assert(s.inningsScores[1].runs>0);finish(undefined,s);return;}
   if(s.connectionStatus!=='connected')return;
   const key=`${s.innings}:${s.delivery}`;
   if(s.phase==='READY')send(s,s.teams[1-s.batting].ownerId,`bowl:${key}`,{type:'bowl',speed:25,targetX:.5,spin:0});
   else if(s.phase==='DELIVERY'&&s.innings===2&&s.ball.z>5.5&&!s.swing)send(s,s.teams[s.batting].ownerId,`shot:${key}`,{type:'shot',direction:0,power:1,loft:true});
   else if(s.phase==='DEAD'||s.phase==='INNINGS_BREAK')send(s,s.teams[0].ownerId,`next:${key}`,{type:'next'});
  }catch(error){finish(error as Error);}}
  for(const ws of bundle.connections.values()){ws.on('message',message);ws.send(JSON.stringify({type:'joinMatch',matchId:initial.id}));}
 });
}
try{
 const bundles=await Promise.all([setup('Coastal'),setup('Highland')]);
 const league=await Promise.all(bundles.map(b=>play(b,b.t.fixtures[0].id)));
 const finals:{id:string}[]=[];
 for(const [i,b] of bundles.entries()){
  const t=await request(`/api/tournaments/${b.t.id}`,b.host.token);assert.equal(t.status,'FINAL');assert.equal(t.standings.reduce((n:number,r:any)=>n+r.points,0),2);assert.equal(t.fixtures[0].result.winnerId,league[i].winnerId);finals.push(t.fixtures.find((f:any)=>f.stage==='FINAL'));
 }
 const results=await Promise.all(bundles.map((b,i)=>play(b,finals[i].id)));
 const champions=[];
 for(const [i,b] of bundles.entries()){const t=await request(`/api/tournaments/${b.t.id}`,b.host.token);assert.equal(t.status,'TOURNAMENT_COMPLETED');assert.equal(t.championId,results[i].winnerId);assert.equal(t.fixtures.filter((f:any)=>f.status==='COMPLETED').length,2);champions.push(t.championId);}
 for(const ws of sockets)ws.terminate();await app.close();app=createServer({dbPath:join(dir,'acceptance.db')});base=await listen();
 for(const [i,b] of bundles.entries()){const t=await request(`/api/tournaments/${b.t.id}`,b.host.token);assert.equal(t.championId,champions[i]);assert.equal(t.status,'TOURNAMENT_COMPLETED');}
 console.log(JSON.stringify({tournaments:2,authenticatedOwners:4,realAuctionPurchases:44,concurrentMatches:2,completedSocketMatches:4,champions:2,restartPreserved:true,injectedMatchState:false},null,2));
}finally{for(const ws of sockets)ws.terminate();await app.close();rmSync(dir,{recursive:true,force:true});}
