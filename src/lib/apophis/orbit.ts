/**
 * 99942 Apophis — 13 April 2029 Earth flyby.
 *
 * Geocentric hyperbolic trajectory fitted to published JPL close-approach
 * numbers (periapsis distance, speed, epoch). The orbital-plane orientation
 * is a representative reconstruction so the ground track crosses the Atlantic
 * toward Africa / southern Europe, matching the public 2029 visibility zone.
 */

export const R_EARTH_KM = 6371;
export const GM_EARTH = 398600.4418; // km^3/s^2
export const ALTITUDE_CA_KM = 31600;
export const R_PERI_KM = R_EARTH_KM + ALTITUDE_CA_KM; // 37,971 km
export const V_PERI_KMS = 7.42;
export const ASTEROID_DIAMETER_M = 370;
export const ASTEROID_DIAMETER_KM = ASTEROID_DIAMETER_M / 1000;
export const GEO_RADIUS_KM = 42164;
export const MOON_RADIUS_KM = 1737.4;
export const MOON_DISTANCE_KM = 384400;
export const SIDEREAL_DAY_H = 23.9344696;
export const WINDOW_HOURS = 24;

const V_INF2 = V_PERI_KMS * V_PERI_KMS - (2 * GM_EARTH) / R_PERI_KM;
export const A_KM = GM_EARTH / V_INF2;
export const ECC = 1 + (R_PERI_KM * V_INF2) / GM_EARTH;
const N_MEAN = Math.sqrt(GM_EARTH / (A_KM * A_KM * A_KM));
const P_LATUS = A_KM * (ECC * ECC - 1);

/** Inclination / periapsis chosen so closest approach sits ~8°S. */
const INC = (38 * Math.PI) / 180;
const ARG_PERI = (-12.5 * Math.PI) / 180;
const RAAN = (28 * Math.PI) / 180;

/** Closest approach, UTC. */
export const CA_UTC_MS = Date.UTC(2029, 3, 13, 21, 46, 0);

export const SUN_DIR = normalize([
  Math.cos((8.8 * Math.PI) / 180) * Math.cos((22 * Math.PI) / 180),
  Math.sin((8.8 * Math.PI) / 180),
  Math.cos((8.8 * Math.PI) / 180) * Math.sin((22 * Math.PI) / 180),
]);

export type Vec3 = [number, number, number];

export type FlybyState = {
  position: Vec3;
  velocity: Vec3;
  radiusKm: number;
  altitudeKm: number;
  speedKmS: number;
  earthRadii: number;
};

function normalize(v: Vec3): Vec3 {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
}

