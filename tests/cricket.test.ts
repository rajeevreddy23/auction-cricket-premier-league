import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,applyInput,stepMatch} from '../src/core/cricket.ts';
import type {MatchTeam,MatchState,GameInput} from '../src/core/cricket.ts';
function team(id:string,power=90):MatchTeam{return {id,name:id,ownerId:id,players:Array.from({length:11},(_,i)=>({id:`${id}-${i}`,name:`${id} Player ${i}`,batting:80,bowling:80,power,timing:90,accuracy:100,stamina:80,role:i<5?'batter':'bowler'}))};}
function match(power=90){return createMatch('match',team('a',power),team('b'),1);}
function input(s:MatchState,user:string,action:GameInput){applyInput(s,user,(s.sequence[user]??-1)+1,action);}
function tickUntil(s:MatchState,predicate:(s:MatchState)=>boolean,max=2400){for(let i=0;i<max&&!predicate(s);i++)stepMatch(s,1/60);assert.ok(predicate(s),`Tick limit reached in ${s.phase}: ${s.lastShot}`);}
function bowl(s:MatchState,speed=25,targetX=0){input(s,s.teams[1-s.batting].ownerId,{type:'bowl',speed,targetX,spin:0});}
function finishBall(s:MatchState){tickUntil(s,x=>['DEAD','INNINGS_BREAK','COMPLETE'].includes(x.phase));}
function hit(s:MatchState,direction=0,power=1,loft=true){bowl(s);tickUntil(s,x=>x.ball.z>5.4);input(s,s.teams[s.batting].ownerId,{type:'shot',direction,power,loft});tickUntil(s,x=>x.phase==='IN_PLAY');}
function next(s:MatchState){input(s,s.teams[0].ownerId,{type:'next'});}
function completeByInputs(s:MatchState,hitInnings:(n:number)=>boolean){let ticks=0,swung=-1;while(s.phase!=='COMPLETE'&&ticks++<30000){if(s.phase==='READY')bowl(s,24);else if(s.phase==='DELIVERY'&&hitInnings(s.innings)&&s.ball.z>5.5&&swung!==s.delivery){input(s,s.teams[s.batting].ownerId,{type:'shot',direction:0,power:1,loft:true});swung=s.delivery;}else if(s.phase==='DEAD'||s.phase==='INNINGS_BREAK')next(s);stepMatch(s,1/60);}assert.equal(s.phase,'COMPLETE');return ticks;}
test('requires independent owners, eleven unique squad players and supported overs',()=>{const a=team('a'),b=team('b');assert.throws(()=>createMatch('x',a,a));assert.throws(()=>createMatch('x',a,{...b,ownerId:a.ownerId}));assert.throws(()=>createMatch('x',a,{...b,players:b.players.slice(0,10)}));assert.throws(()=>createMatch('x',a,{...b,players:Array(11).fill(b.players[0])}));for(const n of [0,21,NaN,1.5])assert.throws(()=>createMatch('x',a,b,n));});
test('owns a cloned roster: caller mutation cannot change purchased match identities',()=>{const a=team('a'),s=createMatch('x',a,team('b'));a.players[0].name='Changed';assert.notEqual(s.teams[0].players[0].name,'Changed');});
test('only valid participant and bowling owner can release ball; failed input has no effects',()=>{const s=match(),before=JSON.stringify(s);assert.throws(()=>applyInput(s,'intruder',0,{type:'bowl',targetX:0,speed:25,spin:0}));assert.equal(JSON.stringify(s),before);assert.throws(()=>input(s,'a',{type:'bowl',targetX:0,speed:25,spin:0}));assert.equal(JSON.stringify(s),before);bowl(s);assert.equal(s.phase,'DELIVERY');assert.throws(()=>bowl(s));});
test('input sequence rejects replay/out-of-order and invalid numbers without consuming sequence',()=>{const s=match();for(const seq of [-1,1.5,NaN])assert.throws(()=>applyInput(s,'b',seq,{type:'bowl',targetX:0,speed:25,spin:0}));for(const action of [{type:'bowl',targetX:NaN,speed:25,spin:0},{type:'bowl',targetX:0,speed:Infinity,spin:0},{type:'bowl',targetX:0,speed:25,spin:2},{type:'bowl',targetX:3,speed:25,spin:0},{type:'bowl',targetX:0,speed:11,spin:0}])assert.throws(()=>applyInput(s,'b',0,action as GameInput));assert.equal(s.sequence.b,undefined);applyInput(s,'b',3,{type:'bowl',targetX:0,speed:25,spin:0});assert.throws(()=>applyInput(s,'b',3,{type:'next'}));assert.throws(()=>applyInput(s,'b',2,{type:'next'}));assert.equal(s.sequence.b,3);});
test('real physical delivery advances ball, gravity, bounce and sampled trajectory',()=>{const s=match();bowl(s);tickUntil(s,x=>x.runUpRemaining===0);const initial={...s.ball};for(let i=0;i<20;i++)stepMatch(s,1/60);assert.ok(s.ball.z>initial.z);assert.ok(s.ball.y<initial.y);assert.ok(s.trajectory.length>0);tickUntil(s,x=>x.deliveryBounced);assert.ok(s.ball.y>=.07);});
test('pitch profiles deterministically change authoritative delivery bounce',()=>{const green=createMatch('green',team('a'),team('b'),1,'green'),dusty=createMatch('dusty',team('c'),team('d'),1,'dusty');bowl(green,25,.2);bowl(dusty,25,.2);tickUntil(green,x=>x.deliveryBounced);tickUntil(dusty,x=>x.deliveryBounced);assert.equal(green.pitchType,'green');assert.equal(dusty.pitchType,'dusty');assert.ok(green.ball.vy>dusty.ball.vy);assert.ok(green.ball.vz>dusty.ball.vz);});
test('pro bowling swing and seam controls alter the authoritative trajectory',()=>{const plain=createMatch('plain',team('a'),team('b'),1,'green'),moving=createMatch('moving',team('c'),team('d'),1,'green');input(plain,'b',{type:'bowl',targetX:0,speed:28,spin:0,length:0,swing:0,seam:0});input(moving,'d',{type:'bowl',targetX:0,speed:28,spin:0,length:0,swing:1,seam:1});tickUntil(plain,x=>x.runUpRemaining===0);tickUntil(moving,x=>x.runUpRemaining===0);for(let i=0;i<20;i++){stepMatch(plain,1/60);stepMatch(moving,1/60);}assert.ok(moving.ball.x>plain.ball.x);tickUntil(plain,x=>x.deliveryBounced);tickUntil(moving,x=>x.deliveryBounced);assert.ok(moving.ball.vx>plain.ball.vx);});
test('pro control ranges reject manipulated delivery and shot inputs',()=>{for(const bad of [{type:'bowl',targetX:0,speed:25,spin:0,length:2},{type:'bowl',targetX:0,speed:25,spin:0,swing:-2},{type:'bowl',targetX:0,speed:25,spin:0,seam:1.1}]){const s=match();assert.throws(()=>input(s,'b',bad as GameInput));}const s=match();bowl(s);assert.throws(()=>input(s,'a',{type:'shot',direction:0,power:1,loft:false,footwork:2}));assert.throws(()=>input(s,'a',{type:'shot',direction:0,power:1,loft:false,precision:-1}));});
test('invalid simulation deltas reject and completed game stops mutating',()=>{const s=match();for(const dt of [-1,0,NaN,Infinity,.11])assert.throws(()=>stepMatch(s,dt));completeByInputs(s,n=>n===1);const saved=JSON.stringify(s);stepMatch(s,1/60);assert.equal(JSON.stringify(s),saved);});
test('dot ball credits legal ball to the delivery striker and bowler',()=>{const s=match();bowl(s,25,.5);finishBall(s);assert.equal(s.lastShot,'Dot ball');assert.equal(s.runs,0);assert.equal(s.wickets,0);assert.equal(s.legalBalls,1);assert.equal(s.batters[0][0].balls,1);assert.equal(s.bowlers[1][s.bowler].balls,1);});
test('stump contact causes bowled, a new batter and bowler wicket credit',()=>{const s=match();bowl(s,12);finishBall(s);assert.equal(s.lastShot,'Bowled');assert.equal(s.wickets,1);assert.equal(s.batters[0][0].out,true);assert.equal(s.striker,2);assert.equal(s.nonStriker,1);assert.equal(s.bowlers[1][s.bowler].wickets,1);});
test('wide adds extra and bowler conceded run but no legal ball or batter run',()=>{const s=match();bowl(s,25,2.5);finishBall(s);assert.equal(s.lastShot,'Wide');assert.equal(s.runs,1);assert.equal(s.legalBalls,0);assert.equal(s.batters[0][0].runs,0);assert.equal(s.batters[0][0].balls,0);assert.equal(s.bowlers[1][s.bowler].wides,1);assert.equal(s.bowlers[1][s.bowler].runs,1);next(s);assert.equal(s.phase,'READY');});
test('valid timed directional ground shot reaches boundary and scores four',()=>{const s=match();hit(s,Math.PI/2,1,false);finishBall(s);assert.equal(s.lastShot,'FOUR!');assert.equal(s.runs,4);assert.equal(s.batters[0][0].runs,4);assert.equal(s.batters[0][0].fours,1);assert.equal(s.bowlers[1][s.bowler].runs,4);assert.equal(s.legalBalls,1);});
test('timed lofted contact crosses boundary before bouncing for six',()=>{const s=match();hit(s);finishBall(s);assert.equal(s.lastShot,'SIX!');assert.equal(s.runs,6);assert.equal(s.bounced,false);assert.equal(s.batters[0][0].sixes,1);});
test('early swing expires and cannot turn missed delivery into boundary',()=>{const s=match();bowl(s);input(s,'a',{type:'shot',direction:0,power:1,loft:true});finishBall(s);assert.equal(s.hit,false);assert.equal(s.runs,0);assert.throws(()=>input(s,'a',{type:'shot',direction:0,power:1,loft:true}));});
test('invalid batting controls and wrong owner shots reject',()=>{const s=match();bowl(s);assert.throws(()=>input(s,'b',{type:'shot',direction:0,power:1,loft:true}));for(const action of [{type:'shot',direction:4,power:1,loft:true},{type:'shot',direction:NaN,power:1,loft:true},{type:'shot',direction:0,power:-1,loft:true},{type:'shot',direction:0,power:1,loft:'yes'}])assert.throws(()=>input(s,'a',action as GameInput));});
test('fielders catch a lofted-unbounced reachable ball with bowler credit',()=>{const s=match();hit(s,Math.PI,1,false);finishBall(s);assert.equal(s.lastShot,'Caught');assert.equal(s.wickets,1);assert.equal(s.bowlers[1][s.bowler].wickets,1);});
test('single completed run credits original batter and exchanges strike; cancel prevents another run',()=>{const s=match();hit(s,0,0,false);input(s,'a',{type:'run'});input(s,'a',{type:'cancelRun'});finishBall(s);assert.equal(s.runs,1);assert.equal(s.striker,1);assert.equal(s.nonStriker,0);assert.equal(s.batters[0][0].runs,1);assert.equal(s.batters[0][1].runs,0);assert.equal(s.batters[0][0].balls,1);});
test('runout is a team wicket but not credited as bowler wicket',()=>{const s=match();hit(s,2,0,false);input(s,'a',{type:'run'});finishBall(s);assert.equal(s.lastShot,'Run out');assert.equal(s.wickets,1);assert.equal(s.bowlers[1][s.bowler].wickets,0);});
test('boundary supersedes odd completed runs and restores even-run strike',()=>{const s=match(20);hit(s,0,.5,true);input(s,'a',{type:'run'});finishBall(s);assert.ok(s.events.some(e=>e.text==='One run completed'));assert.equal(s.lastShot,'FOUR!');assert.equal(s.runs,4);assert.equal(s.striker,0);assert.equal(s.nonStriker,1);});
test('six legal balls swap strike and break innings; wides do not consume quota',()=>{const s=match();bowl(s,25,2.5);finishBall(s);next(s);for(let n=0;n<6;n++){bowl(s,25,.5);finishBall(s);if(n<5)next(s);}assert.equal(s.phase,'INNINGS_BREAK');assert.equal(s.legalBalls,6);assert.equal(s.striker,1);assert.equal(s.inningsScores[0].runs,1);assert.equal(s.inningsScores[0].balls,6);next(s);assert.equal(s.innings,2);assert.equal(s.batting,1);assert.equal(s.target,2);assert.equal(s.runs,0);assert.equal(s.legalBalls,0);});
test('deterministic physical-input match completes with authoritative innings and winner',()=>{const s=match(),ticks=completeByInputs(s,n=>n===1);assert.ok(ticks<30000);assert.equal(s.winnerId,'a');assert.equal(s.inningsScores.length,2);assert.equal(s.inningsScores[0].runs,36);assert.equal(s.inningsScores[1].runs,0);assert.equal(s.inningsScores[0].balls,6);assert.equal(s.inningsScores[1].balls,6);});
test('tied regulation innings trigger real Super Over and then resolve winner',()=>{const s=match();completeByInputs(s,n=>n===3);assert.equal(s.superOver,true);assert.equal(s.superRound,1);assert.equal(s.inningsScores.length,4);assert.equal(s.inningsScores[0].runs,s.inningsScores[1].runs);assert.equal(s.inningsScores[2].superOver,true);assert.equal(s.winnerId,'b');});
test('independent simultaneous sessions do not share trajectories, score or sequence state',()=>{const a=match(),b=createMatch('other',team('c'),team('d'),1),before=JSON.stringify(b);hit(a);finishBall(a);assert.equal(a.runs,6);assert.equal(JSON.stringify(b),before);bowl(b,12);finishBall(b);assert.equal(b.wickets,1);assert.equal(a.wickets,0);assert.equal(a.runs,6);assert.equal(b.runs,0);});
test('serialized mid-delivery checkpoint restores identical simulation',()=>{const a=match();bowl(a);for(let i=0;i<15;i++)stepMatch(a,1/60);const restored:MatchState=JSON.parse(JSON.stringify(a));for(let i=0;i<90;i++){stepMatch(a,1/60);stepMatch(restored,1/60);}assert.deepEqual(restored,a);});
test('one swing per delivery rejects repeated swing spam despite increasing sequences',()=>{const s=match();bowl(s);input(s,'a',{type:'shot',direction:0,power:1,loft:true});const sequence=s.sequence.a;assert.throws(()=>input(s,'a',{type:'shot',direction:Math.PI,power:1,loft:true}));assert.equal(s.sequence.a,sequence);});
test('ten wickets end innings before full two-over quota and preserve actual legal balls',()=>{const s=createMatch('all-out',team('a'),team('b'),2);for(let i=0;i<10;i++){bowl(s,12);finishBall(s);assert.equal(s.wickets,i+1);if(i<9)next(s);}assert.equal(s.phase,'INNINGS_BREAK');assert.equal(s.inningsScores[0].wickets,10);assert.equal(s.inningsScores[0].balls,10);assert.equal(s.inningsScores[0].quotaBalls,12);assert.equal(s.batters[0].filter(p=>p.out).length,10);});
test('second innings chase ends immediately when a physical shot reaches target',()=>{const s=match();for(let i=0;i<6;i++){bowl(s,25,.5);finishBall(s);if(i<5)next(s);}assert.equal(s.inningsScores[0].runs,0);next(s);hit(s);finishBall(s);assert.equal(s.phase,'COMPLETE');assert.equal(s.winnerId,'b');assert.equal(s.inningsScores[1].balls,1);assert.equal(s.inningsScores[1].runs,6);});


