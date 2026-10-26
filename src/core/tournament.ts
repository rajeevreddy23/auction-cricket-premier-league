/** Deterministic competition rules. IDs, scores and lifecycle are server-owned. */
export type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'AUCTION' | 'SQUAD_VALIDATION' | 'FIXTURES_GENERATED' | 'LEAGUE_IN_PROGRESS' | 'LEAGUE_COMPLETED' | 'PLAYOFFS' | 'FINAL' | 'TOURNAMENT_COMPLETED';
export type FixtureFormat = 'single' | 'double' | 'ipl';
export type FixtureStage = 'LEAGUE' | 'Q1' | 'ELIMINATOR' | 'Q2' | 'FINAL';
export interface InningsRecord { teamId: string; runs: number; wickets: number; balls: number; quotaBalls: number }
export interface FixtureResult { id: string; winnerId: string | null; innings: InningsRecord[]; outcome: 'WIN' | 'TIE' | 'NO_RESULT'; superOverWinnerId?: string }
export interface Fixture { id: string; tournamentId: string; matchNumber: number; teamAId: string; teamBId: string; venue: string; round: number; wave: number; overs: number; stage: FixtureStage; status: 'PENDING' | 'LIVE' | 'COMPLETED'; scheduledStart: string | null; actualStart: string | null; matchServerId: string | null; result: FixtureResult | null }
export interface Standing { teamId: string; played: number; wins: number; losses: number; ties: number; noResults: number; points: number; runsScored: number; ballsFaced: number; runsConceded: number; ballsBowled: number; nrr: number; rank: number }
export type PlayoffSource = { type: 'rank'; rank: number } | { type: 'winner' | 'loser'; stage: FixtureStage };
export interface PlayoffNode { stage: FixtureStage; dependsOn: FixtureStage[]; sources: [PlayoffSource, PlayoffSource]; fixtureId: string | null }
export interface TournamentState { id: string; name: string; hostId: string; teamIds: string[]; overs: number; status: TournamentStatus; fixtures: Fixture[]; playoffs: PlayoffNode[]; championId: string | null; runnerUpId: string | null }
export interface ScheduleOptions { tournamentId?: string; overs?: number; concurrency?: number; venues?: string[]; startingAt?: string; matchMinutes?: number; restMinutes?: number }
const transitions: Record<TournamentStatus, TournamentStatus[]> = {
 DRAFT: ['REGISTRATION'], REGISTRATION: ['AUCTION'], AUCTION: ['SQUAD_VALIDATION'], SQUAD_VALIDATION: ['AUCTION', 'FIXTURES_GENERATED'], FIXTURES_GENERATED: ['LEAGUE_IN_PROGRESS'], LEAGUE_IN_PROGRESS: ['LEAGUE_COMPLETED'], LEAGUE_COMPLETED: ['PLAYOFFS', 'FINAL'], PLAYOFFS: ['FINAL'], FINAL: ['TOURNAMENT_COMPLETED'], TOURNAMENT_COMPLETED: []
};
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function integer(n: number, min: number, max: number, field: string) { assert(Number.isSafeInteger(n) && n >= min && n <= max, `Invalid ${field}`); }
export function createTournamentState(id: string, name: string, hostId: string, teamIds: string[], overs = 20): TournamentState {
 assert(id && hostId && name.trim(), 'Tournament identity required');
 assert(teamIds.length >= 2 && teamIds.length <= 32 && new Set(teamIds).size === teamIds.length, 'Requires 2–32 unique teams'); integer(overs, 1, 20, 'overs');
 return { id, name, hostId, teamIds: [...teamIds], overs, status: 'DRAFT', fixtures: [], playoffs: [], championId: null, runnerUpId: null };
}
export function transitionTournament(t: TournamentState, next: TournamentStatus): void {
 assert(transitions[t.status].includes(next), `Invalid tournament transition ${t.status} -> ${next}`);
 if (next === 'LEAGUE_IN_PROGRESS') assert(t.fixtures.some(f => f.stage === 'LEAGUE'), 'Fixtures required');
 if (next === 'LEAGUE_COMPLETED') assert(t.fixtures.some(f => f.stage === 'LEAGUE') && t.fixtures.filter(f => f.stage === 'LEAGUE').every(f => f.status === 'COMPLETED'), 'League has unfinished matches');
 if (next === 'FIXTURES_GENERATED') assert(t.fixtures.length > 0, 'Fixtures required');
 if (next === 'FINAL') assert(t.fixtures.some(f => f.stage === 'FINAL'), 'Finalists not confirmed');
 if (next === 'TOURNAMENT_COMPLETED') assert(!!t.championId, 'Champion not confirmed');
 t.status = next;
}
/** Orient the match multigraph using an Euler tour. Home/away imbalance is <= 1. */
function orient(pairs: [string, string][], ids: string[]): [string, string][] {
 const edges = pairs.map(([a,b]) => ({a,b,real:true})); const dummy = '\0dummy';
 for (const id of ids) if (pairs.filter(p => p.includes(id)).length % 2) edges.push({a:id,b:dummy,real:false});
 const adjacency = new Map<string, number[]>(); edges.forEach((e,i) => { for (const id of [e.a,e.b]) { if (!adjacency.has(id)) adjacency.set(id,[]); adjacency.get(id)!.push(i); }});
 const used = new Set<number>(); const oriented: [string,string][] = [];
 for (const id of adjacency.keys()) { const stack = [id]; while (stack.length) { const current = stack[stack.length-1]; const list=adjacency.get(current)!; while(list.length && used.has(list[list.length-1])) list.pop(); if (!list.length) {stack.pop();continue;} const i=list.pop()!; if(used.has(i)) continue; used.add(i); const edge=edges[i]; const other=edge.a===current?edge.b:edge.a; if(edge.real) oriented.push([current,other]); stack.push(other); }}
 return oriented;
}
export function generateFixtures(teamIds: string[], format: FixtureFormat, options: ScheduleOptions = {}): Fixture[] {
 assert(teamIds.length >= 2 && teamIds.length <= 32 && new Set(teamIds).size === teamIds.length, 'Requires 2–32 unique teams');
 assert(['single','double','ipl'].includes(format), 'Unsupported schedule format');
 const overs=options.overs??20, concurrency=options.concurrency??Math.floor(teamIds.length/2); integer(overs,1,20,'overs'); integer(concurrency,1,16,'concurrency');
 const pairs: [string,string][]=[];
 for(let i=0;i<teamIds.length;i++) for(let j=i+1;j<teamIds.length;j++) {
  pairs.push([teamIds[i],teamIds[j]]);
  if(format==='double' || (format==='ipl' && ((i<5)===(j<5) || (i<5 && j===i+5)))) pairs.push([teamIds[i],teamIds[j]]);
 }
 if(format==='ipl') assert(teamIds.length===10,'IPL 70-match format requires exactly ten teams');
 const pending=orient(pairs,teamIds), fixtures:Fixture[]=[]; let wave=0;
 const venues=options.venues??Array.from({length:concurrency},(_,i)=>`Premier Oval ${i+1}`); assert(venues.length>0 && venues.every(v=>v.trim()),'At least one venue required');
 const start=options.startingAt===undefined?null:Date.parse(options.startingAt); assert(start===null || Number.isFinite(start),'Invalid schedule start');
 const minutes=options.matchMinutes??120,rest=options.restMinutes??0; integer(minutes,1,1440,'match minutes'); integer(rest,0,10080,'rest minutes');
 while(pending.length) { const occupied=new Set<string>(); let count=0; for(let i=0;i<pending.length && count<concurrency && count<venues.length;) { const [a,b]=pending[i]; if(occupied.has(a)||occupied.has(b)){i++;continue;} pending.splice(i,1); occupied.add(a);occupied.add(b);count++;
  fixtures.push({id:`${options.tournamentId??'tournament'}-league-${fixtures.length+1}`,tournamentId:options.tournamentId??'tournament',matchNumber:fixtures.length+1,teamAId:a,teamBId:b,venue:venues[count-1],round:wave+1,wave,overs,stage:'LEAGUE',status:'PENDING',scheduledStart:start===null?null:new Date(start+wave*(minutes+rest)*60000).toISOString(),actualStart:null,matchServerId:null,result:null});
 } wave++; }
 return fixtures;
}
export function createLeagueFixtures(t: TournamentState, format: FixtureFormat, options: ScheduleOptions = {}): Fixture[] {
 assert(t.status==='SQUAD_VALIDATION','Squads must be validated before scheduling'); assert(t.fixtures.length===0,'Schedule already exists');
 const fixtures=generateFixtures(t.teamIds,format,{...options,tournamentId:t.id,overs:t.overs}); t.fixtures=fixtures; transitionTournament(t,'FIXTURES_GENERATED');return fixtures;
}
export function getStandings(t: Pick<TournamentState,'teamIds'|'fixtures'>): Standing[] {
 const rows=new Map(t.teamIds.map(teamId=>[teamId,{teamId,played:0,wins:0,losses:0,ties:0,noResults:0,points:0,runsScored:0,ballsFaced:0,runsConceded:0,ballsBowled:0,nrr:0,rank:0}]));
 for(const f of t.fixtures) { if(f.stage!=='LEAGUE'||!f.result||f.status!=='COMPLETED')continue;const a=rows.get(f.teamAId)!,b=rows.get(f.teamBId)!,r=f.result;a.played++;b.played++;
  if(r.outcome==='NO_RESULT'){a.noResults++;b.noResults++;a.points++;b.points++;continue;}
  if(r.outcome==='TIE'){a.ties++;b.ties++;a.points++;b.points++;}else{ const win=r.winnerId===a.teamId?a:b,loss=win===a?b:a;win.wins++;win.points+=2;loss.losses++; }
  for(const innings of r.innings) { const batting=rows.get(innings.teamId)!,bowling=batting===a?b:a;const balls=innings.wickets===10?innings.quotaBalls:innings.balls;batting.runsScored+=innings.runs;batting.ballsFaced+=balls;bowling.runsConceded+=innings.runs;bowling.ballsBowled+=balls; }
 }
 const result=[...rows.values()];for(const row of result)row.nrr=(row.ballsFaced?row.runsScored*6/row.ballsFaced:0)-(row.ballsBowled?row.runsConceded*6/row.ballsBowled:0);
 result.sort((a,b)=>b.points-a.points||b.wins-a.wins||b.nrr-a.nrr||a.teamId.localeCompare(b.teamId));result.forEach((r,i)=>r.rank=i+1);return result;
}
function validateResult(f: Fixture, result: FixtureResult) {
 assert(result.id && ['WIN','TIE','NO_RESULT'].includes(result.outcome),'Invalid result identity/outcome');
 assert(result.winnerId===null || [f.teamAId,f.teamBId].includes(result.winnerId),'Invalid winner');
 if(result.outcome==='NO_RESULT'){assert(result.winnerId===null,'No-result cannot declare winner');return;}
 assert(result.innings.length===2 && new Set(result.innings.map(i=>i.teamId)).size===2,'Two unique innings required');
 for(const i of result.innings){assert([f.teamAId,f.teamBId].includes(i.teamId),'Invalid innings team');integer(i.runs,0,100000,'runs');integer(i.wickets,0,10,'wickets');integer(i.quotaBalls,1,f.overs*6,'innings quota');integer(i.balls,0,i.quotaBalls,'legal balls');}
 const [a,b]=result.innings;
 if(result.outcome==='WIN'){assert(result.winnerId!==null,'Winner required');if(a.runs!==b.runs)assert(result.winnerId===(a.runs>b.runs?a.teamId:b.teamId),'Winner disagrees with innings');else assert(result.superOverWinnerId===result.winnerId,'Tied innings require verified Super Over winner');}
 else assert(result.winnerId===null && a.runs===b.runs,'Tie requires equal scores and no winner');
}
export function commitFixtureResult(t: TournamentState, fixtureId: string, result: FixtureResult): boolean {
 const f=t.fixtures.find(f=>f.id===fixtureId);assert(f,'Fixture not found');
 if(f.result){assert(JSON.stringify(f.result)===JSON.stringify(result),'Conflicting result replay');return false;}
 assert(f.status==='LIVE','Only live matches can finish');
 assert(['LEAGUE_IN_PROGRESS','PLAYOFFS','FINAL'].includes(t.status),'Tournament is not playing'); validateResult(f,result);
 if(f.stage!=='LEAGUE')assert(result.outcome==='WIN','Playoff requires a decisive result; apply published abandonment policy externally');
 f.result=structuredClone(result);f.status='COMPLETED';
 if(f.stage==='LEAGUE' && t.fixtures.filter(f=>f.stage==='LEAGUE').every(f=>f.status==='COMPLETED'))transitionTournament(t,'LEAGUE_COMPLETED');
 if(f.stage==='FINAL'){t.championId=result.winnerId;t.runnerUpId=f.teamAId===result.winnerId?f.teamBId:f.teamAId;transitionTournament(t,'TOURNAMENT_COMPLETED');}
 return true;
}
export function startFixture(t: TournamentState, fixtureId: string, workerId='local', now=new Date().toISOString()): Fixture {
 const f=t.fixtures.find(f=>f.id===fixtureId);assert(f && f.status==='PENDING','Pending fixture required');
 if(t.status==='FIXTURES_GENERATED')transitionTournament(t,'LEAGUE_IN_PROGRESS');
 assert((f.stage==='LEAGUE'&&t.status==='LEAGUE_IN_PROGRESS') || (f.stage!=='LEAGUE'&&['PLAYOFFS','FINAL'].includes(t.status)),'Fixture cannot start in this phase');
 assert(!t.fixtures.some(other=>other.status==='LIVE'&&[other.teamAId,other.teamBId].some(id=>id===f.teamAId||id===f.teamBId)),'Team already playing');
 f.status='LIVE';f.actualStart=now;f.matchServerId=workerId;return f;
}
/** Explicit graph; only ready nodes become fixtures, preventing premature finals. */
export function advancePlayoffs(t: TournamentState): PlayoffNode[] {
 assert(['LEAGUE_COMPLETED','PLAYOFFS','FINAL','TOURNAMENT_COMPLETED'].includes(t.status),'League is incomplete');
 if(t.status==='TOURNAMENT_COMPLETED')return t.playoffs;
 const rank=(n:number):PlayoffSource=>({type:'rank',rank:n}),win=(stage:FixtureStage):PlayoffSource=>({type:'winner',stage}),loss=(stage:FixtureStage):PlayoffSource=>({type:'loser',stage});
 if(!t.playoffs.length){
  if(t.teamIds.length===2)t.playoffs=[{stage:'FINAL',dependsOn:[],sources:[rank(1),rank(2)],fixtureId:null}];
  else if(t.teamIds.length===3)t.playoffs=[{stage:'ELIMINATOR',dependsOn:[],sources:[rank(2),rank(3)],fixtureId:null},{stage:'FINAL',dependsOn:['ELIMINATOR'],sources:[rank(1),win('ELIMINATOR')],fixtureId:null}];
  else t.playoffs=[{stage:'Q1',dependsOn:[],sources:[rank(1),rank(2)],fixtureId:null},{stage:'ELIMINATOR',dependsOn:[],sources:[rank(3),rank(4)],fixtureId:null},{stage:'Q2',dependsOn:['Q1','ELIMINATOR'],sources:[loss('Q1'),win('ELIMINATOR')],fixtureId:null},{stage:'FINAL',dependsOn:['Q1','Q2'],sources:[win('Q1'),win('Q2')],fixtureId:null}];
 }
 const standings=getStandings(t);
 function resolve(source: PlayoffSource): string|null {if(source.type==='rank')return standings[source.rank-1]?.teamId??null;const fixture=t.fixtures.find(f=>f.stage===source.stage);if(!fixture?.result?.winnerId)return null;return source.type==='winner'?fixture.result.winnerId:(fixture.teamAId===fixture.result.winnerId?fixture.teamBId:fixture.teamAId);}
 for(const node of t.playoffs){if(node.fixtureId)continue;if(!node.dependsOn.every(stage=>t.fixtures.some(f=>f.stage===stage&&f.status==='COMPLETED')))continue;const a=resolve(node.sources[0]),b=resolve(node.sources[1]);if(!a||!b)continue;assert(a!==b,'Playoff participants must differ');const id=`${t.id}-${node.stage.toLowerCase()}`;node.fixtureId=id;t.fixtures.push({id,tournamentId:t.id,matchNumber:t.fixtures.length+1,teamAId:a,teamBId:b,venue:'Championship Oval',round:Math.max(...t.fixtures.map(f=>f.round))+1,wave:Math.max(...t.fixtures.map(f=>f.wave))+1,overs:t.overs,stage:node.stage,status:'PENDING',scheduledStart:null,actualStart:null,matchServerId:null,result:null});}
 if(t.fixtures.some(f=>f.stage==='FINAL')){if(t.status!=='FINAL')transitionTournament(t,'FINAL');}else if(t.status==='LEAGUE_COMPLETED')transitionTournament(t,'PLAYOFFS');return t.playoffs;
}
export function rescheduleFixture(t: TournamentState, fixtureId: string, scheduledStart: string, durationMinutes=120):void {
 const f=t.fixtures.find(f=>f.id===fixtureId);assert(f?.status==='PENDING','Only pending fixtures may be rescheduled');const time=Date.parse(scheduledStart);assert(Number.isFinite(time),'Invalid start time');integer(durationMinutes,1,1440,'duration');assert(!t.fixtures.some(other=>other.id!==f.id&&other.scheduledStart!==null&&Math.abs(Date.parse(other.scheduledStart)-time)<durationMinutes*60000&&([other.teamAId,other.teamBId].some(id=>id===f.teamAId||id===f.teamBId)||other.venue===f.venue)),'Schedule overlap');f.scheduledStart=new Date(time).toISOString();
}
