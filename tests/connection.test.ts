import test from 'node:test';
import assert from 'node:assert/strict';
import {probeBackend,validateBackendOrigin} from '../src/web/connection.ts';
const health={ok:true,runtime:'local-authoritative',storage:'sqlite-wal',activeMatches:2,maxMatches:5};
test('backend origin canonicalizes and rejects mixed content, secret URLs and paths',()=>{
 assert.equal(validateBackendOrigin('https://EXAMPLE.com/','https:'),'https://example.com');
 assert.equal(validateBackendOrigin('','https:'),'');
 assert.equal(validateBackendOrigin('http://localhost:3000','http:'),'http://localhost:3000');
 for(const address of ['ftp://example.com','https://user:pass@example.com','https://example.com/api','https://example.com/?token=private','https://example.com/#x','example.com','http://example.com'])assert.throws(()=>validateBackendOrigin(address,'https:'));
});
test('connection probe checks real health shape without disclosing guest token',async()=>{
 const fake=(async(url:URL,init:RequestInit)=>{assert.equal(url.toString(),'https://example.com/health');assert.equal(init.headers,undefined);assert.equal(init.method,'GET');return Response.json(health);}) as unknown as typeof fetch;
 assert.deepEqual(await probeBackend('https://example.com',fake),health);
});
test('probe distinguishes static frontend, wrong backend, failed response and unreachable service',async()=>{
 const fake=(response:Response)=>(async()=>response) as typeof fetch;
 await assert.rejects(probeBackend('https://example.com',fake(new Response('<html>Dashboard</html>'))),/website without/);
 await assert.rejects(probeBackend('https://example.com',fake(Response.json({ok:true}))),/compatible/);
 await assert.rejects(probeBackend('https://example.com',fake(Response.json({...health,activeMatches:6}))),/compatible/);
 await assert.rejects(probeBackend('https://example.com',fake(new Response('',{status:503}))),/503/);
 await assert.rejects(probeBackend('https://example.com',(async()=>{throw Error('network');}) as typeof fetch),/Cannot reach/);
});