test('run-up holds the ball before a single authoritative release, without scoring',()=>{
 const s=match();bowl(s);assert.equal(s.ball.vz,0);assert.equal(s.ball.z,-15);
 for(let i=0;i<60;i++)stepMatch(s,1/60);
 assert.ok(s.runUpRemaining!>0);assert.ok(s.ball.z>-15&&s.ball.z<-9);
 assert.equal(s.ball.y,2);assert.equal(s.legalBalls,0);assert.equal(s.trajectory.length,0);
 assert.throws(()=>bowl(s));tickUntil(s,x=>x.runUpRemaining===0);
 assert.equal(s.ball.z,-9);assert.equal(s.ball.vz,25);
 stepMatch(s,1/60);assert.ok(s.ball.z>-9);finishBall(s);
 assert.equal(s.events.filter(e=>e.type==='release').length,1);assert.equal(s.legalBalls,1);
});

test('run-up checkpoint resumes identically including release and final score',()=>{
 const s=match();bowl(s);for(let i=0;i<35;i++)stepMatch(s,1/60);
 const restored=JSON.parse(JSON.stringify(s));
 for(let i=0;i<300;i++){stepMatch(s,1/60);stepMatch(restored,1/60);}
 assert.deepEqual(restored,s);assert.equal(s.phase,'DEAD');assert.equal(s.legalBalls,1);
});

