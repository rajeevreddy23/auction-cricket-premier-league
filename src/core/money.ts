/** Virtual auction currency is stored as integer lakhs. It never represents real payments. */
export const CRORE=100;
export const TEAM_PURSE=120*CRORE;
export const PLAYER_CAP=20*CRORE;
export function formatMoney(lakhs:number):string {
 if(!Number.isSafeInteger(lakhs)||lakhs<0)throw Error('Money must be a nonnegative integer number of lakhs');
 if(lakhs>=CRORE)return `₹${(lakhs/CRORE).toFixed(2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1')} Cr`;
 return `₹${lakhs} L`;
}
/** Parse crore input without binary floating-point multiplication or silent rounding. */
export function parseCrores(raw:string):number {
 const match=/^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(raw.trim());
 if(!match)throw Error('Enter a nonnegative crore amount with at most two decimal places');
 const whole=BigInt(match[1]),fraction=BigInt((match[2]??'').padEnd(2,'0')||'0');
 const lakhs=whole*BigInt(CRORE)+fraction;
 if(lakhs>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Amount exceeds safe integer currency limits');
 return Number(lakhs);
}
