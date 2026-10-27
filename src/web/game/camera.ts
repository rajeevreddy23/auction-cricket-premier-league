import * as THREE from 'three';
export interface CameraContext {ball:THREE.Vector3;phase:string;battingEnd:number;time:number}
export interface CameraProfile {id:string;name:string;position:[number,number,number];look:[number,number,number];followBall?:boolean}
export const CAMERA_PROFILES:CameraProfile[]=[
 {id:'batter',name:'Behind Batter',position:[0,5.3,20],look:[0,.8,0]},
 {id:'bowler',name:'Behind Bowler',position:[0,5.8,-25],look:[0,.8,5]},
 {id:'broadcast',name:'Broadcast High',position:[14,9,17],look:[0,.5,0]},
 {id:'slip',name:'Slip Camera',position:[-8,3.2,13],look:[0,1,6]},
 {id:'umpire',name:'Umpire View',position:[1.1,2.2,-12],look:[0,1,7]},
 {id:'stump',name:'Stump Camera',position:[.32,.52,9.25],look:[0,.65,-5]},
 {id:'cover',name:'Cover Camera',position:[30,7,8],look:[0,.8,4],followBall:true},
 {id:'midwicket',name:'Midwicket Camera',position:[-31,7,8],look:[0,.8,4],followBall:true},
 {id:'boundary',name:'Boundary Camera',position:[0,6,52],look:[0,2,5],followBall:true},
 {id:'drone',name:'Drone',position:[-32,24,35],look:[0,0,0],followBall:true},
 {id:'spider',name:'Spidercam',position:[8,17,4],look:[0,.5,3],followBall:true},
 {id:'pitch',name:'Pitch Top',position:[0,28,0],look:[0,0,0],followBall:true}
];
export function automaticCameraIndex(phase:string,ballZ:number,time:number){if(phase==='READY')return 1;if(phase==='DELIVERY')return 0;if(phase==='IN_PLAY')return Math.floor(time*1.2)%2?9:10;return 2;}
export function applyCamera(camera:THREE.PerspectiveCamera,profile:CameraProfile,context:CameraContext,instant=false){const target=new THREE.Vector3(...profile.position);if(profile.followBall){target.x+=context.ball.x*.12;target.z+=context.ball.z*.06;}camera.position.lerp(target,instant?1:.09);const look=profile.followBall?context.ball:new THREE.Vector3(...profile.look);camera.lookAt(look.x,Math.max(.25,look.y),look.z);}