test('legacy released checkpoint without run-up fields continues safely',()=>{
 const s=match();bowl(s);s.ball={...s.releaseBall!};delete s.runUpRemaining;delete s.releaseBall;
 stepMatch(s,1/60);assert.ok(s.ball.z>-9);finishBall(s);assert.equal(s.legalBalls,1);
});

test('fielder collects a ground shot and visibly returns ball to the wicket',()=>{
 const s=match();hit(s,2,0,false);tickUntil(s,x=>x.throwTime!==null);
 const distance=()=>Math.hypot(s.ball.x,s.ball.y-.75,s.ball.z-8.7);
 const before=distance();assert.ok(before>0);stepMatch(s,1/60);assert.ok(distance()<before);
 finishBall(s);assert.ok(distance()<1e-8);assert.equal(s.legalBalls,1);assert.equal(s.wickets,0);
});

test('two interleaved playable overs preserve independent run-ups, wides and scorecards',()=>{
 const a=match(),b=createMatch('parallel',team('c'),team('d'),1);
 for(let n=0;n<6;n++){
  bowl(a,25,.5);bowl(b,25,.5);
  let ticks=0;while(!['DEAD','INNINGS_BREAK'].includes(a.phase)||!['DEAD','INNINGS_BREAK'].includes(b.phase)){
   stepMatch(a,1/60);stepMatch(b,1/60);assert.ok(++ticks<300);
  }
  assert.equal(a.legalBalls,n+1);assert.equal(b.legalBalls,n+1);
  if(n<5){next(a);next(b);}
 }
 assert.equal(a.phase,'INNINGS_BREAK');assert.equal(b.phase,'INNINGS_BREAK');
 assert.equal(a.events.filter(e=>e.type==='release').length,6);
 assert.equal(b.events.filter(e=>e.type==='release').length,6);
 assert.equal(a.inningsScores[0].balls,6);assert.equal(b.inningsScores[0].balls,6);
});


