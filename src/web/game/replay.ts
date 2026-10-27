import type {Object3D} from 'three';
export interface RigTransform {position:[number,number,number];quaternion:[number,number,number,number]}
function parts(root:Object3D){const result=[root];root.traverse(part=>{if(part!==root&&(part.userData.bone||part.name==='bat-swing'))result.push(part);});return result;}
export function captureRigs(roots:Object3D[]):RigTransform[][]{return roots.map(root=>parts(root).map(part=>({position:part.position.toArray(),quaternion:part.quaternion.toArray()})));}
export function restoreRigs(roots:Object3D[],frames:RigTransform[][]){roots.forEach((root,i)=>parts(root).forEach((part,j)=>{const frame=frames[i]?.[j];if(frame){part.position.fromArray(frame.position);part.quaternion.fromArray(frame.quaternion);}}));}
