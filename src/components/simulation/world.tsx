import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import {
  EARTH_ANGLE_AT_CA,
  EVENTS,
  GEO_RADIUS_KM,
  MOON_RADIUS_KM,
  PATH,
  R_EARTH_KM,
  SUN_DIR,
  WINDOW_HOURS,
  earthRotationAt,
  interpolatePath,
  latLonOfDirection,
  latLonToLocal,
  moonPosition,
} from "@/lib/apophis/orbit";
import { simRef, useSim } from "@/store/sim";

export const apoWorld = new THREE.Vector3();
export const apoVel = new THREE.Vector3();

const _sun = new THREE.Vector3(...SUN_DIR);
const _look = new THREE.Vector3();
const _spin = new THREE.Quaternion();
const _axis = new THREE.Vector3(0.3, 1, 0.15).normalize();

export const reticleApi: {
  node: HTMLDivElement | null;
  label: HTMLSpanElement | null;
} = {
  node: null,
  label: null,
};

const atmoVert = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPosW = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const atmoFrag = /* glsl */ `
  uniform vec3 cameraPos;
  uniform vec3 sunDir;
  uniform float intensity;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 viewDir = normalize(cameraPos - vPosW);
    float fres = pow(1.0 - abs(dot(n, viewDir)), 3.4);
    float sun = smoothstep(-0.45, 0.85, dot(n, normalize(sunDir)));
    vec3 col = mix(vec3(0.12, 0.2, 0.48), vec3(0.5, 0.72, 1.0), sun);
    gl_FragColor = vec4(col, fres * intensity * (0.28 + 0.72 * sun));
  }
`;

