import { create } from "zustand";
import { adaptiveHoursPerSec, WINDOW_HOURS } from "@/lib/apophis/orbit";

export type CameraMode = "cinematic" | "chase" | "skywatch" | "free";

export type SimUiState = {
  playing: boolean;
  speed: number;
  adaptive: boolean;
  cameraMode: CameraMode;
  trueScale: boolean;
  showPath: boolean;
  showGeo: boolean;
  showMoon: boolean;
  introDone: boolean;
  aboutOpen: boolean;
  timeHours: number;
};

export const simRef = {
  timeHours: -WINDOW_HOURS,
};

type SimStore = SimUiState & {
  setPlaying: (v: boolean) => void;
  togglePlaying: () => void;
  setSpeed: (v: number) => void;
  setAdaptive: (v: boolean) => void;
  setCameraMode: (v: CameraMode) => void;
  setTrueScale: (v: boolean) => void;
  setShowPath: (v: boolean) => void;
  setShowGeo: (v: boolean) => void;
  setShowMoon: (v: boolean) => void;
  setIntroDone: (v: boolean) => void;
  setAboutOpen: (v: boolean) => void;
  setTimeHours: (v: number) => void;
  jumpTo: (v: number) => void;
};

export const useSim = create<SimStore>((set, get) => ({
  playing: false,
  speed: 1.2,
  adaptive: true,
  cameraMode: "cinematic",
  trueScale: false,
  showPath: true,
  showGeo: true,
  showMoon: true,
  introDone: false,
  aboutOpen: false,
  timeHours: -WINDOW_HOURS,

  setPlaying: (playing) => set({ playing }),
  togglePlaying: () => set({ playing: !get().playing }),
  setSpeed: (speed) => set({ speed, adaptive: false }),
  setAdaptive: (adaptive) => set({ adaptive }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setTrueScale: (trueScale) => set({ trueScale }),
  setShowPath: (showPath) => set({ showPath }),
  setShowGeo: (showGeo) => set({ showGeo }),
  setShowMoon: (showMoon) => set({ showMoon }),
  setIntroDone: (introDone) => set({ introDone }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
  setTimeHours: (timeHours) => {
    const t = Math.min(WINDOW_HOURS, Math.max(-WINDOW_HOURS, timeHours));
    simRef.timeHours = t;
    set({ timeHours: t });
  },
  jumpTo: (timeHours) => {
    const t = Math.min(WINDOW_HOURS, Math.max(-WINDOW_HOURS, timeHours));
    simRef.timeHours = t;
    set({ timeHours: t, playing: true, introDone: true });
  },
}));

export function beginFlyby() {
  simRef.timeHours = -WINDOW_HOURS;
  useSim.setState({
    introDone: true,
    playing: true,
    timeHours: -WINDOW_HOURS,
    adaptive: true,
  });
}

export function tickSimulation(dt: number) {
  const s = useSim.getState();
  if (!s.playing || !s.introDone) return;
  const rate = s.adaptive ? adaptiveHoursPerSec(simRef.timeHours) : s.speed;
  let next = simRef.timeHours + rate * dt;
  if (next >= WINDOW_HOURS) {
    next = WINDOW_HOURS;
    simRef.timeHours = next;
    useSim.setState({ playing: false, timeHours: next });
    return;
  }
  if (next <= -WINDOW_HOURS) {
    next = -WINDOW_HOURS;
    simRef.timeHours = next;
    useSim.setState({ playing: false, timeHours: next });
    return;
  }
  simRef.timeHours = next;
}

export function syncTimeToStore() {
  const t = simRef.timeHours;
  if (Math.abs(useSim.getState().timeHours - t) > 0.002) {
    useSim.setState({ timeHours: t });
  }
}
