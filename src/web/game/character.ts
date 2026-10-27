import * as THREE from 'three';

/** Original procedural rig: limbs rotate at joints and carry their gloves/pads. */
export function createCricketer(color:string,material:(color:string)=>THREE.MeshStandardMaterial,gear:'batter'|'fielder'|'keeper'|'umpire'='fielder'){
 const root=new THREE.Group();root.scale.setScalar(1.08);
 function mesh(parent:THREE.Object3D,geometry:THREE.BufferGeometry,c:string,name:string,x=0,y=0,z=0){const part=new THREE.Mesh(geometry,material(c));part.name=name;part.position.set(x,y,z);part.castShadow=true;part.receiveShadow=true;parent.add(part);return part;}
 function joint(parent:THREE.Object3D,name:string,x:number,y:number,z:number,bone?:string){const group=new THREE.Group();group.name=name;group.position.set(x,y,z);if(bone)group.userData.bone=bone;parent.add(group);return group;}
 const torso=joint(root,'chest-joint',0,1,0,'torso');
 mesh(torso,new THREE.CapsuleGeometry(.235,.4,6,12),color,'kit',0,.3,0);
 mesh(torso,new THREE.BoxGeometry(.43,.055,.015),'#edf3ed','accent',0,.44,-.238);
 const head=joint(torso,'neck-joint',0,.88,0,'head');
 mesh(head,new THREE.SphereGeometry(.19,16,12),'#b97a55','avatar-head');
 const nose=mesh(head,new THREE.ConeGeometry(.035,.085,8),'#b97a55','avatar-nose',0,-.015,-.19);nose.rotation.x=-Math.PI/2;
 for(const x of [-.075,.075])mesh(head,new THREE.SphereGeometry(.018,8,6),'#14222b','eye',x,.025,-.174);
 mesh(head,new THREE.SphereGeometry(.196,14,10,0,Math.PI*2,0,Math.PI*.48),'#192129','avatar-hair',0,.02,0);
 const beard=mesh(head,new THREE.SphereGeometry(.18,12,8,0,Math.PI*2,Math.PI*.45,Math.PI*.34),'#211812','avatar-beard',0,-.02,-.018);beard.visible=false;
 if(gear==='batter'||gear==='keeper'){
  mesh(head,new THREE.SphereGeometry(.215,16,10,0,Math.PI*2,0,Math.PI*.58),color,'kit',0,.03,0);
  mesh(head,new THREE.BoxGeometry(.38,.028,.2),color,'kit',0,.04,-.14);
  for(const y of [-.06,-.12]){const bar=mesh(head,new THREE.CylinderGeometry(.007,.007,.38,6),'#bdc6c9','helmet-grill',0,y,-.22);bar.rotation.z=Math.PI/2;}
 }else if(gear==='umpire'){
  mesh(head,new THREE.CylinderGeometry(.205,.205,.12,16),'#e6e2d6','hat',0,.18,0);
  mesh(head,new THREE.CylinderGeometry(.3,.3,.025,20),'#e6e2d6','hat-brim',0,.13,0);
 }
 for(const side of [-1,1]){
  const arm=joint(torso,side<0?'left-shoulder':'right-shoulder',side*.28,.6,0,side<0?'leftArm':'rightArm');
  mesh(arm,new THREE.CapsuleGeometry(.078,.2,5,8),color,'kit',0,-.15,0);
  const elbow=joint(arm,'elbow',0,-.32,0);elbow.rotation.x=-.12;
  mesh(elbow,new THREE.CapsuleGeometry(.065,.2,5,8),'#b97a55','forearm',0,-.15,0);
  const hand=joint(elbow,side>0?'bat-hand':'other-hand',0,-.31,0);
  mesh(hand,new THREE.SphereGeometry(gear==='keeper'?.12:.085,10,8),gear==='fielder'?'#b97a55':'#eef0de','glove');
  const hip=joint(root,'hip',side*.13,1,0,side<0?'leftLeg':'rightLeg');
  mesh(hip,new THREE.CapsuleGeometry(.095,.22,5,8),'#e8e9dc','trousers',0,-.2,0);
  const knee=joint(hip,'knee',0,-.43,0);
  mesh(knee,new THREE.CapsuleGeometry(.078,.25,5,8),'#e8e9dc','trousers',0,-.17,0);
  mesh(knee,new THREE.BoxGeometry(.2,.11,.34),'#172530','shoe',0,-.43,-.065);
  if(gear==='batter'||gear==='keeper'){
   mesh(knee,new THREE.BoxGeometry(.17,.36,.11),'#f0f0dc','pad',0,-.14,-.095);
   for(const x of [-.045,0,.045])mesh(knee,new THREE.BoxGeometry(.008,.3,.008),'#c4cbbb','pad-rib',x,-.14,-.155);
  }
 }
 return root;
}
