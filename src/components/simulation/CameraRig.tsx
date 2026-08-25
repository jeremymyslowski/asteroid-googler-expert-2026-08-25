import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { SUN_DIR } from "@/lib/apophis/orbit";
import { useSim, type CameraMode } from "@/store/sim";
import { apoVel, apoWorld, asteroidVisualRadius } from "./world";

const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3();
const _delta = new THREE.Vector3();
const _back = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _sun = new THREE.Vector3(...SUN_DIR);

function framing(mode: CameraMode, trueScale: boolean) {
  const visR = asteroidVisualRadius(trueScale);
  const dist = Math.max(0.2, apoWorld.length());

  if (mode === "chase") {
    _fwd.copy(apoVel);
    if (_fwd.lengthSq() < 1e-12) _fwd.copy(apoWorld).negate();
    _fwd.normalize();
    _back.copy(_fwd).multiplyScalar(-(visR * 16 + 0.9));
    _desired.copy(apoWorld).add(_back).addScaledVector(_up, visR * 3.2 + 0.18);
    _look.set(0, 0, 0);
    const chaseFov = dist > 20 ? 42 : 50;
    return { fov: chaseFov, near: Math.max(0.01, visR * 0.35), far: 400 };
  }

  if (mode === "skywatch") {
    _delta.copy(apoWorld).normalize();
    _right.crossVectors(_delta, _up);
    if (_right.lengthSq() < 1e-8) _right.set(1, 0, 0);
    _right.normalize();
    _desired
      .copy(_delta)
      .multiplyScalar(1.07)
      .addScaledVector(_right, 0.03)
      .addScaledVector(_up, 0.02);
    _look.copy(apoWorld);
    return { fov: 62, near: 0.002, far: 320 };
  }

  _fwd.copy(apoWorld).normalize();
  _right.crossVectors(_fwd, _up);
  if (_right.lengthSq() < 1e-8) _right.crossVectors(_sun, _up);
  _right.normalize();

  if (dist > 16) {
    _desired
      .copy(_sun)
      .multiplyScalar(4.2)
      .addScaledVector(_up, 2.4)
      .addScaledVector(_right, 4.8)
      .addScaledVector(_fwd, -1.2);
    if (_desired.length() < 5.2) _desired.setLength(6.4);
    _look.copy(_fwd).multiplyScalar(1.2);
    return { fov: 36, near: 0.05, far: 420 };
  }

  const side = Math.min(6.2, dist * 0.48 + 1.7);
  const lift = dist * 0.14 + 0.95;
  _desired
    .copy(apoWorld)
    .multiplyScalar(0.12)
    .addScaledVector(_right, side)
    .addScaledVector(_up, lift)
    .addScaledVector(_sun, 1.5);
  if (_desired.length() < 2.6) _desired.setLength(3.8);
  _look.copy(apoWorld).multiplyScalar(0.35);
  const fov = dist > 10 ? 42 : 48;
  return { fov, near: 0.035, far: 360 };
}

export function CameraRig() {
  const mode = useSim((s) => s.cameraMode);
  const trueScale = useSim((s) => s.trueScale);
  const introDone = useSim((s) => s.introDone);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const primed = useRef(false);
  const prevMode = useRef<CameraMode>(mode);
  const reduced = useRef(false);
  const lookSmooth = useRef(new THREE.Vector3());

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.1);
    const cam = camera as THREE.PerspectiveCamera;

    if (mode === "free") {
      if (prevMode.current !== "free") {
        cam.near = 0.05;
        cam.far = 500;
        cam.updateProjectionMatrix();
      }
      primed.current = true;
      prevMode.current = mode;
      return;
    }

    const { fov, near, far } = framing(mode, trueScale);
    const snap = !primed.current || prevMode.current !== mode || reduced.current || !introDone;
    const k = snap ? 1 : 1 - Math.exp(-3.2 * d);

    if (snap) {
      cam.position.copy(_desired);
      lookSmooth.current.copy(_look);
    } else {
      cam.position.lerp(_desired, k);
      lookSmooth.current.lerp(_look, k);
    }

    cam.up.set(0, 1, 0);
    cam.lookAt(lookSmooth.current);
    cam.fov += (fov - cam.fov) * k;
    cam.near = near;
    cam.far = far;
    cam.updateProjectionMatrix();
    primed.current = true;
    prevMode.current = mode;
  });

  useEffect(() => {
    if (mode !== "free" || !controls) return;
    const c = controls as unknown as { target: THREE.Vector3 };
    if (c.target) c.target.set(0, 0, 0);
  }, [mode, controls]);

  return (
    <OrbitControls
      makeDefault
      enabled={mode === "free"}
      enableDamping
      dampingFactor={0.08}
      minDistance={1.45}
      maxDistance={170}
      enablePan
    />
  );
}