test('manual field control validates owner and numbers without consuming rejected sequence',()=>{
 const s=match(),before=JSON.stringify(s);
 assert.throws(()=>input(s,'a',{type:'field',fielder:0,dx:1,dz:0}));
 for(const fielder of [-1,10,1.5,NaN])assert.throws(()=>input(s,'b',{type:'field',fielder,dx:0,dz:0}));
 assert.throws(()=>input(s,'b',{type:'field',fielder:0,dx:Infinity,dz:0}));
 assert.equal(JSON.stringify(s),before);assert.throws(()=>input(s,'b',{type:'throw',end:'striker'}));
});

test('manual fielder moves at bounded speed, holds collection, and throws to chosen end',()=>{
 const s=match();input(s,'b',{type:'field',fielder:2,dx:1,dz:1});
 hit(s,2,0,false);const before={...s.fielders[2]};stepMatch(s,1/60);
 assert.ok(Math.hypot(s.fielders[2].x-before.x,s.fielders[2].z-before.z)<=7/60+1e-8);
 input(s,'b',{type:'field',fielder:2,dx:0,dz:0});tickUntil(s,x=>x.ballHolder!=null);
 const saved=JSON.parse(JSON.stringify(s));input(s,'b',{type:'throw',end:'nonStriker'});
 assert.equal(s.throwEnd,'nonStriker');assert.equal(s.ballHolder,null);finishBall(s);
 assert.ok(Math.abs(s.ball.z+8.7)<1e-8);assert.equal(s.wickets,0);assert.equal(s.legalBalls,1);
 input(saved,'b',{type:'throw',end:'nonStriker'});finishBall(saved);assert.deepEqual(saved,JSON.parse(JSON.stringify(s)));
});