function makeGlowTexture(rgb: string, size = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb}, 1)`);
  g.addColorStop(0.18, `rgba(${rgb}, 0.55)`);
  g.addColorStop(0.42, `rgba(${rgb}, 0.12)`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise2(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function makeCloudTexture() {
  const w = 512;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const latFade = Math.sin((y / (h - 1)) * Math.PI);
    for (let x = 0; x < w; x++) {
      let n = 0;
      let amp = 0.55;
      let freq = 1;
      for (let o = 0; o < 5; o++) {
        n += noise2((x / w) * 6 * freq, (y / h) * 3 * freq) * amp;
        amp *= 0.5;
        freq *= 2;
      }
      const a = Math.max(0, n - 0.48) * 1.7 * latFade;
      const i = (y * w + x) * 4;
      img.data[i] = 236;
      img.data[i + 1] = 240;
      img.data[i + 2] = 245;
      img.data[i + 3] = Math.min(255, a * 165);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function makeAsteroidGeometry() {
  const geo = new THREE.IcosahedronGeometry(1, 5);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n1 =
      Math.sin(v.x * 2.4 + v.y * 1.7) * 0.07 +
      Math.sin(v.y * 3.1 + v.z * 2.2) * 0.05 +
      Math.sin(v.z * 4.2 + v.x * 1.3) * 0.04;
    const n2 =
      Math.sin(v.x * 8.1) * Math.sin(v.y * 7.4) * Math.sin(v.z * 6.2) * 0.035;
    v.multiplyScalar(0.88 + n1 + n2);
    v.x *= 1.18;
    v.y *= 0.76;
    v.z *= 0.58;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function asteroidVisualRadius(trueScale: boolean) {
  if (trueScale) return 0.000029;
  return 0.07;
}

export function Earth({
  dayMap,
  nightMap,
}: {
  dayMap: THREE.Texture;
  nightMap: THREE.Texture;
}) {
  const group = useRef<THREE.Group>(null);
  const atmoMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          sunDir: { value: _sun.clone() },
          cameraPos: { value: new THREE.Vector3() },
          intensity: { value: 1.05 },
        },
        vertexShader: atmoVert,
        fragmentShader: atmoFrag,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  const glowMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          sunDir: { value: _sun.clone() },
          cameraPos: { value: new THREE.Vector3() },
          intensity: { value: 0.42 },
        },
        vertexShader: atmoVert,
        fragmentShader: atmoFrag,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  const clouds = useMemo(() => makeCloudTexture(), []);
  const showGeo = useSim((s) => s.showGeo);

  useFrame(({ camera }) => {
    const t = simRef.timeHours;
    if (group.current) group.current.rotation.y = earthRotationAt(t);
    atmoMat.uniforms.cameraPos.value.copy(camera.position);
    glowMat.uniforms.cameraPos.value.copy(camera.position);
  });

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[1, 96, 64]} />
        <meshStandardMaterial
          map={dayMap}
          roughness={0.58}
          metalness={0.02}
          color="#ffffff"
          emissiveMap={nightMap}
          emissive="#7f93b0"
          emissiveIntensity={0.42}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.004, 64, 48]} />
        <meshLambertMaterial
          map={clouds}
          transparent
          opacity={0.28}
          depthWrite={false}
        />
      </mesh>
      <mesh material={atmoMat} scale={1.048}>
        <sphereGeometry args={[1, 48, 32]} />
      </mesh>
      <mesh material={glowMat} scale={1.16}>
        <sphereGeometry args={[1, 32, 24]} />
      </mesh>
      {showGeo ? <GeoRing /> : null}
      <GroundTrack />
    </group>
  );
}

function GeoRing() {
  const r = GEO_RADIUS_KM / R_EARTH_KM;
  const pts = useMemo(() => {
    const arr: [number, number, number][] = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      arr.push([Math.cos(a) * r, 0, Math.sin(a) * r]);
    }
    return arr;
  }, [r]);

  const sats = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      return [Math.cos(a) * r, 0, Math.sin(a) * r] as [number, number, number];
    });
  }, [r]);

  return (
    <group>
      <Line points={pts} color="#9eb4c8" lineWidth={1} transparent opacity={0.42} />
      {sats.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.038, 0.016, 0.026]} />
          <meshStandardMaterial
            color="#c5d0dc"
            emissive="#9eb4c8"
            emissiveIntensity={0.25}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  );
}

function GroundTrack() {
  const pts = useMemo(() => {
    const arr: [number, number, number][] = [];
    for (const sample of PATH) {
      if (Math.abs(sample.t) > 5) continue;
      const ll = latLonOfDirection(sample.position, earthRotationAt(sample.t));
      arr.push(latLonToLocal(ll.lat, ll.lon, 1.012));
    }
    return arr;
  }, []);

  if (pts.length < 2) return null;
  return (
    <Line points={pts} color="#c4a574" lineWidth={1.4} transparent opacity={0.7} />
  );
}

export function Moon({ map }: { map: THREE.Texture }) {
  const ref = useRef<THREE.Group>(null);
  const show = useSim((s) => s.showMoon);
  const radius = MOON_RADIUS_KM / R_EARTH_KM;

  useFrame(() => {
    if (!ref.current) return;
    const p = moonPosition(simRef.timeHours);
    ref.current.position.set(p[0], p[1], p[2]);
    ref.current.rotation.y = simRef.timeHours * 0.09 + EARTH_ANGLE_AT_CA;
  });

  if (!show) return null;

  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[radius, 48, 32]} />
        <meshStandardMaterial
          map={map}
          roughness={1}
          metalness={0}
          color="#d6d2c8"
        />
      </mesh>
    </group>
  );
}

export function Asteroid({ map }: { map: THREE.Texture }) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const flare = useRef<THREE.Sprite>(null);
  const geo = useMemo(() => makeAsteroidGeometry(), []);
  const glow = useMemo(() => makeGlowTexture("232, 210, 170"), []);
  const trueScale = useSim((s) => s.trueScale);
  const visR = asteroidVisualRadius(trueScale);

  useFrame(({ camera, size }) => {
    const st = interpolatePath(simRef.timeHours);
    apoWorld.set(st.position[0], st.position[1], st.position[2]);
    apoVel.set(st.velocity[0], st.velocity[1], st.velocity[2]);
    if (group.current) group.current.position.copy(apoWorld);

    if (mesh.current) {
      _look.copy(apoWorld).add(apoVel);
      mesh.current.lookAt(_look);
      _spin.setFromAxisAngle(_axis, simRef.timeHours * 0.55);
      mesh.current.quaternion.multiply(_spin);
      const s = asteroidVisualRadius(useSim.getState().trueScale);
      mesh.current.scale.setScalar(s);
    }

    if (flare.current) {
      const dist = camera.position.distanceTo(apoWorld);
      flare.current.scale.setScalar(Math.max(0.12, dist * 0.004 + visR * 2.4));
      flare.current.material.opacity = trueScale ? 0.9 : 0.45;
    }

    const el = reticleApi.node;
    if (el) {
      _look.copy(apoWorld).project(camera);
      const onScreen =
        !useSim.getState().introDone
          ? false
          : _look.z < 1 && Math.abs(_look.x) < 1.15 && Math.abs(_look.y) < 1.15;
      const x = (_look.x * 0.5 + 0.5) * size.width;
      const y = (-_look.y * 0.5 + 0.5) * size.height;
      el.style.opacity = onScreen ? "1" : "0";
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  });

  return (
    <group ref={group}>
      <mesh ref={mesh} geometry={geo} scale={visR}>
        <meshStandardMaterial
          map={map}
          roughness={0.92}
          metalness={0.04}
          color="#c4b49a"
          bumpMap={map}
          bumpScale={0.08}
        />
      </mesh>
      <sprite ref={flare} scale={0.4}>
        <spriteMaterial
          map={glow}
          color="#e6d3a8"
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.5}
        />
      </sprite>
    </group>
  );
}

export function Trajectory() {
  const show = useSim((s) => s.showPath);
  const points = useMemo(
    () => PATH.map((p) => p.position as [number, number, number]),
    [],
  );
  const colors = useMemo(() => {
    return PATH.map((p) => {
      const u = 1 - Math.min(1, Math.abs(p.t) / WINDOW_HOURS);
      const r = 0.55 + 0.35 * u;
      const g = 0.48 + 0.22 * u;
      const b = 0.38 + 0.12 * (1 - u);
      return new THREE.Color(r, g, b);
    });
  }, []);
  const ca = useMemo(() => interpolatePath(0).position, []);

  if (!show) return null;

  return (
    <group>
      <Line
        points={points}
        vertexColors={colors}
        lineWidth={1.6}
        transparent
        opacity={0.88}
      />
      <mesh position={ca}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial color="#e8e6e1" />
      </mesh>
    </group>
  );
}

export function Starfield() {
  const { geo } = useMemo(() => {
    const count = 4200;
    const positions = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const gal = (Math.random() - 0.5) * 0.55;
      const theta = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const denser = Math.random() < 0.45;
      const phi = denser ? Math.acos(Math.max(-1, Math.min(1, gal + u * 0.25))) : Math.acos(u);
      const r = 220 + Math.random() * 80;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.62;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const mag = Math.pow(Math.random(), 2.2);
      const temp = Math.random();
      cols[i * 3] = 0.72 + temp * 0.28;
      cols[i * 3 + 1] = 0.76 + (1 - temp) * 0.16;
      cols[i * 3 + 2] = 0.88 + (1 - temp) * 0.12;
      const m = 0.25 + mag * 0.75;
      cols[i * 3] *= m;
      cols[i * 3 + 1] *= m;
      cols[i * 3 + 2] *= m;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    return { geo: g };
  }, []);

  return (
    <points geometry={geo}>
      <pointsMaterial
        vertexColors
        size={0.55}
        sizeAttenuation
        transparent
        opacity={0.9}
        depthWrite={false}
      />
    </points>
  );
}

export function Sun() {
  const glow = useMemo(() => makeGlowTexture("255, 244, 220", 256), []);
  const pos: [number, number, number] = [
    SUN_DIR[0] * 160,
    SUN_DIR[1] * 160,
    SUN_DIR[2] * 160,
  ];
  return (
    <sprite position={pos} scale={9}>
      <spriteMaterial
        map={glow}
        color="#fff6e4"
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </sprite>
  );
}

export function EventBeacons() {
  const pts = useMemo(() => {
    return EVENTS.filter((e) => e.id !== "open" && e.id !== "close").map((e) => {
      const s = interpolatePath(e.t);
      return { id: e.id, p: s.position };
    });
  }, []);
  return (
    <group>
      {pts.map((e) => (
        <mesh key={e.id} position={e.p}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshBasicMaterial
            color={e.id === "ca" ? "#e8e6e1" : "#9eb4c8"}
            transparent
            opacity={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}
