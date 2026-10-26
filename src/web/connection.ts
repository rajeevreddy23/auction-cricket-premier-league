export interface BackendHealth {ok:true;runtime:string;storage:string;activeMatches:number;maxMatches:number}
/** Public probe: it creates no guest account and sends no bearer token. */
export async function probeBackend(origin:string, fetcher:typeof fetch=fetch):Promise<BackendHealth>{
 const url=new URL('/health',origin);
 let response:Response;
 try{response=await fetcher(url,{method:'GET',mode:'cors',cache:'no-store',signal:AbortSignal.timeout(8000)});}catch{throw Error('Cannot reach the match server. Check the HTTPS address, service status and allowed frontend origin.');}
 if(!response.ok)throw Error(`Match server health check failed (${response.status}).`);
 let h:any;try{h=await response.json();}catch{throw Error('This address serves a website without the multiplayer backend. Use the deployed Node server address.');}
 if(h?.ok!==true||h.runtime!=='local-authoritative'||h.storage!=='sqlite-wal'||!Number.isSafeInteger(h.activeMatches)||!Number.isSafeInteger(h.maxMatches)||h.maxMatches<1||h.activeMatches<0||h.activeMatches>h.maxMatches)throw Error('The server did not return a compatible ACPL health response.');
 return h as BackendHealth;
}
export function validateBackendOrigin(raw:string,frontendProtocol:string):string{
 const trimmed=raw.trim();if(!trimmed)return '';
 let u:URL;try{u=new URL(trimmed);}catch{throw Error('Enter a complete server address, such as https://your-server.example.');}
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Enter an HTTP(S) origin without a path, credentials or query.');
 if(frontendProtocol==='https:'&&u.protocol!=='https:')throw Error('This HTTPS website needs an HTTPS match server. An HTTP address cannot connect here.');
 return u.origin;
}