test('abandoned manual collection automatically returns ball and cannot stall an over',()=>{
 const s=match();input(s,'b',{type:'field',fielder:2,dx:0,dz:0});hit(s,2,0,false);
 tickUntil(s,x=>x.ballHolder!=null);finishBall(s);assert.equal(s.legalBalls,1);
 assert.equal(s.ballHolder,null);assert.equal(s.phase,'DEAD');
});

test('front-foot no ball scores an extra without a legal ball, carries a free hit across wides',()=>{
 const s=match();input(s,'b',{type:'bowl',speed:12,targetX:0,spin:0,releaseOffset:.1});finishBall(s);
 assert.equal(s.noBall,true);assert.equal(s.wickets,0);assert.equal(s.legalBalls,0);
 assert.equal(s.extras?.noBalls,1);assert.equal(s.batters[0][0].runs,0);assert.equal(s.freeHit,true);
 assert.equal(s.bowlers[1][s.bowler].runs,1);next(s);bowl(s,25,2.5);finishBall(s);
 assert.equal(s.freeHit,true);assert.equal(s.legalBalls,0);assert.equal(s.extras?.wides,1);
 next(s);bowl(s,12);finishBall(s);assert.equal(s.wickets,0);assert.equal(s.legalBalls,1);assert.equal(s.freeHit,false);
 next(s);bowl(s,12);finishBall(s);assert.equal(s.wickets,1);assert.equal(s.legalBalls,2);
});

