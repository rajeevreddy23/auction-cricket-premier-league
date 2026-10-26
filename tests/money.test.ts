import test from 'node:test';
import assert from 'node:assert/strict';
import {CRORE,TEAM_PURSE,PLAYER_CAP,formatMoney,parseCrores} from '../src/core/money.ts';
test('virtual purse and player caps use integer lakh units',()=>{
 assert.equal(CRORE,100);assert.equal(TEAM_PURSE,12000);assert.equal(PLAYER_CAP,2000);
 assert.equal(formatMoney(TEAM_PURSE),'₹120 Cr');assert.equal(formatMoney(PLAYER_CAP),'₹20 Cr');
 assert.equal(formatMoney(25),'₹25 L');assert.equal(formatMoney(125),'₹1.25 Cr');assert.equal(formatMoney(130),'₹1.3 Cr');assert.equal(formatMoney(0),'₹0 L');
});
test('crore entry is parsed exactly to integer lakhs without rounding',()=>{
 assert.equal(parseCrores('120'),12000);assert.equal(parseCrores('20.01'),2001);assert.equal(parseCrores('0.25'),25);assert.equal(parseCrores(' 1.2 '),120);
 for(const s of ['-1','NaN','1.001','1e3','','01','Infinity','9007199254740993'])assert.throws(()=>parseCrores(s));
 for(const n of [-1,NaN,Infinity,1.1])assert.throws(()=>formatMoney(n));
});
