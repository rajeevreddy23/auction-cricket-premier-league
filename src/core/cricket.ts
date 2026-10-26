/** Shared deterministic, input-driven cricket simulation. Server is the score authority. */
export interface CricketPlayer {id:string; name:string; batting:number; bowling:number; power:number; timing:number; accuracy:number; stamina:number; role:string}
export interface MatchTeam {id:string; name:string; ownerId:string; players:CricketPlayer[]}
export type GameInput = {type:'bowl';targetX:number;speed:number;spin:number;length?:number;swing?:number;seam?:number}|{type:'shot';direction:number;power:number;loft:boolean;footwork?:number;precision?:number}|{type:'run'}|{type:'cancelRun'}|{type:'next'};
export interface Ball {x:number;y:number;z:number;vx:number;vy:number;vz:number}
export interface InningsScore {teamId:string;runs:number;wickets:number;balls:number;quotaBalls:number;superOver:boolean}
export interface BatterStat {playerId:string;runs:number;balls:number;fours:number;sixes:number;out:boolean}
export interface BowlerStat {playerId:string;balls:number;runs:number;wickets:number;wides:number}
export interface MatchState {
 id:string;teams:[MatchTeam,MatchTeam];batting:number;innings:number;phase:'READY'|'DELIVERY'|'IN_PLAY'|'DEAD'|'INNINGS_BREAK'|'COMPLETE';
 ball:Ball;runs:number;wickets:number;legalBalls:number;overs:number;target:number|null;winnerId:string|null;
 inningsScores:InningsScore[];events:{id:number;tick:number;text:string;type:string}[];tick:number;time:number;phaseTime:number;
 sequence:Record<string,number>;striker:number;nonStriker:number;bowler:number;batters:BatterStat[][];bowlers:BowlerStat[][];
 fielders:{x:number;z:number;homeX:number;homeZ:number}[];swing:{until:number;direction:number;power:number;loft:boolean}|null;
 hit:boolean;bounced:boolean;deliveryBounced:boolean;wide:boolean;deliveryRuns:number;running:number;runRequested:boolean;throwTime:number|null;
 trajectory:{x:number;y:number;z:number}[];lastShot:string;delivery:number;deliveryStriker:number;superOver:boolean;superRound:number;
 pitchType?:'green'|'dusty'|'flat';
 deliverySwing?:number;deliverySeam?:number;shotFootwork?:number;
}
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const ballAtStart=():Ball=>({x:0,y:2,z:-9,vx:0,vy:0,vz:0});
function event(s:MatchState,text:string,type='info'){s.events.push({id:s.events.length? s.events[s.events.length-1].id+1:1,tick:s.tick,text,type});if(s.events.length>600)s.events.shift();}
function assertNumber(n:unknown){if(typeof n!=='number'||!Number.isFinite(n))throw Error('Invalid numeric input');}
export function createMatch(id:string,a:MatchTeam,b:MatchTeam,overs=2,pitchType:'green'|'dusty'|'flat'='flat'):MatchState {
 if(a.id===b.id||a.ownerId===b.ownerId)throw Error('Two independent team owners are required');
 if(!Number.isInteger(overs)||overs<1||overs>20)throw Error('Overs must be 1 to 20');
 if(a.players.length!==11||b.players.length!==11)throw Error('Playing XI must contain eleven players');
 for(const t of [a,b])if(new Set(t.players.map(p=>p.id)).size!==11)throw Error('Duplicate XI player');
 const positions=[[-16,18],[17,19],[-28,1],[29,-2],[-14,-29],[16,-32],[-37,28],[36,29],[0,10.8]];
 const s:MatchState={id,teams:structuredClone([a,b]),batting:0,innings:1,phase:'READY',ball:ballAtStart(),runs:0,wickets:0,legalBalls:0,overs,target:null,winnerId:null,inningsScores:[],events:[],tick:0,time:0,phaseTime:0,sequence:{},striker:0,nonStriker:1,bowler:0,batters:[a,b].map(t=>t.players.map(p=>({playerId:p.id,runs:0,balls:0,fours:0,sixes:0,out:false}))),bowlers:[a,b].map(t=>t.players.map(p=>({playerId:p.id,balls:0,runs:0,wickets:0,wides:0}))),fielders:positions.map(([x,z])=>({x,z,homeX:x,homeZ:z})),swing:null,hit:false,bounced:false,deliveryBounced:false,wide:false,deliveryRuns:0,running:0,runRequested:false,throwTime:null,trajectory:[],lastShot:'Awaiting delivery',delivery:0,deliveryStriker:0,superOver:false,superRound:0,pitchType};
 selectBowler(s);event(s,`${a.name} bat first. ${overs} overs per side.`);return s;
}
function selectBowler(s:MatchState){const team=s.teams[1-s.batting];const eligible=team.players.map((p,i)=>({p,i})).filter(x=>/bowl|all/i.test(x.p.role));s.bowler=(eligible.length?eligible:team.players.map((p,i)=>({p,i})))[Math.floor(s.legalBalls/6)%Math.max(1,eligible.length)].i;}
function resetDelivery(s:MatchState){s.phase='READY';s.phaseTime=0;s.ball=ballAtStart();s.hit=false;s.bounced=false;s.deliveryBounced=false;s.wide=false;s.swing=null;s.deliveryRuns=0;s.running=0;s.runRequested=false;s.throwTime=null;s.trajectory=[];s.deliverySwing=0;s.deliverySeam=0;s.shotFootwork=undefined;for(const f of s.fielders){f.x=f.homeX;f.z=f.homeZ;}selectBowler(s);}
export function applyInput(s:MatchState,userId:string,sequence:number,input:GameInput):void {
 if(!s.teams.some(t=>t.ownerId===userId))throw Error('Not a match participant');
 if(!Number.isSafeInteger(sequence)||sequence<0||sequence<=(s.sequence[userId]??-1))throw Error('Repeated or out-of-order input');
 if(!input||typeof input!=='object')throw Error('Missing action');
 const bat=s.teams[s.batting].ownerId===userId;
 if(input.type==='bowl'){
  if(bat||s.phase!=='READY')throw Error('Only the bowling owner can deliver a ready ball');
  assertNumber(input.targetX);assertNumber(input.speed);assertNumber(input.spin);const length=input.length??0,swing=input.swing??0,seam=input.seam??0;assertNumber(length);assertNumber(swing);assertNumber(seam);
  if(Math.abs(input.targetX)>2.5||input.speed<12||input.speed>36||Math.abs(input.spin)>1||Math.abs(length)>1||Math.abs(swing)>1||Math.abs(seam)>1)throw Error('Delivery control out of range');
  const p=s.teams[1-s.batting].players[s.bowler];const variation=Math.sin((s.delivery+1)*91.17)*(100-clamp(p.accuracy,0,100))/600;
  s.ball={x:0,y:2,z:-9,vx:(input.targetX+variation)*input.speed/17,vy:-3.1-length*2.15,vz:input.speed};s.ball.vx+=input.spin*.35;s.deliverySwing=swing*(.25+p.accuracy/170);s.deliverySeam=seam*(.18+p.bowling/180);
  s.phase='DELIVERY';s.phaseTime=0;s.deliveryStriker=s.striker;s.delivery++;s.lastShot='Ball released';
 }else if(input.type==='shot'){
  if(!bat||s.phase!=='DELIVERY'||s.hit||s.swing!==null)throw Error('Only the batting owner can play the delivery');
  assertNumber(input.direction);assertNumber(input.power);const footwork=input.footwork??0,precision=input.precision??1;assertNumber(footwork);assertNumber(precision);
  if(Math.abs(input.direction)>Math.PI||input.power<0||input.power>1||typeof input.loft!=='boolean'||Math.abs(footwork)>1||precision<0||precision>1)throw Error('Shot control out of range');
  s.shotFootwork=input.footwork;s.swing={until:s.time+.15+precision*.04,direction:input.direction,power:input.power*(.82+precision*.18),loft:input.loft};s.lastShot='Swing';
 }else if(input.type==='run'){
  if(!bat||s.phase!=='IN_PLAY')throw Error('Runs can only be attempted by the batting owner with the ball in play');
  s.runRequested=true;if(s.running===0)s.running=2.6;
 }else if(input.type==='cancelRun'){
  if(!bat||s.phase!=='IN_PLAY')throw Error('No active run');s.runRequested=false;
 }else if(input.type==='next'){
  if(s.phase==='DEAD'){resetDelivery(s);}else if(s.phase==='INNINGS_BREAK'){startNextInnings(s);}else throw Error('Delivery has not finished');
 }else throw Error('Unknown match action');
 s.sequence[userId]=sequence;
}
function addRuns(s:MatchState,n:number,boundary=0){s.runs+=n;s.deliveryRuns+=n;const batter=s.batters[s.batting][s.deliveryStriker];batter.runs+=n;if(boundary===4)batter.fours++;if(boundary===6)batter.sixes++;s.bowlers[1-s.batting][s.bowler].runs+=n;}
function endBall(s:MatchState,label:string,wicket=false,wide=false){
 if(s.phase==='DEAD'||s.phase==='INNINGS_BREAK'||s.phase==='COMPLETE')return;
 if(wide){s.runs++;const b=s.bowlers[1-s.batting][s.bowler];b.runs++;b.wides++;}else{s.legalBalls++;s.batters[s.batting][s.deliveryStriker].balls++;s.bowlers[1-s.batting][s.bowler].balls++;}
 if(wicket){if(label!=='Run out'&&s.striker!==s.deliveryStriker)[s.striker,s.nonStriker]=[s.nonStriker,s.striker];s.wickets++;s.batters[s.batting][s.striker].out=true;if(label!=='Run out')s.bowlers[1-s.batting][s.bowler].wickets++;if(s.wickets<10)s.striker=s.wickets+1;}
 if(!wide&&s.legalBalls%6===0)[s.striker,s.nonStriker]=[s.nonStriker,s.striker];
 s.phase='DEAD';s.phaseTime=0;s.lastShot=label;s.ball.vx=s.ball.vy=s.ball.vz=0;event(s,`${Math.floor(s.legalBalls/6)}.${s.legalBalls%6} · ${label} · ${s.runs}/${s.wickets}`,wicket?'wicket':'ball');
 if(s.legalBalls>= (s.superOver?6:s.overs*6)||s.wickets>=(s.superOver?2:10)||(s.target!==null&&s.runs>=s.target))endInnings(s);
}
function endInnings(s:MatchState){
 s.inningsScores.push({teamId:s.teams[s.batting].id,runs:s.runs,wickets:s.wickets,balls:s.legalBalls,quotaBalls:s.superOver?6:s.overs*6,superOver:s.superOver});
 if(s.innings%2===1){s.phase='INNINGS_BREAK';event(s,`Innings complete. Target ${s.runs+1}.`);return;}
 const previous=s.inningsScores[s.inningsScores.length-2];
 if(s.runs===previous.runs){s.phase='INNINGS_BREAK';s.superRound++;event(s,`Scores tied. Super Over ${s.superRound} follows.`);return;}
 s.winnerId=s.runs>previous.runs?s.teams[s.batting].id:previous.teamId;s.phase='COMPLETE';event(s,`${s.teams.find(t=>t.id===s.winnerId)!.name} win!`,'result');
}
function startNextInnings(s:MatchState){
 const last=s.inningsScores[s.inningsScores.length-1];
 if(s.innings%2===0){s.superOver=true;s.target=null;}else{s.target=last.runs+1;s.batting=1-s.batting;}
 s.innings++;s.runs=0;s.wickets=0;s.legalBalls=0;s.striker=0;s.nonStriker=1;
 if(s.superOver)for(const stat of s.batters[s.batting])stat.out=false;
 resetDelivery(s);event(s,`${s.teams[s.batting].name} batting${s.target!==null?`. Target ${s.target}`:'. Super Over'}.`);
}
export function stepMatch(s:MatchState,dt:number):void {
 if(!Number.isFinite(dt)||dt<=0||dt>.1)throw Error('Simulation delta must be 0..0.1');
 if(s.phase==='COMPLETE')return;s.tick++;s.time+=dt;s.phaseTime+=dt;
 if(s.phase==='READY'||s.phase==='DEAD'||s.phase==='INNINGS_BREAK')return;
 const b=s.ball,oldZ=b.z; b.vy-=9.81*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
 if(s.phase==='DELIVERY'&&!s.deliveryBounced){const progress=clamp((b.z+9)/17,0,1);b.vx+=(s.deliverySwing??0)*Math.sin(progress*Math.PI)*dt*1.9;}
 if(b.y<.07){b.y=.07;if(s.hit){s.bounced=true;b.vy=Math.abs(b.vy)*.35;b.vx*=.82;b.vz*=.82;}else {s.deliveryBounced=true;const pitch=s.pitchType??'flat';const bounce=pitch==='green'?.78:pitch==='dusty'?.56:.66;b.vy=Math.abs(b.vy)*bounce;b.vx+=(s.deliverySeam??0)*(pitch==='green'?.85:pitch==='dusty'?.35:.18);if(pitch==='green')b.vz*=1.03;if(pitch==='dusty'){b.vz*=.94;b.vx*=1.14;}}}
 if(s.hit&&b.y<.13){const drag=Math.max(0,1-1.35*dt);b.vx*=drag;b.vz*=drag;}
 if(s.tick%2===0){s.trajectory.push({x:b.x,y:b.y,z:b.z});if(s.trajectory.length>180)s.trajectory.shift();}
 if(s.phase==='DELIVERY'){
  if(oldZ<7.8&&b.z>=7.8){
   const t=clamp((7.8-oldZ)/(b.z-oldZ),0,1);const timeAtBat=s.time-dt+dt*t;
   if(s.swing&&s.swing.until>=timeAtBat&&Math.abs(b.x)<1.25&&b.y<2.5){
    const p=s.teams[s.batting].players[s.striker],idealFootwork=s.deliveryBounced?.55:-.2;const footwork=s.shotFootwork===undefined?1:1-Math.min(1,Math.abs(s.shotFootwork-idealFootwork))*.22;const timing=clamp((1-Math.abs(s.swing.until-timeAtBat-.095)/.18)*footwork,.15,1);
    const speed=(14+s.swing.power*22)*(0.55+p.power/200)*timing;
    b.vx=Math.sin(s.swing.direction)*speed;b.vz=-Math.cos(s.swing.direction)*speed;
    b.vy=s.swing.loft?speed*.86:3+s.swing.power*2;b.z=7.7;s.hit=true;s.bounced=false;s.phase='IN_PLAY';s.phaseTime=0;
    s.lastShot=timing>.78?'Perfect contact':timing>.5?'Good contact':'Edge';event(s,s.lastShot,'contact');
   }
  }
  if(!s.hit&&b.z>=8.6){if(Math.abs(b.x)<.25&&b.y<.85)endBall(s,'Bowled',true);else if(b.z>12){endBall(s,Math.abs(b.x)>1.45?'Wide':'Dot ball',false,Math.abs(b.x)>1.45);}}
 }else if(s.phase==='IN_PLAY'){
  if(s.running>0){s.running-=dt;if(s.running<=0){s.running=0;addRuns(s,1);[s.striker,s.nonStriker]=[s.nonStriker,s.striker];event(s,'One run completed');if(s.target!==null&&s.runs>=s.target){endBall(s,'Winning run');return;}if(s.runRequested)s.running=2.6;}}
  if(Math.hypot(b.x,b.z)>52){const n=s.bounced?4:6;if(s.striker!==s.deliveryStriker)[s.striker,s.nonStriker]=[s.nonStriker,s.striker];const already=s.deliveryRuns;addRuns(s,Math.max(0,n-already),n);endBall(s,n===6?'SIX!':'FOUR!');return;}
  if(s.throwTime!==null){s.throwTime-=dt;if(s.throwTime<=0){endBall(s,s.running>0?'Run out':s.deliveryRuns?`${s.deliveryRuns} run${s.deliveryRuns===1?'':'s'}`:'Fielded · no run',s.running>0);return;}}
  else {
   for(const f of s.fielders){const dx=b.x-f.x,dz=b.z-f.z,d=Math.hypot(dx,dz);const speed=5.3;const move=Math.min(d,speed*dt);if(d>0){f.x+=dx/d*move;f.z+=dz/d*move;}
    if(d<1.25&&b.y<2.1){if(!s.bounced&&b.y>.25){endBall(s,'Caught',true);return;}s.throwTime=.9+Math.hypot(f.x,f.z-8)/35;b.vx=b.vz=b.vy=0;break;}
   }
  }
  if(s.phaseTime>14||Math.hypot(b.vx,b.vz)<.15&&s.phaseTime>3){endBall(s,s.deliveryRuns?`${s.deliveryRuns} runs`:'Dot ball');}
 }
}
