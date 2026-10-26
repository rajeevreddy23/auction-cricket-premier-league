import type {MatchState} from '../../core/cricket.ts';
export function inningsAnalysis(s:MatchState){
 const rows=(s.deliveries??[]).filter(d=>d.innings===s.innings);
 const overs=new Map<number,number>();
 for(const d of rows){const over=Math.floor(Math.max(0,d.ball-(d.wide?0:1))/6);overs.set(over,(overs.get(over)??0)+d.runs);}
 return {rows,overs:[...overs].map(([over,runs])=>({over:over+1,runs})),rates:rows.filter(d=>d.ball>0).map(d=>({ball:d.ball,rate:d.total*6/d.ball}))};
}
export function rateGraph(s:MatchState){const data=inningsAnalysis(s),max=Math.max(1,...data.rates.map(d=>d.rate)),balls=Math.max(1,...data.rates.map(d=>d.ball));return `<h4>Run-rate progression</h4><svg viewBox="0 0 400 150" role="img" aria-label="Run rate by legal ball"><path d="M25 10V125H390" fill="none" stroke="#8ba39d"/><polyline points="${data.rates.map(d=>`${25+d.ball/balls*360},${125-d.rate/max*110}`).join(' ')}" fill="none" stroke="#d4f25c" stroke-width="3"/><text x="25" y="145" fill="#dce9df" font-size="10">0</text><text x="300" y="145" fill="#dce9df" font-size="10">${balls} legal balls</text></svg>`;}
