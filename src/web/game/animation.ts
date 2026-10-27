import * as THREE from 'three';
export type PlayerMotion='idle'|'ready'|'bowl'|'run'|'field'|'celebrate'|'cover'|'straight'|'pull'|'cut'|'sweep'|'defend';
type Bone='torso'|'leftArm'|'rightArm'|'leftLeg'|'rightLeg'|'head';
type Pose=Partial<Record<Bone,[number,number,number]>>;
const poses:Record<PlayerMotion,Pose>={
 idle:{torso:[0,0,0],leftArm:[0,0,.14],rightArm:[0,0,-.14],leftLeg:[0,0,0],rightLeg:[0,0,0]},
 ready:{torso:[.08,0,0],leftArm:[-.35,0,.45],rightArm:[-.5,0,-.35],leftLeg:[0,0,.08],rightLeg:[0,0,-.08]},
 bowl:{torso:[-.18,0,.08],leftArm:[-1.4,0,.18],rightArm:[1.15,0,-.35],leftLeg:[.42,0,.12],rightLeg:[-.38,0,-.08]},
 run:{torso:[.14,0,0],leftArm:[-.75,0,.22],rightArm:[.75,0,-.22],leftLeg:[.82,0,0],rightLeg:[-.82,0,0]},
 field:{torso:[.38,0,0],leftArm:[-.55,0,.6],rightArm:[-.55,0,-.6],leftLeg:[.25,0,.12],rightLeg:[-.25,0,-.12]},
 celebrate:{torso:[-.12,0,0],leftArm:[-2.25,0,.3],rightArm:[-2.25,0,-.3],leftLeg:[0,0,.08],rightLeg:[0,0,-.08]},
 cover:{torso:[.25,.22,0],leftArm:[-1.05,.15,.82],rightArm:[-1.32,-.2,-.55],leftLeg:[.25,0,.18],rightLeg:[-.16,0,-.08]},
 straight:{torso:[.22,0,0],leftArm:[-1.38,0,.18],rightArm:[-1.25,0,-.18],leftLeg:[.18,0,.08],rightLeg:[-.12,0,-.08]},
 pull:{torso:[.08,-.75,0],leftArm:[-.75,-.45,.95],rightArm:[-.72,-.55,-.75],leftLeg:[-.2,0,.15],rightLeg:[.28,0,-.1]},
 cut:{torso:[.18,.62,0],leftArm:[-.48,.42,.88],rightArm:[-.62,.55,-.82],leftLeg:[.08,0,.12],rightLeg:[-.08,0,-.12]},
 sweep:{torso:[.7,-.35,0],leftArm:[-.72,-.25,.82],rightArm:[-.85,-.35,-.68],leftLeg:[1.05,0,.2],rightLeg:[-.35,0,-.12]},
 defend:{torso:[.28,0,0],leftArm:[-.82,0,.28],rightArm:[-.9,0,-.22],leftLeg:[.2,0,.1],rightLeg:[-.12,0,-.08]}
};
export class PlayerAnimator{
 private bones=new Map<Bone,THREE.Object3D>();private motion:PlayerMotion='idle';private previous:PlayerMotion='idle';private changedAt=0;
 constructor(root:THREE.Group){root.traverse(part=>{const bone=part.userData.bone as Bone|undefined;if(bone)this.bones.set(bone,part);});}
 set(motion:PlayerMotion,now:number){if(motion===this.motion)return;this.previous=this.motion;this.motion=motion;this.changedAt=now;}
 update(now:number){const blend=Math.min(1,(now-this.changedAt)/140),cycle=now*.008;const from=poses[this.previous],to=poses[this.motion];for(const [bone,obj] of this.bones){const a=from[bone]??[0,0,0],b=to[bone]??[0,0,0];obj.rotation.set(THREE.MathUtils.lerp(a[0],b[0],blend),THREE.MathUtils.lerp(a[1],b[1],blend),THREE.MathUtils.lerp(a[2],b[2],blend));if(this.motion==='bowl'&&bone==='rightArm'){const delivery=Math.min(1,Math.max(0,(now-this.changedAt)/650));obj.rotation.x=-Math.PI*2*delivery;}if(this.motion==='run'||this.motion==='field'){const phase=bone==='leftArm'||bone==='rightLeg'?Math.PI:0;if(bone.includes('Arm')||bone.includes('Leg'))obj.rotation.x+=Math.sin(cycle+phase)*.42;}}}
}
