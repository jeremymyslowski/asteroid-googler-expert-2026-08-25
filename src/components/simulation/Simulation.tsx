"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import { Overlay } from "./Overlay";
import { Scene } from "./Scene";

export default function Simulation() {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg">
      <Canvas
        className="h-full w-full touch-none"
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
        dpr={[1, 1.75]}
        camera={{ fov: 42, near: 0.05, far: 500, position: [22, 12, 48] }}
        onCreated={({ gl }) => {
          gl.setClearColor("#05060a");
        }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <Overlay />
    </div>
  );
}
