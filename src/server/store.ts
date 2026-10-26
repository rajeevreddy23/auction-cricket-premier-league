import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type {PublicUser} from './auth.ts';

/** Synchronous transactions intentionally prevent interleaved read-modify-write bids. */
export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), {recursive:true});
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,token_hash TEXT UNIQUE NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS tournaments(id TEXT PRIMARY KEY,body TEXT NOT NULL,updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY,tournament_id TEXT NOT NULL,fixture_id TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL,updated_at INTEGER NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS match_fixture ON matches(tournament_id,fixture_id);
      CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,tournament_id TEXT,action TEXT NOT NULL,at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS schema_versions(version INTEGER PRIMARY KEY,applied_at INTEGER NOT NULL);
      INSERT OR IGNORE INTO schema_versions VALUES(1,unixepoch()*1000);
      CREATE TABLE IF NOT EXISTS account_credentials(user_id TEXT PRIMARY KEY REFERENCES users(id),username_normalized TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS account_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS session_user ON account_sessions(user_id);
      INSERT OR IGNORE INTO schema_versions VALUES(2,unixepoch()*1000);`);
  }
  transaction<T>(fn:()=>T):T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value=fn(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  user(hash:string,now=Date.now()):PublicUser|undefined {
    const account=this.db.prepare("SELECT u.id,u.name,'account' AS accountType FROM account_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").get(hash,now);
    if(account)return account as unknown as PublicUser;
    return this.db.prepare("SELECT u.id,u.name,'guest' AS accountType FROM users u LEFT JOIN account_credentials a ON a.user_id=u.id WHERE u.token_hash=? AND a.user_id IS NULL").get(hash) as unknown as PublicUser|undefined;
  }
  account(username:string) {return this.db.prepare('SELECT u.id,u.name,a.salt,a.password_hash FROM account_credentials a JOIN users u ON u.id=a.user_id WHERE a.username_normalized=?').get(username) as {id:string;name:string;salt:string;password_hash:string}|undefined;}
  addAccount(userId:string,username:string,salt:string,passwordHash:string){this.db.prepare('INSERT INTO account_credentials VALUES(?,?,?,?)').run(userId,username,salt,passwordHash);}
  addSession(hash:string,userId:string,expiresAt:number){this.db.prepare('INSERT INTO account_sessions VALUES(?,?,?)').run(hash,userId,expiresAt);}
  revokeSession(hash:string){this.db.prepare('DELETE FROM account_sessions WHERE token_hash=?').run(hash);this.db.prepare("UPDATE users SET token_hash='revoked-' || id WHERE token_hash=? AND id NOT IN (SELECT user_id FROM account_credentials)").run(hash);}
  cleanupSessions(now=Date.now()){this.db.prepare('DELETE FROM account_sessions WHERE expires_at<=?').run(now);}
  addUser(id:string,name:string,hash:string) { this.db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,name,hash,Date.now()); }
  get<T>(id:string):T|undefined { const row=this.db.prepare('SELECT body FROM tournaments WHERE id=?').get(id); return row?JSON.parse(String(row.body)):undefined; }
  list<T>():T[] { return this.db.prepare('SELECT body FROM tournaments ORDER BY updated_at DESC').all().map(row=>JSON.parse(String(row.body))); }
  save(value:{id:string}) { this.db.prepare('INSERT INTO tournaments VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at').run(value.id,JSON.stringify(value),Date.now()); }
  match(id:string) { const row=this.db.prepare('SELECT body FROM matches WHERE id=?').get(id); return row?JSON.parse(String(row.body)):undefined; }
  activeMatches() { return this.db.prepare("SELECT body FROM matches WHERE status!='completed'").all().map(row=>JSON.parse(String(row.body))); }
  saveMatch(value:{id:string,tournamentId:string,fixtureId:string,status:string}) { this.db.prepare('INSERT INTO matches VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,status=excluded.status,updated_at=excluded.updated_at').run(value.id,value.tournamentId,value.fixtureId,JSON.stringify(value),value.status,Date.now()); }
  audit(userId:string,tournamentId:string|null,action:string) { this.db.prepare('INSERT INTO audit(user_id,tournament_id,action,at) VALUES(?,?,?,?)').run(userId,tournamentId,action,Date.now()); }
  close() { this.db.close(); }
}