function hyperbolicAnomaly(M: number, e: number): number {
  let F = Math.asinh(M / e);
  for (let i = 0; i < 18; i++) {
    const s = Math.sinh(F);
    const c = Math.cosh(F);
    const d = (e * s - F - M) / (e * c - 1);
    F -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return F;
}

function perifocalToYUp(x: number, y: number): Vec3 {
  const cosw = Math.cos(ARG_PERI);
  const sinw = Math.sin(ARG_PERI);
  const cosi = Math.cos(INC);
  const sini = Math.sin(INC);
  const cosO = Math.cos(RAAN);
  const sinO = Math.sin(RAAN);

  const eciX =
    (cosO * cosw - sinO * sinw * cosi) * x +
    (-cosO * sinw - sinO * cosw * cosi) * y;
  const eciY =
    (sinO * cosw + cosO * sinw * cosi) * x +
    (-sinO * sinw + cosO * cosw * cosi) * y;
  const eciZ = sini * sinw * x + sini * cosw * y;

  return [eciX, eciZ, eciY];
}

function stateAtSeconds(tSec: number): FlybyState {
  const M = N_MEAN * tSec;
  const F = hyperbolicAnomaly(M, ECC);
  const coshF = Math.cosh(F);
  const sinhF = Math.sinh(F);
  const denom = ECC * coshF - 1;
  const cosNu = (ECC - coshF) / denom;
  const sinNu = (Math.sqrt(ECC * ECC - 1) * sinhF) / denom;
  const r = A_KM * denom;
  const x = r * cosNu;
  const y = r * sinNu;

  const sqrtMuP = Math.sqrt(GM_EARTH / P_LATUS);
  const vx = -sqrtMuP * sinNu;
  const vy = sqrtMuP * (ECC + cosNu);

  const positionKm = perifocalToYUp(x, y);
  const velocity = perifocalToYUp(vx, vy);
  const radiusKm = Math.hypot(positionKm[0], positionKm[1], positionKm[2]);

  return {
    position: [
      positionKm[0] / R_EARTH_KM,
      positionKm[1] / R_EARTH_KM,
      positionKm[2] / R_EARTH_KM,
    ],
    velocity: [
      velocity[0] / R_EARTH_KM,
      velocity[1] / R_EARTH_KM,
      velocity[2] / R_EARTH_KM,
    ],
    radiusKm,
    altitudeKm: radiusKm - R_EARTH_KM,
    speedKmS: Math.hypot(velocity[0], velocity[1], velocity[2]),
    earthRadii: radiusKm / R_EARTH_KM,
  };
}

const peri = stateAtSeconds(0);
const periLon = Math.atan2(peri.position[2], peri.position[0]);
/** Greenwich hour angle so periapsis sits over the eastern Atlantic (~20°W). */
const TARGET_LON = (-20 * Math.PI) / 180;
export const EARTH_ANGLE_AT_CA = TARGET_LON - periLon;

export function earthRotationAt(timeHours: number): number {
  return EARTH_ANGLE_AT_CA + (timeHours / SIDEREAL_DAY_H) * Math.PI * 2;
}

export function stateAtHours(timeHours: number): FlybyState {
  return stateAtSeconds(timeHours * 3600);
}

export type PathSample = {
  t: number;
  position: Vec3;
  radiusKm: number;
};

const PATH_COUNT = 720;

export const PATH: PathSample[] = Array.from({ length: PATH_COUNT }, (_, i) => {
  const t = -WINDOW_HOURS + (2 * WINDOW_HOURS * i) / (PATH_COUNT - 1);
  const s = stateAtHours(t);
  return { t, position: s.position, radiusKm: s.radiusKm };
});

export function interpolatePath(timeHours: number): FlybyState {
  const t = Math.min(WINDOW_HOURS, Math.max(-WINDOW_HOURS, timeHours));
  const u = ((t + WINDOW_HOURS) / (2 * WINDOW_HOURS)) * (PATH_COUNT - 1);
  const i = Math.min(PATH_COUNT - 2, Math.max(0, Math.floor(u)));
  const f = u - i;
  const a = PATH[i]!;
  const b = PATH[i + 1]!;
  const position: Vec3 = [
    a.position[0] + (b.position[0] - a.position[0]) * f,
    a.position[1] + (b.position[1] - a.position[1]) * f,
    a.position[2] + (b.position[2] - a.position[2]) * f,
  ];
  const exact = stateAtHours(t);
  return { ...exact, position };
}

function findCrossing(targetKm: number, inbound: boolean): number {
  const dir = inbound ? 1 : -1;
  let lo = inbound ? -WINDOW_HOURS : 0;
  let hi = inbound ? 0 : WINDOW_HOURS;
  for (let n = 0; n < 40; n++) {
    const mid = (lo + hi) / 2;
    const r = stateAtHours(mid).radiusKm;
    if ((r - targetKm) * dir > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const GEO_IN_H = findCrossing(GEO_RADIUS_KM, true);
export const GEO_OUT_H = findCrossing(GEO_RADIUS_KM, false);
export const LUNAR_IN_H = findCrossing(MOON_DISTANCE_KM, true);
export const LUNAR_OUT_H = findCrossing(MOON_DISTANCE_KM, false);

export type SimEvent = {
  id: string;
  t: number;
  label: string;
  detail: string;
};

export const EVENTS: SimEvent[] = [
  {
    id: "open",
    t: -WINDOW_HOURS,
    label: "T−24h",
    detail: "Approach window opens",
  },
  {
    id: "lunar-in",
    t: LUNAR_IN_H,
    label: "Lunar distance",
    detail: "Closer than the Moon",
  },
  {
    id: "geo-in",
    t: GEO_IN_H,
    label: "GEO inbound",
    detail: "Inside geostationary orbit",
  },
  {
    id: "ca",
    t: 0,
    label: "Closest approach",
    detail: "31,600 km above the surface",
  },
  {
    id: "geo-out",
    t: GEO_OUT_H,
    label: "GEO outbound",
    detail: "Leaving the GEO belt",
  },
  {
    id: "lunar-out",
    t: LUNAR_OUT_H,
    label: "Lunar distance",
    detail: "Receding past the Moon",
  },
  {
    id: "close",
    t: WINDOW_HOURS,
    label: "T+24h",
    detail: "Approach window closes",
  },
];

/** Moon in a wide, slightly inclined orbit — composition, not a JPL ephemeris. */
export function moonPosition(timeHours: number): Vec3 {
  const periodH = 27.321661 * 24;
  const phase0 = 1.15;
  const theta = phase0 + (timeHours / periodH) * Math.PI * 2;
  const inc = (5.1 * Math.PI) / 180;
  const r = MOON_DISTANCE_KM / R_EARTH_KM;
  const x = r * Math.cos(theta);
  const z = r * Math.sin(theta) * Math.cos(inc);
  const y = r * Math.sin(theta) * Math.sin(inc);
  return [x, y, z];
}

export function latLonOfDirection(dir: Vec3, earthAngle: number): {
  lat: number;
  lon: number;
} {
  const c = Math.cos(earthAngle);
  const s = Math.sin(earthAngle);
  const x = dir[0] * c - dir[2] * s;
  const z = dir[0] * s + dir[2] * c;
  const y = dir[1];
  const r = Math.hypot(x, y, z) || 1;
  return {
    lat: (Math.asin(y / r) * 180) / Math.PI,
    lon: (Math.atan2(z, x) * 180) / Math.PI,
  };
}

export function latLonToLocal(latDeg: number, lonDeg: number, radius = 1.012): Vec3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const cl = Math.cos(lat);
  return [cl * Math.cos(lon) * radius, Math.sin(lat) * radius, cl * Math.sin(lon) * radius];
}

export function formatUtc(timeHours: number): string {
  const ms = CA_UTC_MS + timeHours * 3600 * 1000;
  const d = new Date(ms);
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${dd} ${mon[d.getUTCMonth()]} 2029  ${hh}:${mm}:${ss} UTC`;
}

export function formatSignedHours(t: number): string {
  const sign = t < 0 ? "−" : t > 0 ? "+" : " ";
  const abs = Math.abs(t);
  const h = Math.floor(abs);
  const m = Math.floor((abs - h) * 60);
  const s = Math.floor(((abs - h) * 60 - m) * 60);
  if (h === 0 && m === 0 && t !== 0) {
    return `T${sign}${s}s`;
  }
  if (h === 0) {
    return `T${sign}${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  }
  return `T${sign}${h}h ${String(m).padStart(2, "0")}m`;
}

export function formatDistance(km: number): string {
  if (km >= 100000) return `${(km / 1000).toFixed(1)} thousand km`;
  if (km >= 10000) return `${km.toFixed(0)} km`;
  if (km >= 1000) return `${km.toFixed(0)} km`;
  return `${km.toFixed(1)} km`;
}

export function adaptiveHoursPerSec(timeHours: number): number {
  const a = Math.abs(timeHours);
  if (a < 0.12) return 0.08;
  if (a < 0.4) return 0.18;
  if (a < 1) return 0.45;
  if (a < 3) return 1.1;
  if (a < 8) return 2.6;
  return 5.5;
}
