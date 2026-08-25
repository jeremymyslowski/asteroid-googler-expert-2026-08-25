import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { SUN_DIR } from "@/lib/apophis/orbit";
import { syncTimeToStore, tickSimulation } from "@/store/sim";
import { CameraRig } from "./CameraRig";
import {
  Asteroid,
  Earth,
  EventBeacons,
  Moon,
  Starfield,
  Sun,
  Trajectory,
} from "./world";

function SimClock() {
  const acc = useRef(0);
  useFrame((_, delta) => {
    const d = Math.min(delta, 0.1);
    tickSimulation(d);
    acc.current += d;
    if (acc.current > 1 / 12) {
      acc.current = 0;
      syncTimeToStore();
    }
  });
  return null;
}

export function Scene() {
  const [dayMap, nightMap, moonMap, asteroidMap] = useTexture([
    "/textures/earth-day.jpg",
    "/textures/earth-night.jpg",
    "/textures/moon.jpg",
    "/textures/asteroid.jpg",
  ]);

  useLayoutEffect(() => {
    dayMap.colorSpace = THREE.SRGBColorSpace;
    nightMap.colorSpace = THREE.SRGBColorSpace;
    moonMap.colorSpace = THREE.SRGBColorSpace;
    asteroidMap.colorSpace = THREE.SRGBColorSpace;
    dayMap.anisotropy = 8;
    nightMap.anisotropy = 4;
    moonMap.anisotropy = 4;
    asteroidMap.anisotropy = 8;
    asteroidMap.wrapS = asteroidMap.wrapT = THREE.RepeatWrapping;
  }, [dayMap, nightMap, moonMap, asteroidMap]);

  return (
    <>
      <SimClock />
      <color attach="background" args={["#05060a"]} />
      <ambientLight intensity={0.12} />
      <hemisphereLight args={["#a8bdd8", "#1a140f", 0.55]} />
      <directionalLight
        color="#fff4e5"
        intensity={3.1}
        position={[SUN_DIR[0] * 90, SUN_DIR[1] * 90, SUN_DIR[2] * 90]}
      />
      <directionalLight
        color="#6d7d98"
        intensity={0.28}
        position={[-SUN_DIR[0] * 70, -SUN_DIR[1] * 40, -SUN_DIR[2] * 70]}
      />
      <Starfield />
      <Sun />
      <Earth dayMap={dayMap} nightMap={nightMap} />
      <Moon map={moonMap} />
      <Trajectory />
      <EventBeacons />
      <Asteroid map={asteroidMap} />
      <CameraRig />
    </>
  );
}
