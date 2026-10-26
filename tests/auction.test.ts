import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAuction,createPlayers,createTeam,nominate,placeBid,closeLot,minimumBid,validateSquad,selectXI,validateRoster} from '../src/core/auction.ts';
function setup(){const players=createPlayers();const teams=[createTeam('a','Comets','u1',10000),createTeam('b','Falcons','u2',10000)];const auction=createAuction({lotDurationMs:1000,extensionMs:500});return {players,teams,auction};}
test('fictional player identity is stable with complete attributes',()=>{const ps=createPlayers();assert.equal(ps.length,160);assert.equal(new Set(ps.map(p=>p.id)).size,160);assert.deepEqual(ps,createPlayers());assert.equal(ps.filter(p=>p.role==='WICKETKEEPER').length,20);});
test('ordered bids, minimum increment, authoritative extension and sale',()=>{const {players,teams,auction}=setup();nominate(auction,players,teams,players[0].id,0);placeBid(auction,players,teams,'a',100,'request-1',100);assert.equal(minimumBid(auction,players),200);placeBid(auction,players,teams,'b',200,'request-2',900);assert.equal(auction.current!.deadline,1400);assert.throws(()=>closeLot(auction,players,teams,1399),/timer/);closeLot(auction,players,teams,1400);assert.equal(teams[1].purse,9800);assert.deepEqual(teams[1].roster,[players[0].id]);assert.equal(auction.current!.status,'SOLD');});
test('duplicate settlement and duplicate request cannot double charge',()=>{const {players,teams,auction}=setup();nominate(auction,players,teams,players[0].id,0);placeBid(auction,players,teams,'a',100,'request-1',100);placeBid(auction,players,teams,'a',100,'request-1',100);assert.equal(auction.current!.bids.length,1);closeLot(auction,players,teams,1000);closeLot(auction,players,teams,1500);assert.equal(teams[0].purse,9900);assert.equal(teams[0].roster.length,1);assert.throws(()=>nominate(auction,players,teams,players[0].id,2000),/owned/);});
test('conflicting replay, unknown team, low bids and expired inputs are rejected',()=>{const {players,teams,auction}=setup();nominate(auction,players,teams,players[0].id,0);placeBid(auction,players,teams,'a',100,'request-1',100);assert.throws(()=>placeBid(auction,players,teams,'b',200,'request-1',110),/replay/);assert.throws(()=>placeBid(auction,players,teams,'z',200,'request-2',110),/Unknown/);assert.throws(()=>placeBid(auction,players,teams,'b',101,'request-2',110),/minimum/);assert.throws(()=>placeBid(auction,players,teams,'b',200,'request-2',1000),/expired/);assert.equal(auction.current!.bids.length,1);});
test('purse reserve prevents impossible minimum squad and negative budgets',()=>{const {players,teams,auction}=setup();teams[0].purse=1100;nominate(auction,players,teams,players[0].id,0);assert.throws(()=>placeBid(auction,players,teams,'a',101,'request-1',0),/reserve/);placeBid(auction,players,teams,'a',100,'request-1',0);closeLot(auction,players,teams,1000);assert.equal(teams[0].purse,1000);assert.throws(()=>placeBid(auction,players,teams,'b',NaN,'request-3',0),/integer/);});
test('max roster and overseas limits enforce before accepting bid',()=>{const {players,teams,auction}=setup();auction.rules.maxOverseas=0;nominate(auction,players,teams,players[4].id,0);assert.throws(()=>placeBid(auction,players,teams,'a',500,'request-1',0),/Overseas/);teams[0].roster=players.slice(20,38).map(p=>p.id);assert.throws(()=>placeBid(auction,players,teams,'a',500,'request-2',0),/full/);});
test('unsold players may reenter auction, owned players cannot',()=>{const {players,teams,auction}=setup();nominate(auction,players,teams,players[0].id,0);assert.throws(()=>nominate(auction,players,teams,players[1].id,1),/current/);closeLot(auction,players,teams,1000);assert.equal(auction.current!.status,'UNSOLD');nominate(auction,players,teams,players[0].id,1001);assert.equal(auction.lots.length,2);});
test('valid purchased XI selects captain, keeper and confirms readiness atomically',()=>{const {players,teams}=setup();const team=teams[0];team.roster=players.slice(0,11).map(p=>p.id);assert.deepEqual(validateRoster(team,players),[]);selectXI(team,players,team.roster,players[1].id,players[0].id);assert.equal(team.ready,true);assert.deepEqual(validateSquad(team,players),[]);const old=structuredClone(team);assert.throws(()=>selectXI(team,players,[...team.xi.slice(0,10),players[99].id],players[1].id,players[0].id),/unowned/);assert.deepEqual(team,old);});
test('duplicate XI, wrong keeper, missing bowling eligibility reject',()=>{const {players,teams}=setup();const team=teams[0];team.roster=players.slice(0,11).map(p=>p.id);assert.throws(()=>selectXI(team,players,Array(11).fill(players[0].id),players[0].id,players[0].id),/Duplicate/);assert.throws(()=>selectXI(team,players,team.roster,players[1].id,players[1].id),/wicketkeeper/);const batters=players.filter(p=>p.role==='BATTER').slice(0,10);team.roster=[players[0].id,...batters.map(p=>p.id)];assert.throws(()=>selectXI(team,players,team.roster,players[0].id,players[0].id),/bowling/);});
test('same-tick competition is serialized; second equal bid fails',()=>{const {players,teams,auction}=setup();nominate(auction,players,teams,players[0].id,0);placeBid(auction,players,teams,'a',100,'request-1',100);assert.throws(()=>placeBid(auction,players,teams,'b',100,'request-2',100),/minimum/);assert.equal(auction.current!.highestTeamId,'a');});
test('invalid setup is rejected',()=>{assert.throws(()=>createAuction({minSquad:3}),/limits/);assert.throws(()=>createTeam('a','A','u',-1),/identity/);assert.throws(()=>createAuction({lotDurationMs:1}),/duration/);});