test('no ball overrides wide and validates front foot before state mutation',()=>{
 const s=match(),before=JSON.stringify(s);for(const releaseOffset of [NaN,Infinity,.51,-.51])assert.throws(()=>input(s,'b',{type:'bowl',speed:25,targetX:2.5,spin:0,releaseOffset}));assert.equal(JSON.stringify(s),before);
 input(s,'b',{type:'bowl',speed:25,targetX:2.5,spin:0,releaseOffset:.1});finishBall(s);
 assert.equal(s.extras?.noBalls,1);assert.equal(s.extras?.wides,0);assert.equal(s.legalBalls,0);assert.equal(s.deliveries?.[0].wide,false);
});

test('no-ball boundary credits six to batter plus one extra to team and bowler',()=>{
 const s=match();input(s,'b',{type:'bowl',speed:25,targetX:0,spin:0,releaseOffset:.1});tickUntil(s,x=>x.ball.z>5.4);
 input(s,'a',{type:'shot',direction:0,power:1,loft:true});finishBall(s);
 assert.equal(s.runs,7);assert.equal(s.batters[0][0].runs,6);assert.equal(s.batters[0][0].sixes,1);
 assert.equal(s.bowlers[1][s.bowler].runs,7);assert.equal(s.legalBalls,0);assert.equal(s.deliveries?.[0].runs,7);
});

