import {createMatch,stepMatch,applyInput,type MatchTeam} from '../src/core/cricket.ts';
import {performance} from 'node:perf_hooks';
import {cpus,totalmem} from 'node:os';
import {writeFileSync} from 'node:fs';
// Headless engine benchmark only. Not a renderer, WAN or distributed capacity test.
const side=(id:string):MatchTeam=>({id,name:id,ownerId:id,players:Array.from({length:11},(_,i)=>({id:`${id}-${i}`,name:`Player ${i}`,role:i>4?'bowler':'batter',batting:80,bowling:80,power:80,timing:80,accuracy:80,stamina:80}))});
const matches=Array.from({length:5},(_,i)=>createMatch(`benchmark-${i}`,side(`A${i}`),side(`B${i}`),1));
const durations:number[]=[];const start=performance.now();const cpu=process.cpuUsage();let inputs=0;let ticks=0;
for(let t=0;t<18000;t++){
 const tickStart=performance.now();
 for(const m of matches){if(m.phase==='COMPLETE')continue;const owner=m.teams[m.phase==='READY'?1-m.batting:m.batting].ownerId;
 if(m.phase==='READY'){applyInput(m,owner,(m.sequence[owner]??-1)+1,{type:'bowl',targetX:0,speed:25,spin:0});inputs++;}
 else if(m.phase==='DEAD'||m.phase==='INNINGS_BREAK'){applyInput(m,owner,(m.sequence[owner]??-1)+1,{type:'next'});inputs++;}
 else if(m.innings===1&&m.phase==='DELIVERY'&&m.ball.z>5.4&&!m.swing){applyInput(m,owner,(m.sequence[owner]??-1)+1,{type:'shot',direction:0,power:1,loft:true});inputs++;}
 stepMatch(m,1/60);}
 durations.push(performance.now()-tickStart);ticks++;
 if(matches.every(m=>m.phase==='COMPLETE'))break;
}
const ordered=[...durations].sort((a,b)=>a-b);const p=(q:number)=>ordered[Math.floor((ordered.length-1)*q)];
const usage=process.cpuUsage(cpu);
const report={date:new Date().toISOString(),kind:'headless deterministic engine-input benchmark; NOT production capacity certification',infrastructure:{runtime:process.version,cpu:cpus()[0].model,logicalCpus:cpus().length,hostMemoryBytes:totalmem()},tier:'A engine component only',sessions:5,owners:10,completed:matches.filter(m=>m.phase==='COMPLETE').length,inputs,ticks,wallMs:performance.now()-start,simulationBatchMs:{p50:p(.5),p95:p(.95),p99:p(.99)},processCpuMs:{user:usage.user/1000,system:usage.system/1000},processMemory:process.memoryUsage(),results:matches.map(m=>({id:m.id,winnerId:m.winnerId,scores:m.inningsScores})),notRun:['50 or 500 concurrent network matches','render frame times/device matrix','WAN latency and packet loss','distributed crash recovery','cloud cost measurement']};
writeFileSync('docs/BENCHMARK.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.completed!==5)process.exitCode=1;