test('JSON persistence keeps current and history lot state consistent',()=>{const {players,teams,auction}=setup();nominate(auction,players,teams,players[0].id,0);const restored=JSON.parse(JSON.stringify(auction));placeBid(restored,players,teams,'a',100,'request-1',100);assert.equal(restored.lots[0].highestBid,100);const restoredAgain=JSON.parse(JSON.stringify(restored));closeLot(restoredAgain,players,teams,1000);assert.equal(restoredAgain.lots[0].status,'SOLD');assert.equal(restoredAgain.current.status,'SOLD');});

test('new teams receive a ₹120 Cr virtual purse by default',()=>{
 assert.equal(createTeam('default','Premier XI','owner').purse,12000);
 assert.equal(createAuction().rules.maxPlayerPrice,2000);
});
test('₹20 Cr ceiling is authoritative for bids, nomination and configured rules',()=>{
 const {players,teams,auction}=setup();teams[0].purse=12000;
 nominate(auction,players,teams,players[0].id,0);
 assert.throws(()=>placeBid(auction,players,teams,'a',2001,'above-cap',0),/cannot exceed/);
 placeBid(auction,players,teams,'a',2000,'exact-cap',0);
 assert.equal(auction.current!.highestBid,2000);
 assert.throws(()=>minimumBid(auction,players),/maximum/);
 closeLot(auction,players,teams,1000);assert.equal(teams[0].purse,10000);assert.deepEqual(teams[0].roster,[players[0].id]);
 players[1].basePrice=2001;assert.throws(()=>nominate(auction,players,teams,players[1].id,2000),/maximum/);
 assert.throws(()=>createAuction({maxPlayerPrice:2001}),/20 Cr/);
 assert.throws(()=>createAuction({minimumPlayerPrice:100,maxPlayerPrice:99}),/minimum/);
});
test('final increment reaches the cap and restored auctions cannot bypass it',()=>{
 const {players,teams,auction}=setup();nominate(auction,players,teams,players[0].id,0);
 placeBid(auction,players,teams,'a',1900,'near-cap1',100);assert.equal(minimumBid(auction,players),2000);
 const restored=JSON.parse(JSON.stringify(auction));delete restored.rules.maxPlayerPrice;
 assert.throws(()=>placeBid(restored,players,teams,'b',2001,'above-cap2',200),/cannot exceed/);
 placeBid(restored,players,teams,'b',2000,'exact-cap2',200);const again=JSON.parse(JSON.stringify(restored));
 closeLot(again,players,teams,1000);assert.equal(teams[1].purse,8000);assert.equal(again.current.status,'SOLD');
});
test('ceiling and minimum-roster reserve hold across multiple purchases',()=>{
 const {players,teams,auction}=setup();teams[0].purse=12000;
 for(let i=0;i<5;i++){const start=i*2000;nominate(auction,players,teams,players[i].id,start);placeBid(auction,players,teams,'a',2000,`cap-lot-${i}`,start);closeLot(auction,players,teams,start+1000);}
 assert.equal(teams[0].purse,2000);assert.equal(teams[0].roster.length,5);
 nominate(auction,players,teams,players[5].id,10000);
 assert.throws(()=>placeBid(auction,players,teams,'a',2000,'reserve-six',10000),/reserve/);
 assert.equal(teams[0].purse,2000);
});
test('sale rechecks serialized winning amount rather than trusting a corrupted lot',()=>{
 const {players,teams,auction}=setup();nominate(auction,players,teams,players[0].id,0);placeBid(auction,players,teams,'a',2000,'valid-cap',0);
 const corrupted=JSON.parse(JSON.stringify(auction));corrupted.lots[0].highestBid=2001;corrupted.current.highestBid=2001;
 assert.throws(()=>closeLot(corrupted,players,teams,1000),/maximum/);assert.equal(teams[0].purse,10000);assert.equal(teams[0].roster.length,0);
});
