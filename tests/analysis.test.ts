import test from 'node:test';
import assert from 'node:assert/strict';
import {inningsAnalysis} from '../src/web/game/analysis.ts';
import type {MatchState} from '../src/core/cricket.ts';
test('wide after six legal balls belongs to the next over and innings stay isolated',()=>{const base={innings:1,ball:6,runs:4,total:4,wicket:false,wide:false,x:0,z:0,hit:true};const s={innings:1,deliveries:[base,{...base,wide:true,runs:1,total:5},{...base,innings:2,runs:6}]} as MatchState;const a=inningsAnalysis(s);assert.deepEqual(a.overs,[{over:1,runs:4},{over:2,runs:1}]);assert.equal(a.rows.length,2);assert.equal(a.rates[1].rate,5);});
