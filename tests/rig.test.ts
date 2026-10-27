import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCricketer} from '../src/web/game/character.ts';
import {captureRigs,restoreRigs} from '../src/web/game/replay.ts';
import {PlayerAnimator} from '../src/web/game/animation.ts';
const material=(color:string)=>new THREE.MeshStandardMaterial({color});
test('jointed original rig carries glove and pad geometry with animated limbs',()=>{
 const player=createCricketer('#124477',material,'batter');const hand=player.getObjectByName('bat-hand')!;
 const animator=new PlayerAnimator(player);player.updateMatrixWorld(true);const before=hand.getWorldPosition(new THREE.Vector3());
 animator.set('bowl',0);animator.update(300);player.updateMatrixWorld(true);
 assert.ok(hand.getWorldPosition(new THREE.Vector3()).distanceTo(before)>.1);
 const bones=new Set<string>();player.traverse(part=>{if(part.userData.bone)bones.add(part.userData.bone);});
 assert.equal(bones.size,6);assert(player.getObjectByName('helmet-grill'));assert(player.getObjectByName('pad'));
});
test('replay restores recorded joint and root transforms without reading live pose',()=>{
 const player=createCricketer('#124477',material,'batter');const bat=new THREE.Group();bat.name='bat-swing';player.getObjectByName('bat-hand')!.add(bat);
 const animator=new PlayerAnimator(player);animator.set('cover',0);animator.update(200);bat.rotation.x=.7;player.position.set(2,0,8);
 const saved=captureRigs([player]);animator.set('run',300);animator.update(500);player.position.set(-2,0,-8);bat.rotation.x=-2;
 assert.notDeepEqual(captureRigs([player]),saved);restoreRigs([player],saved);assert.deepEqual(captureRigs([player]),saved);
 const original=JSON.stringify(saved);player.position.x=99;assert.equal(JSON.stringify(saved),original);
});