test('keeper miss can reach a bye boundary without crediting batter or charging bowler',()=>{
 const s=match();s.fielders[9].x=12; // Deliberately misplaced keeper: exercise missed-ball physics and scoring.
 input(s,'b',{type:'field',fielder:9,dx:1,dz:0});bowl(s,25,.5);finishBall(s);
 assert.equal(s.hit,false);assert.equal(s.runs,4);assert.equal(s.extras?.byes,4);
 assert.equal(s.batters[0][0].runs,0);assert.equal(s.batters[0][0].fours,0);assert.equal(s.bowlers[1][s.bowler].runs,0);
 assert.equal(s.legalBalls,1);assert.equal(s.lastShot,'FOUR BYES');
});


test('attempted pro shot hitting a pad in line with projected stumps is LBW with bowler credit',()=>{
 const s=match();bowl(s,12,.15);input(s,'a',{type:'shot',direction:0,power:1,loft:false,footwork:1});finishBall(s);
 assert.equal(s.lastShot,'LBW');assert.equal(s.wickets,1);assert.equal(s.bowlers[1][s.bowler].wickets,1);assert.equal(s.legalBalls,1);
});

test('pad contact outside off stump permits leg byes from attempted shot, without batter/bowler runs',()=>{
 const s=match();for(const f of s.fielders){f.x=-40;f.z=-40;}
 bowl(s,12,.5);input(s,'a',{type:'shot',direction:0,power:1,loft:false,footwork:0});tickUntil(s,x=>x.phase==='IN_PLAY');
 assert.equal(s.bodyContact,true);input(s,'a',{type:'run'});input(s,'a',{type:'cancelRun'});finishBall(s);
 assert.equal(s.wickets,0);assert.equal(s.runs,1);assert.equal(s.extras?.legByes,1);assert.equal(s.batters[0][0].runs,0);assert.equal(s.bowlers[1][s.bowler].runs,0);
});


test('all eleven purchased fielding players are represented once, including bowler and keeper',()=>{
 const s=match();assert.equal(s.fielders.length,10);const ids=[s.teams[1].players[s.bowler].id,...s.fielders.map(f=>f.playerId)];
 assert.equal(new Set(ids).size,11);assert.deepEqual(new Set(ids),new Set(s.teams[1].players.map(p=>p.id)));
});


test('legacy nine-fielder checkpoint upgrades at the next safe delivery boundary',()=>{
 const s=match();s.fielders.splice(8,1);bowl(s,12);finishBall(s);next(s);
 assert.equal(s.fielders.length,10);assert.equal(s.phase,'READY');assert.equal(new Set(s.fielders.map(f=>f.playerId)).size,10);
});


test('twenty-over match enforces four-over quotas and uses purchased part-time bowlers when needed',()=>{
 const a=team('a'),b=team('b');b.players.forEach((p,i)=>p.role=i>=7?'bowler':'batter');const s=createMatch('quota',a,b,20);
 let previous=-1;for(let over=0;over<20;over++){
  assert.notEqual(s.bowler,previous);previous=s.bowler;
  for(let ball=0;ball<6;ball++){bowl(s,25,.5);finishBall(s);if(over<19||ball<5)next(s);}
 }
 assert.equal(s.legalBalls,120);assert.equal(s.phase,'INNINGS_BREAK');assert(s.bowlers[1].every(b=>b.balls<=24));
 assert.equal(s.bowlers[1].reduce((n,b)=>n+b.balls,0),120);assert(s.bowlers[1].slice(0,7).some(b=>b.balls>0));
});
