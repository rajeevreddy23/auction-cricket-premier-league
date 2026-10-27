import type {GameInput,MatchState} from '../../core/cricket.ts';

/** Uses the same authenticated inputs for practice and online matches. */
export function mountFieldControls(root:HTMLElement,state:()=>MatchState,user:()=>string,send:(input:GameInput)=>void){
 const panel=document.createElement('div');panel.className='field-controls';
 panel.innerHTML=`<strong>Fielding</strong><button data-field="nearest">Control nearest <kbd>F</kbd></button><button data-field="auto">Auto field</button><div class="field-pad" aria-label="Move selected fielder"><button data-move="0,-1" aria-label="Move fielder up">↑</button><button data-move="-1,0" aria-label="Move fielder left">←</button><button data-move="0,1" aria-label="Move fielder down">↓</button><button data-move="1,0" aria-label="Move fielder right">→</button></div><button data-field="striker">Throw striker end <kbd>T</kbd></button><button data-field="nonStriker">Throw bowler end <kbd>Y</kbd></button><span data-field-status></span>`;
 root.querySelector('.game-actions')!.after(panel);
 let active:number|null=null;const keys=new Set<string>();
 const allowed=()=>user()===state().teams[1-state().batting].ownerId&&['READY','DELIVERY','IN_PLAY'].includes(state().phase);
 function move(dx:number,dz:number){const s=state();if(allowed()&&s.selectedFielder!=null)send({type:'field',fielder:s.selectedFielder,dx,dz});}
 function stop(){keys.clear();if(active!==null){clearInterval(active);active=null;}move(0,0);}
 function nearest(){if(!allowed())return;const s=state();const index=s.fielders.reduce((best,f,i)=>Math.hypot(f.x-s.ball.x,f.z-s.ball.z)<Math.hypot(s.fielders[best].x-s.ball.x,s.fielders[best].z-s.ball.z)?i:best,0);send({type:'field',fielder:index,dx:0,dz:0});}
 panel.querySelector('[data-field="nearest"]')!.addEventListener('click',nearest);
 panel.querySelector('[data-field="auto"]')!.addEventListener('click',()=>{if(allowed()){stop();send({type:'field',fielder:null,dx:0,dz:0});}});
 for(const end of ['striker','nonStriker'] as const)panel.querySelector(`[data-field="${end}"]`)!.addEventListener('click',()=>{if(allowed())send({type:'throw',end});});
 panel.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(button=>{
  button.addEventListener('pointerdown',e=>{if(!allowed()||state().selectedFielder==null)return;e.preventDefault();stop();button.setPointerCapture(e.pointerId);const [dx,dz]=button.dataset.move!.split(',').map(Number);move(dx,dz);active=window.setInterval(()=>move(dx,dz),100);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,stop);
 });
 const vectors:Record<string,[number,number]>={w:[0,-1],a:[-1,0],s:[0,1],d:[1,0]};
 function keydown(e:KeyboardEvent){if((e.target as HTMLElement)?.matches('input,select,textarea')||!allowed())return;const key=e.key.toLowerCase();if(key==='f'&&!e.repeat){e.preventDefault();nearest();}else if((key==='t'||key==='y')&&!e.repeat&&state().ballHolder!=null){e.preventDefault();send({type:'throw',end:key==='t'?'striker':'nonStriker'});}else if(vectors[key]){e.preventDefault();keys.add(key);moveKeys();}}
 function moveKeys(){const vector=[...keys].reduce((v,key)=>[v[0]+vectors[key][0],v[1]+vectors[key][1]],[0,0]);move(Math.sign(vector[0]),Math.sign(vector[1]));}
 function keyup(e:KeyboardEvent){if(keys.delete(e.key.toLowerCase()))moveKeys();}
 document.addEventListener('keydown',keydown);document.addEventListener('keyup',keyup);window.addEventListener('blur',stop);
 return {update(){const s=state();panel.hidden=!allowed();panel.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(b=>b.disabled=s.selectedFielder==null||s.phase!=='IN_PLAY');for(const end of ['striker','nonStriker'])panel.querySelector<HTMLButtonElement>(`[data-field="${end}"]`)!.disabled=s.ballHolder==null;panel.querySelector('[data-field-status]')!.textContent=s.ballHolder!=null?'Ball collected · choose a throw end':s.selectedFielder!=null?`${s.teams[1-s.batting].players.find(p=>p.id===s.fielders[s.selectedFielder!]?.playerId)?.name??`Fielder ${s.selectedFielder+1}`} · WASD to move`:'Automatic chase and return';},dispose(){if(active!==null)clearInterval(active);document.removeEventListener('keydown',keydown);document.removeEventListener('keyup',keyup);window.removeEventListener('blur',stop);panel.remove();}};
}
