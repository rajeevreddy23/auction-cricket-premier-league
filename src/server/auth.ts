import {randomBytes,randomUUID,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import type {Store} from './store.ts';
export interface PublicUser {id:string;name:string;accountType:'guest'|'account'}
export class AuthError extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status;}}
const SESSION_MS=7*24*60*60*1000;
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export function accountName(value:unknown):{display:string;normalized:string}{
 if(typeof value!=='string')throw new AuthError('Username is required');
 const display=value.trim();if(!/^[a-zA-Z0-9_-]{3,32}$/.test(display))throw new AuthError('Username must use 3–32 letters, digits, underscores or hyphens');
 return {display,normalized:display.toLowerCase()};
}
function passwordValue(value:unknown):string {if(typeof value!=='string'||value.length<10||value.length>128)throw new AuthError('Password must contain 10–128 characters');return value;}
function derive(password:string,salt:string):Promise<Buffer>{return new Promise((done,fail)=>scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:32*1024*1024},(error,key)=>error?fail(error):done(key)));}
// Dummy derivation prevents an immediate missing-username response from skipping password work.
const dummySalt='3ca16b4a1fb504412338c31152439e40';
export async function registerAccount(store:Store,nameValue:unknown,passwordInput:unknown,now=Date.now()){
 const name=accountName(nameValue),password=passwordValue(passwordInput);
 if(store.account(name.normalized))throw new AuthError('Username is already registered',409);
 const salt=randomBytes(16).toString('hex'),derived=await derive(password,salt),id=randomUUID();
 const session=issueSession(id,now);
 try{store.transaction(()=>{store.addUser(id,name.display,tokenHash(randomBytes(32).toString('hex')));store.addAccount(id,name.normalized,salt,derived.toString('hex'));store.addSession(session.hash,id,session.expiresAt);});}
 catch(error){if(String(error).includes('UNIQUE'))throw new AuthError('Username is already registered',409);throw error;}
 return {token:session.token,user:{id,name:name.display,accountType:'account' as const},expiresAt:session.expiresAt};
}
export async function loginAccount(store:Store,nameValue:unknown,passwordInput:unknown,now=Date.now()){
 const name=accountName(nameValue),password=passwordValue(passwordInput),account=store.account(name.normalized);
 const derived=await derive(password,account?.salt??dummySalt),expected=account?Buffer.from(account.password_hash,'hex'):Buffer.alloc(64);
 if(!account||expected.length!==derived.length||!timingSafeEqual(derived,expected))throw new AuthError('Invalid username or password',401);
 const session=issueSession(account.id,now);store.addSession(session.hash,account.id,session.expiresAt);store.cleanupSessions(now);
 return {token:session.token,user:{id:account.id,name:account.name,accountType:'account' as const},expiresAt:session.expiresAt};
}
function issueSession(userId:string,now:number){const token=randomBytes(32).toString('base64url');return {token,hash:tokenHash(token),userId,expiresAt:now+SESSION_MS};}
