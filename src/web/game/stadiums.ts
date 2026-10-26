export type StadiumId='harbour'|'highland'|'desert';
export type PitchType='green'|'dusty'|'flat';
export interface StadiumProfile {id:StadiumId;name:string;stand:[string,string];accent:string;grass:[string,string];fog:string;architecture:'bowl'|'terrace'|'arena'}
export const STADIUMS:StadiumProfile[]=[
 {id:'harbour',name:'Harbour Crown Ground',stand:['#172d43','#28445c'],accent:'#d5f65a',grass:['#487c3c','#3b7037'],fog:'#a2c7d3',architecture:'bowl'},
 {id:'highland',name:'Highland Pavilion',stand:['#3d254d','#67406b'],accent:'#f1c75b',grass:['#4d7c3f','#396c36'],fog:'#b7cad2',architecture:'terrace'},
 {id:'desert',name:'Desert Star Arena',stand:['#603c2d','#a26b42'],accent:'#5ee8d2',grass:['#4a7435','#38632f'],fog:'#d8b68e',architecture:'arena'}
];
export const PITCHES:Record<PitchType,{name:string;color:string;detail:string;bounce:number;pace:number}>={
 green:{name:'Green',color:'#9aa879',detail:'More carry and seam-friendly bounce',bounce:.78,pace:1.03},
 dusty:{name:'Dusty',color:'#b68b58',detail:'Lower bounce with stronger turn',bounce:.56,pace:.94},
 flat:{name:'Dead / Flat',color:'#d2bb8d',detail:'Even bounce and batter-friendly pace',bounce:.66,pace:1}
};
