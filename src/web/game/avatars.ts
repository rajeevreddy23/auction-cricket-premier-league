export interface FacePreset {id:string;name:string;head:[number,number,number];nose:number;jaw:number;defaultHair:HairStyle}
export type HairStyle='short'|'fade'|'curly'|'swept'|'bald';
export const SKIN_TONES=['#6f3f2b','#8b5438','#a96948','#bd7f59','#d39a72','#e2b08b','#efc6a2'];
export const HAIR_STYLES:HairStyle[]=['short','fade','curly','swept','bald'];
const names=['Arjun','Dev','Kabir','Rohan','Vihaan','Ayaan','Ishaan','Nikhil','Manav','Reyansh','Aditya','Kiran','Varun','Neel','Samar','Yash','Aarav','Dhruv','Omkar','Zayan'];
export const FACE_PRESETS:FacePreset[]=names.map((name,index)=>({id:`face-${String(index+1).padStart(2,'0')}`,name:`${name} ${String(index+1).padStart(2,'0')}`,head:[.9+(index%4)*.045,.94+(index%5)*.025,.91+(index%3)*.05],nose:.035+(index%4)*.012,jaw:.88+(index%6)*.035,defaultHair:HAIR_STYLES[index%HAIR_STYLES.length]}));
export interface AvatarIdentity {faceId:string;skin:string;hair:HairStyle;beard:boolean;name:string;number:number}
export const DEFAULT_AVATAR:AvatarIdentity={faceId:'face-01',skin:SKIN_TONES[3],hair:'short',beard:false,name:'Academy Captain',number:18};
