import {TEAM_PURSE,PLAYER_CAP,formatMoney} from './money.ts';
/** Serializable authoritative auction domain. Call inside the persistence transaction.
 * All prices are integer virtual lakhs (100 lakhs = 1 crore). Never accept `now` from clients. */
export type PlayerRole = 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKETKEEPER';
export interface Player {
  id:string; name:string; role:PlayerRole; overseas:boolean; basePrice:number;
  battingStyle:'RIGHT'|'LEFT'; bowlingStyle:'FAST'|'OFF_SPIN'|'LEG_SPIN';
  batting:number; bowling:number; fielding:number; power:number; timing:number;
  accuracy:number; agility:number; stamina:number; wicketkeeping:number;
  specialAbilities:string[]; animationProfile:string; appearanceRef:string;
}
export interface Team {
  id:string; name:string; ownerId:string; purse:number; roster:string[]; xi:string[];
  captainId:string|null; keeperId:string|null; ready:boolean;
}
export interface AuctionRules {
  minSquad:number; maxSquad:number; maxOverseas:number; maxPlayingXIOverseas:number;
  minBowlers:number; lotDurationMs:number; extensionMs:number;
  minRetainedPurse:number; minimumPlayerPrice:number; maxPlayerPrice?:number;
}
export interface Bid {teamId:string; amount:number; at:number; requestId:string}
export interface Lot {
  id:string; playerId:string; status:'OPEN'|'SOLD'|'UNSOLD'; highestBid:number;
  highestTeamId:string|null; deadline:number; bids:Bid[];
}
export interface Auction {
  rules:AuctionRules; current:Lot|null; lots:Lot[];
  requests:Record<string,{teamId:string;playerId:string;amount:number}>;
}
const DEFAULT_RULES:AuctionRules = {
  minSquad:11,maxSquad:18,maxOverseas:8,maxPlayingXIOverseas:4,minBowlers:4,
  lotDurationMs:15000,extensionMs:5000,minRetainedPurse:0,minimumPlayerPrice:100,maxPlayerPrice:PLAYER_CAP,
};
function requireRule(condition:unknown,message:string):asserts condition {
  if (!condition) throw new Error(message);
}
function int(value:number,min=0):boolean {return Number.isSafeInteger(value) && value>=min;}
export function createAuction(rules:Partial<AuctionRules>={}):Auction {
  const r={...DEFAULT_RULES,...rules};
  for(const [key,value] of Object.entries(r)) requireRule(int(value),`Invalid auction rule: ${key}`);
  requireRule(r.minSquad>=11 && r.maxSquad>=r.minSquad && r.maxSquad<=50,'Invalid squad limits');
  requireRule(r.maxPlayingXIOverseas<=r.maxOverseas && r.maxPlayingXIOverseas<=11,'Invalid overseas limits');
  requireRule(r.minBowlers<=10 && r.minBowlers>=1,'Invalid bowling requirement');
  requireRule(r.lotDurationMs>=100 && r.extensionMs>=100 && r.minimumPlayerPrice>0,'Invalid auction duration or price');
  requireRule(r.maxPlayerPrice!==undefined && r.maxPlayerPrice>=r.minimumPlayerPrice && r.maxPlayerPrice<=PLAYER_CAP,'Maximum player price cannot exceed ₹20 Cr or be below the minimum price');
  return {rules:r,current:null,lots:[],requests:{}};
}
export function createTeam(id:string,name:string,ownerId:string,purse=TEAM_PURSE):Team {
  requireRule(!!id && !!ownerId && name.trim().length>=2 && name.length<=60,'Invalid team identity');
  requireRule(int(purse,1),'Purse must be a positive safe integer');
  return {id,name:name.trim(),ownerId,purse,roster:[],xi:[],captainId:null,keeperId:null,ready:false};
}
export function createPlayers(count=160):Player[] {
  requireRule(int(count,1)&&count<=10000,'Invalid player count');
  const first=['Aarav','Vihaan','Arjun','Kabir','Rohan','Dev','Ishaan','Neel','Samir','Yash','Kian','Reyan','Advik','Dhruv','Vivaan','Shaurya'];
  const last=['Rao','Mehta','Shah','Iyer','Sen','Kapoor','Desai','Malik','Nair','Reddy'];
  return Array.from({length:count},(_,i)=>{
    const role:PlayerRole=i%8===0?'WICKETKEEPER':i%4===1?'ALL_ROUNDER':i%4===2?'BOWLER':'BATTER';
    const score=(seed:number)=>45+((i*17+seed*13)%50);
    return {id:`player-${i+1}`,name:`${first[i%first.length]} ${last[Math.floor(i/first.length)%last.length]}${i>=160?` ${Math.floor(i/160)+1}`:''}`,
      role,overseas:i%5===4,basePrice:100+(i%5)*100,
      battingStyle:i%3===0?'LEFT':'RIGHT',bowlingStyle:i%3===0?'OFF_SPIN':i%3===1?'FAST':'LEG_SPIN',
      batting:role==='BOWLER'?40+ i%25:score(1),bowling:role==='BOWLER'||role==='ALL_ROUNDER'?score(2):25+i%30,
      fielding:score(3),power:score(4),timing:score(5),accuracy:score(6),agility:score(7),stamina:score(8),
      wicketkeeping:role==='WICKETKEEPER'?score(9):15,specialAbilities:[],
      animationProfile:'procedural-v1',appearanceRef:`original-procedural-${i%8}`};
  });
}
export function bidIncrement(amount:number):number {return amount<1000?100:amount<5000?250:500;}
export function playerPriceCap(a:Auction):number {
  const configured=a.rules.maxPlayerPrice??PLAYER_CAP;
  requireRule(int(configured,1)&&configured<=PLAYER_CAP,'Invalid maximum player price');
  return configured;
}
export function minimumBid(a:Auction,players:Player[]):number {
  requireRule(a.current?.status==='OPEN','No open auction lot');
  const player=players.find(p=>p.id===a.current!.playerId);
  requireRule(player,'Player not found');
  const cap=playerPriceCap(a);
  requireRule(player.basePrice<=cap,'Player base price exceeds the maximum player price');
  requireRule(!a.current.highestTeamId||a.current.highestBid<cap,`Player has reached the ${formatMoney(cap)} maximum`);
  return a.current.highestTeamId ? Math.min(cap,a.current.highestBid+bidIncrement(a.current.highestBid)) : player.basePrice;
}
function owned(teams:Team[],playerId:string):boolean {return teams.some(t=>t.roster.includes(playerId));}
export function nominate(a:Auction,players:Player[],teams:Team[],playerId:string,now=Date.now()):void {
  requireRule(int(now),'Invalid server time');
  requireRule(!a.current || a.current.status!=='OPEN','Close current lot before nominating another');
  const p=players.find(p=>p.id===playerId);
  requireRule(p && int(p.basePrice,a.rules.minimumPlayerPrice),'Invalid player or base price');
  requireRule(p.basePrice<=playerPriceCap(a),'Player base price exceeds the maximum player price');
  requireRule(!owned(teams,playerId),'Player is already owned');
  const lot:Lot={id:`lot-${a.lots.length+1}`,playerId,status:'OPEN',highestBid:0,highestTeamId:null,deadline:now+a.rules.lotDurationMs,bids:[]};
  a.current=lot;a.lots.push(lot);
}
// Reattach the current lot after JSON/database round trips, which do not preserve object aliases.
function currentLot(a:Auction):Lot|null {
  if(!a.current) return null;
  const persisted=a.lots.find(l=>l.id===a.current!.id);
  requireRule(persisted,'Current lot missing from auction history');
  a.current=persisted;return persisted;
}
export function placeBid(a:Auction,players:Player[],teams:Team[],teamId:string,amount:number,requestId:string,now=Date.now()):void {
  requireRule(int(now),'Invalid server time');
  requireRule(typeof requestId==='string' && /^[a-zA-Z0-9_-]{8,100}$/.test(requestId),'Invalid bid request ID');
  requireRule(int(amount,1),'Bid must use positive integer currency');
  requireRule(amount<=playerPriceCap(a),`Player bid cannot exceed ${formatMoney(playerPriceCap(a))}`);
  const prior=Object.hasOwn(a.requests,requestId)?a.requests[requestId]:undefined;
  if(prior){
    requireRule(prior.teamId===teamId && prior.amount===amount && prior.playerId===a.current?.playerId,'Bid request replay conflict');
    return;
  }
  const lot=currentLot(a);
  requireRule(lot?.status==='OPEN','No open auction lot');
  requireRule(now<lot.deadline,'Auction lot has expired');
  const team=teams.find(t=>t.id===teamId), p=players.find(p=>p.id===lot.playerId);
  requireRule(team && p,'Unknown team or player');
  requireRule(!owned(teams,p.id),'Player is already owned');
  requireRule(lot.highestTeamId!==teamId,'Team already leads this lot');
  requireRule(amount>=minimumBid(a,players),'Bid is below required minimum');
  requireRule(team.roster.length<a.rules.maxSquad,'Squad is full');
  const ownedPlayers=team.roster.map(id=>players.find(p=>p.id===id));
  requireRule(ownedPlayers.every(Boolean),'Roster contains an unknown player');
  requireRule(!p.overseas || ownedPlayers.filter(p=>p?.overseas).length<a.rules.maxOverseas,'Overseas squad limit reached');
  const slotsStillRequired=Math.max(0,a.rules.minSquad-team.roster.length-1);
  const reserve=slotsStillRequired*a.rules.minimumPlayerPrice+a.rules.minRetainedPurse;
  requireRule(team.purse-amount>=reserve,'Insufficient purse after required squad reserve');
  lot.highestBid=amount;lot.highestTeamId=teamId;
  lot.deadline=Math.max(lot.deadline,now+a.rules.extensionMs);
  lot.bids.push({teamId,amount,at:now,requestId});
  Object.defineProperty(a.requests,requestId,{value:{teamId,playerId:p.id,amount},enumerable:true,writable:true,configurable:true});
}
export function closeLot(a:Auction,players:Player[],teams:Team[],now=Date.now()):Lot {
  requireRule(int(now),'Invalid server time');
  const lot=currentLot(a);
  requireRule(lot,'No auction lot');
  if(lot.status!=='OPEN') return lot;
  requireRule(now>=lot.deadline,'Auction timer has not expired');
  if(!lot.highestTeamId){lot.status='UNSOLD';return lot;}
  const team=teams.find(t=>t.id===lot.highestTeamId),p=players.find(p=>p.id===lot.playerId);
  requireRule(team && p,'Winning team or player not found');
  requireRule(int(lot.highestBid,1)&&lot.highestBid<=playerPriceCap(a),'Winning bid exceeds maximum player price');
  requireRule(!owned(teams,p.id),'Player already purchased');
  requireRule(team.purse>=lot.highestBid,'Winning team no longer has sufficient purse');
  requireRule(team.roster.length<a.rules.maxSquad,'Winning team squad full');
  team.purse-=lot.highestBid;team.roster.push(p.id);team.ready=false;
  lot.status='SOLD';
  return lot;
}
export function validateRoster(team:Team,players:Player[],rules:Partial<AuctionRules>={}):string[] {
  const r={...DEFAULT_RULES,...rules};const errors:string[]=[];
  if(team.roster.length<r.minSquad) errors.push(`Squad needs at least ${r.minSquad} purchased players`);
  if(team.roster.length>r.maxSquad) errors.push(`Squad exceeds ${r.maxSquad} players`);
  if(new Set(team.roster).size!==team.roster.length) errors.push('Duplicate roster player');
  const ps=team.roster.map(id=>players.find(p=>p.id===id));
  if(ps.some(p=>!p)) errors.push('Roster includes unknown player');
  if(ps.filter(p=>p?.overseas).length>r.maxOverseas) errors.push('Overseas squad limit exceeded');
  if(!ps.some(p=>p?.role==='WICKETKEEPER')) errors.push('Squad needs a wicketkeeper');
  if(ps.filter(p=>p?.role==='BOWLER'||p?.role==='ALL_ROUNDER').length<r.minBowlers) errors.push(`Squad needs ${r.minBowlers} bowling options`);
  return errors;
}
export function validateSquad(team:Team,players:Player[],rules:Partial<AuctionRules>={}):string[] {
  const r={...DEFAULT_RULES,...rules};const errors=validateRoster(team,players,r);
  if(team.xi.length!==11) errors.push('Playing XI must contain exactly eleven players');
  if(new Set(team.xi).size!==team.xi.length) errors.push('Duplicate Playing XI player');
  if(team.xi.some(id=>!team.roster.includes(id))) errors.push('Playing XI contains unowned player');
  if(!team.captainId || !team.xi.includes(team.captainId)) errors.push('Captain must be in Playing XI');
  if(!team.keeperId || !team.xi.includes(team.keeperId) || players.find(p=>p.id===team.keeperId)?.role!=='WICKETKEEPER') errors.push('Select an eligible wicketkeeper in Playing XI');
  const xi=team.xi.map(id=>players.find(p=>p.id===id));
  if(xi.filter(p=>p?.overseas).length>r.maxPlayingXIOverseas) errors.push('Playing XI overseas limit exceeded');
  if(xi.filter(p=>p?.role==='BOWLER'||p?.role==='ALL_ROUNDER').length<r.minBowlers) errors.push(`Playing XI needs ${r.minBowlers} bowling options`);
  return errors;
}
export function selectXI(team:Team,players:Player[],playerIds:string[],captainId:string,keeperId:string,rules:Partial<AuctionRules>={}):void {
  requireRule(Array.isArray(playerIds) && playerIds.every(p=>typeof p==='string'),'Invalid Playing XI');
  const candidate={...team,xi:[...playerIds],captainId,keeperId,ready:true};
  const errors=validateSquad(candidate,players,rules);
  requireRule(!errors.length,errors.join('; '));
  Object.assign(team,candidate);
}
