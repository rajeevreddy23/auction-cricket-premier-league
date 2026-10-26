/** Acceptance evidence from deterministic physical-engine inputs.
 * This exercises domain integration, not human 3D controls, WebGL, network load,
 * authenticated HTTP sessions, native devices or an actual process restart. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAuction,createPlayers,createTeam,nominate,placeBid,closeLot,selectXI,validateSquad} from '../src/core/auction.ts';
import type {Player,Team} from '../src/core/auction.ts';
import {createTournamentState,transitionTournament,createLeagueFixtures,startFixture,commitFixtureResult,getStandings,advancePlayoffs} from '../src/core/tournament.ts';
import type {TournamentState,Fixture,FixtureResult} from '../src/core/tournament.ts';
import {createMatch,applyInput,stepMatch} from '../src/core/cricket.ts';
import type {MatchState} from '../src/core/cricket.ts';
interface TournamentBundle {tournament:TournamentState;teams:Team[];players:Player[];auction:ReturnType<typeof createAuction>}
function createTenOwnerTournament(id:string):TournamentBundle {
 const players=createPlayers();
 const teams=Array.from({length:10},(_,i)=>createTeam(`${id}-team-${i}`,`Original Franchise ${i+1}`,`${id}-owner-${i}`,12000));
 const auction=createAuction({lotDurationMs:1000,extensionMs:500});
 const tournament=createTournamentState(id,'Engine-input Acceptance League',`${id}-owner-0`,teams.map(t=>t.id),1);
 transitionTournament(tournament,'REGISTRATION');transitionTournament(tournament,'AUCTION');
 let now=100000;
 // All 110 squad members are bought through actual auction domain actions.
 for(let ti=0;ti<10;ti++)for(let pi=0;pi<11;pi++){
  const player=players[ti*11+pi];
  nominate(auction,players,teams,player.id,now);
  placeBid(auction,players,teams,teams[ti].id,player.basePrice,`${id}-bid-${ti}-${pi}`,now+10);
  closeLot(auction,players,teams,now+1000);now+=1001;
 }
 assert.equal(auction.lots.filter(l=>l.status==='SOLD').length,110);
 const purchased=teams.flatMap(t=>t.roster);assert.equal(new Set(purchased).size,110);
 for(const team of teams){
  assert.equal(team.roster.length,11);
  const keeper=team.roster.find(id=>players.find(p=>p.id===id)!.role==='WICKETKEEPER')!;
  selectXI(team,players,team.roster,team.roster[1],keeper);
  assert.deepEqual(validateSquad(team,players),[]);assert.equal(team.ready,true);
  const paid=team.roster.reduce((sum,id)=>sum+players.find(p=>p.id===id)!.basePrice,0);
  assert.equal(team.purse,12000-paid);
 }
 transitionTournament(tournament,'SQUAD_VALIDATION');
 createLeagueFixtures(tournament,'ipl',{concurrency:5});
 assert.equal(tournament.fixtures.length,70);
 for(const team of teams)assert.equal(tournament.fixtures.filter(f=>f.teamAId===team.id||f.teamBId===team.id).length,14);
 return {tournament,teams,players,auction};
}
function beginMatch(b:Pick<TournamentBundle,'tournament'|'teams'|'players'>,f:Fixture):MatchState {
 startFixture(b.tournament,f.id,`worker-${f.id}`,'2026-10-26T08:00:00.000Z');
 const gameTeams=[f.teamAId,f.teamBId].map(id=>{
  const team=b.teams.find(t=>t.id===id)!;
  const selected=team.xi.map(playerId=>{assert(team.roster.includes(playerId));return b.players.find(p=>p.id===playerId)!;});
  return {id:team.id,name:team.name,ownerId:team.ownerId,players:selected};
 });
 return createMatch(f.id,gameTeams[0],gameTeams[1],1);
}
function inputTick(s:MatchState):void {
 const nextSequence=()=>Math.max(-1,...Object.values(s.sequence))+1;
 if(s.phase==='READY')applyInput(s,s.teams[1-s.batting].ownerId,nextSequence(),{type:'bowl',targetX:0,speed:24,spin:0});
 else if(s.phase==='DELIVERY' && s.innings===1 && s.ball.z>5.5 && !s.swing)
  applyInput(s,s.teams[s.batting].ownerId,nextSequence(),{type:'shot',direction:0,power:1,loft:true});
 else if(s.phase==='DEAD'||s.phase==='INNINGS_BREAK')applyInput(s,s.teams[0].ownerId,nextSequence(),{type:'next'});
 stepMatch(s,1/60);
}
function completeInterleaved(states:MatchState[]):void {
 let ticks=0;
 while(states.some(s=>s.phase!=='COMPLETE')){
  for(const state of states)if(state.phase!=='COMPLETE')inputTick(state);
  assert(++ticks<10000,'Input-driven physical match failed to complete within bounded ticks');
 }
 for(const s of states){
  assert.equal(s.inningsScores.length,2);assert(s.inningsScores[0].runs>0);
  assert.equal(s.inningsScores[1].runs,0);assert.equal(s.winnerId,s.teams[0].id);
  assert(s.events.some(e=>e.type==='contact'));assert(s.events.some(e=>e.text.includes('SIX!')));
  for(const innings of s.inningsScores)assert.equal(innings.balls,6);
 }
}
function resultFromEngine(s:MatchState):FixtureResult {
 assert.equal(s.phase,'COMPLETE');
 return {id:`verified-${s.id}`,winnerId:s.winnerId,outcome:'WIN',innings:s.inningsScores.map(i=>({teamId:i.teamId,runs:i.runs,wickets:i.wickets,balls:i.balls,quotaBalls:i.quotaBalls}))};
}
function commitGames(b:TournamentBundle,games:MatchState[]):void {
 for(const game of games){const result=resultFromEngine(game);assert.equal(commitFixtureResult(b.tournament,game.id,result),true);assert.equal(commitFixtureResult(b.tournament,game.id,result),false);}
}
function verifyAggregateStandings(t:TournamentState):void {
 const standings=getStandings(t);assert.equal(standings.length,10);
 assert.equal(standings.reduce((n,s)=>n+s.played,0),140);
 assert.equal(standings.reduce((n,s)=>n+s.points,0),140);
 for(const row of standings){
  assert.equal(row.played,14);assert.equal(row.points,row.wins*2);
  let runs=0,conceded=0,balls=0,bowled=0;
  for(const f of t.fixtures.filter(f=>f.stage==='LEAGUE'&&(f.teamAId===row.teamId||f.teamBId===row.teamId)))
   for(const i of f.result!.innings){const effective=i.wickets===10?i.quotaBalls:i.balls;
    if(i.teamId===row.teamId){runs+=i.runs;balls+=effective;}else{conceded+=i.runs;bowled+=effective;}}
  assert.equal(row.runsScored,runs);assert.equal(row.runsConceded,conceded);
  assert.equal(row.nrr,runs*6/balls-conceded*6/bowled);
 }
}
function completeLeague(b:TournamentBundle):void {
 const first=b.tournament.fixtures.filter(f=>f.wave===0);
 assert.equal(first.length,5);
 const games=first.map(f=>beginMatch(b,f));
 assert.equal(new Set(games.flatMap(g=>g.teams.map(t=>t.ownerId))).size,10);
 // Physical boundary in one live match must not touch the other four matches.
 const otherStates=games.slice(1).map(g=>JSON.stringify(g));
 let steps=0;while(games[0].runs===0){inputTick(games[0]);assert(++steps<1000);}
 assert.equal(games[0].runs,6);
 games.slice(1).forEach((g,i)=>assert.equal(JSON.stringify(g),otherStates[i]));
 completeInterleaved(games);commitGames(b,games);
 const waves=[...new Set(b.tournament.fixtures.filter(f=>f.stage==='LEAGUE'&&f.status==='PENDING').map(f=>f.wave))];
 for(const wave of waves){
  const fixtures=b.tournament.fixtures.filter(f=>f.stage==='LEAGUE'&&f.status==='PENDING'&&f.wave===wave);
  assert(fixtures.length<=5);assert.equal(new Set(fixtures.flatMap(f=>[f.teamAId,f.teamBId])).size,fixtures.length*2);
  const active=fixtures.map(f=>beginMatch(b,f));completeInterleaved(active);commitGames(b,active);
 }
 assert.equal(b.tournament.status,'LEAGUE_COMPLETED');verifyAggregateStandings(b.tournament);
}
function completePlayoffs(b:TournamentBundle):void {
 advancePlayoffs(b.tournament);
 assert.equal(b.tournament.status,'PLAYOFFS');
 assert.deepEqual(b.tournament.fixtures.filter(f=>f.stage!=='LEAGUE').map(f=>f.stage),['Q1','ELIMINATOR']);
 assert(!b.tournament.fixtures.some(f=>f.stage==='FINAL'||f.stage==='Q2'));
 const ranked=getStandings(b.tournament);
 const q1=b.tournament.fixtures.find(f=>f.stage==='Q1')!,eliminator=b.tournament.fixtures.find(f=>f.stage==='ELIMINATOR')!;
 assert.deepEqual([q1.teamAId,q1.teamBId],[ranked[0].teamId,ranked[1].teamId]);
 assert.deepEqual([eliminator.teamAId,eliminator.teamBId],[ranked[2].teamId,ranked[3].teamId]);
 const pair=[q1,eliminator].map(f=>beginMatch(b,f));completeInterleaved(pair);
 commitGames(b,[pair[0]]);advancePlayoffs(b.tournament);
 assert(!b.tournament.fixtures.some(f=>f.stage==='Q2'));
 commitGames(b,[pair[1]]);advancePlayoffs(b.tournament);
 const q2=b.tournament.fixtures.find(f=>f.stage==='Q2')!;
 assert.deepEqual([q2.teamAId,q2.teamBId],[q1.teamBId,eliminator.teamAId]);
 assert(!b.tournament.fixtures.some(f=>f.stage==='FINAL'));
 const q2game=beginMatch(b,q2);completeInterleaved([q2game]);commitGames(b,[q2game]);advancePlayoffs(b.tournament);
 const final=b.tournament.fixtures.find(f=>f.stage==='FINAL')!;
 assert.equal(b.tournament.status,'FINAL');
 assert.deepEqual([final.teamAId,final.teamBId],[q1.teamAId,q2.teamAId]);
 assert.notEqual(final.teamAId,final.teamBId);
 const finalGame=beginMatch(b,final);completeInterleaved([finalGame]);commitGames(b,[finalGame]);
 assert.equal(b.tournament.status,'TOURNAMENT_COMPLETED');assert.equal(b.tournament.championId,finalGame.winnerId);
 assert.equal(b.tournament.runnerUpId,final.teamBId);assert.equal(b.tournament.fixtures.length,74);
 // Serialization is a domain checkpoint/reload test, explicitly not service restart evidence.
 const restored=JSON.parse(JSON.stringify(b.tournament)) as TournamentState;
 assert.deepEqual(getStandings(restored),getStandings(b.tournament));
 assert.equal(restored.championId,b.tournament.championId);
 assert.deepEqual(restored.fixtures.map(f=>f.result),b.tournament.fixtures.map(f=>f.result));
 advancePlayoffs(restored);assert.equal(restored.fixtures.length,74);
}
test('deterministic engine-input acceptance: ten auction owners → five physical sessions → 70 league matches → playoffs → champion',()=>{
 const b=createTenOwnerTournament('acceptance-a');completeLeague(b);completePlayoffs(b);
});
test('two complete tournaments preserve roster, physics, standings and champion isolation',()=>{
 const a=createTenOwnerTournament('isolation-a'),b=createTenOwnerTournament('isolation-b');
 const untouchedB=JSON.stringify(b);
 completeLeague(a);completePlayoffs(a);assert.equal(JSON.stringify(b),untouchedB);
 const completedA=JSON.stringify(a);
 completeLeague(b);completePlayoffs(b);assert.equal(JSON.stringify(a),completedA);
 assert.notEqual(a.tournament.championId,b.tournament.championId);
 const persistedA=JSON.parse(completedA) as TournamentBundle;
 assert.deepEqual(persistedA.teams.map(t=>t.roster),a.teams.map(t=>t.roster));
 assert.deepEqual(getStandings(persistedA.tournament),getStandings(a.tournament));
});
