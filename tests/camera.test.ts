import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {applyCamera,automaticCameraIndex,CAMERA_PROFILES} from '../src/web/game/camera.ts';

test('broadcast camera catalog provides twelve distinct original angles',()=>{assert.equal(CAMERA_PROFILES.length,12);assert.equal(new Set(CAMERA_PROFILES.map(c=>c.id)).size,12);assert.ok(CAMERA_PROFILES.some(c=>c.id==='stump'));assert.ok(CAMERA_PROFILES.some(c=>c.id==='drone'));});
test('automatic camera director selects phase-appropriate valid profiles',()=>{for(const [phase,z] of [['READY',-9],['DELIVERY',-2],['DELIVERY',7],['IN_PLAY',20],['DEAD',0]] as const){const index=automaticCameraIndex(phase,z,3.4);assert.ok(index>=0&&index<CAMERA_PROFILES.length);}assert.notEqual(automaticCameraIndex('READY',-9,0),automaticCameraIndex('IN_PLAY',20,0));});
test('camera application produces finite position and orientation',()=>{const camera=new THREE.PerspectiveCamera();applyCamera(camera,CAMERA_PROFILES[9],{ball:new THREE.Vector3(3,2,12),phase:'IN_PLAY',battingEnd:0,time:1},true);assert.ok(camera.position.toArray().every(Number.isFinite));assert.ok(camera.quaternion.toArray().every(Number.isFinite));});
