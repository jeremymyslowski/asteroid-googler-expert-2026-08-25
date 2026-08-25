import {
  Eye,
  Focus,
  Globe,
  Info,
  Move3d,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  EVENTS,
  GEO_RADIUS_KM,
  WINDOW_HOURS,
  formatDistance,
  formatSignedHours,
  formatUtc,
  interpolatePath,
  latLonOfDirection,
  earthRotationAt,
} from "@/lib/apophis/orbit";
import {
  beginFlyby,
  useSim,
  type CameraMode,
} from "@/store/sim";
import { reticleApi } from "./world";

const SPEEDS = [
  { id: "adapt", label: "Adaptive" },
  { id: "0.25", label: "0.25 h/s", value: 0.25 },
  { id: "1", label: "1 h/s", value: 1 },
  { id: "4", label: "4 h/s", value: 4 },
  { id: "12", label: "12 h/s", value: 12 },
] as const;

const CAMERAS: { id: CameraMode; label: string; hint: string; icon: typeof Globe }[] = [
  { id: "cinematic", label: "Overview", hint: "Frame Earth and Apophis", icon: Globe },
  { id: "chase", label: "Chase", hint: "Ride with the asteroid", icon: Focus },
  { id: "skywatch", label: "Ground", hint: "Look up from the sub-point", icon: Eye },
  { id: "free", label: "Free", hint: "Drag to orbit", icon: Move3d },
];

function statusFor(altitudeKm: number, radiusKm: number) {
  if (radiusKm < GEO_RADIUS_KM) return "Inside geostationary orbit";
  if (radiusKm < 384400) return "Closer than the Moon";
  return "Beyond lunar distance";
}

export function Overlay() {
  const introDone = useSim((s) => s.introDone);
  const aboutOpen = useSim((s) => s.aboutOpen);
  const timeHours = useSim((s) => s.timeHours);
  const playing = useSim((s) => s.playing);
  const adaptive = useSim((s) => s.adaptive);
  const speed = useSim((s) => s.speed);
  const cameraMode = useSim((s) => s.cameraMode);
  const trueScale = useSim((s) => s.trueScale);
  const showPath = useSim((s) => s.showPath);
  const showGeo = useSim((s) => s.showGeo);
  const showMoon = useSim((s) => s.showMoon);

  const state = useMemo(() => interpolatePath(timeHours), [timeHours]);
  const sub = useMemo(
    () => latLonOfDirection(state.position, earthRotationAt(timeHours)),
    [state.position, timeHours],
  );
  const atCA = Math.abs(timeHours) < 4 / 60;
  const progress = (timeHours + WINDOW_HOURS) / (2 * WINDOW_HOURS);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!useSim.getState().introDone) beginFlyby();
        else useSim.getState().togglePlaying();
      }
      if (e.code === "ArrowRight") {
        useSim.getState().setTimeHours(useSim.getState().timeHours + (e.shiftKey ? 1 : 0.15));
      }
      if (e.code === "ArrowLeft") {
        useSim.getState().setTimeHours(useSim.getState().timeHours - (e.shiftKey ? 1 : 0.15));
      }
      if (e.code === "Home") useSim.getState().jumpTo(0);
      if (e.key === "1") useSim.getState().setCameraMode("cinematic");
      if (e.key === "2") useSim.getState().setCameraMode("chase");
      if (e.key === "3") useSim.getState().setCameraMode("skywatch");
      if (e.key === "4") useSim.getState().setCameraMode("free");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-fg">
      <div
        ref={(n) => {
          reticleApi.node = n;
        }}
        className="pointer-events-none absolute top-0 left-0 opacity-0 will-change-transform"
        style={{ transform: "translate3d(-100px,-100px,0)" }}
      >
        <div className="-translate-x-1/2 -translate-y-1/2">
          <div className="relative size-9">
            <span className="absolute top-0 left-1/2 h-2 w-px -translate-x-1/2 bg-clay" />
            <span className="absolute bottom-0 left-1/2 h-2 w-px -translate-x-1/2 bg-clay" />
            <span className="absolute top-1/2 left-0 h-px w-2 -translate-y-1/2 bg-clay" />
            <span className="absolute top-1/2 right-0 h-px w-2 -translate-y-1/2 bg-clay" />
          </div>
          <p className="mt-1 text-center font-mono text-2xs tracking-wider text-clay uppercase">
            99942
          </p>
        </div>
      </div>

      {!introDone ? <Intro /> : null}

      {introDone ? (
        <>
          <header className="pointer-events-none absolute top-0 right-0 left-0 flex items-start justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-5">
            <div>
              <p className="font-mono text-2xs tracking-[0.28em] text-muted uppercase">
                NEO 99942
              </p>
              <h1 className="font-display text-2xl leading-tight text-fg sm:text-3xl">
                Apophis
              </h1>
              <p className="mt-0.5 font-mono text-xs text-muted tabular-nums">
                {formatUtc(timeHours)}
              </p>
            </div>
            <div className="pointer-events-auto flex items-center gap-2">
              {atCA ? (
                <span className="rounded-full bg-clay px-3 py-1 font-mono text-2xs tracking-wider text-accent-fg uppercase">
                  Closest approach
                </span>
              ) : null}
              <Button
                variant="subtle"
                size="icon"
                className="size-11"
                aria-label="About this flyby"
                onClick={() => useSim.getState().setAboutOpen(true)}
              >
                <Info />
              </Button>
            </div>
          </header>

          <aside className="pointer-events-none absolute top-24 left-4 hidden w-64 flex-col gap-3 sm:flex lg:top-28">
            <div className="panel rounded-xl p-4">
              <p className="font-mono text-2xs tracking-[0.22em] text-subtle uppercase">
                Telemetry
              </p>
              <dl className="mt-3 space-y-2.5">
                <Stat label="Epoch" value={formatSignedHours(timeHours)} />
                <Stat label="Altitude" value={formatDistance(state.altitudeKm)} />
                <Stat
                  label="Geocentric"
                  value={`${state.earthRadii.toFixed(2)} R⊕`}
                />
                <Stat label="Speed" value={`${state.speedKmS.toFixed(2)} km/s`} />
                <Stat
                  label="Sub-point"
                  value={`${fmtLat(sub.lat)}  ${fmtLon(sub.lon)}`}
                />
              </dl>
              <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
                {statusFor(state.altitudeKm, state.radiusKm)}
              </p>
            </div>
          </aside>

          <div className="pointer-events-none absolute top-24 right-4 hidden w-52 flex-col gap-2 sm:flex lg:top-28">
            <div className="panel rounded-xl p-2">
              {CAMERAS.map((cam) => {
                const Icon = cam.icon;
                const active = cameraMode === cam.id;
                return (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => useSim.getState().setCameraMode(cam.id)}
                    className={cn(
                      "pointer-events-auto flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm transition-colors duration-150",
                      active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1">{cam.label}</span>
                    <span className="font-mono text-2xs text-subtle">{cam.id === "cinematic" ? "1" : cam.id === "chase" ? "2" : cam.id === "skywatch" ? "3" : "4"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pointer-events-auto absolute right-0 bottom-0 left-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
            <div className="mx-auto max-w-4xl">
              <div className="mb-2 flex gap-2 overflow-x-auto sm:hidden">
                {CAMERAS.map((cam) => {
                  const Icon = cam.icon;
                  const active = cameraMode === cam.id;
                  return (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => useSim.getState().setCameraMode(cam.id)}
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-md",
                        active ? "bg-fg text-accent-fg" : "panel text-fg",
                      )}
                      aria-label={cam.label}
                    >
                      <Icon className="size-4" />
                    </button>
                  );
                })}
              </div>

              <div className="mb-2 grid grid-cols-3 gap-2 sm:hidden">
                <MiniStat label="Alt" value={compactKm(state.altitudeKm)} />
                <MiniStat label="Speed" value={`${state.speedKmS.toFixed(2)}`} unit="km/s" />
                <MiniStat label="Range" value={`${state.earthRadii.toFixed(1)}`} unit="R⊕" />
              </div>

              <div className="panel rounded-xl px-3 py-3 sm:rounded-2xl sm:px-5 sm:py-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    size="icon"
                    className="size-11"
                    aria-label={playing ? "Pause" : "Play"}
                    onClick={() => useSim.getState().togglePlaying()}
                  >
                    {playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label="Restart at T−24 hours"
                    onClick={() => useSim.getState().jumpTo(-WINDOW_HOURS)}
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                  <p className="mr-auto font-mono text-sm text-fg tabular-nums">
                    {formatSignedHours(timeHours)}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {SPEEDS.map((s) => {
                      const on = s.id === "adapt" ? adaptive : !adaptive && speed === s.value;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            if (s.id === "adapt") useSim.getState().setAdaptive(true);
                            else useSim.getState().setSpeed(s.value);
                          }}
                          className={cn(
                            "h-8 rounded-full px-3 font-mono text-2xs tracking-wide uppercase",
                            on ? "bg-fg text-accent-fg" : "text-muted hover:text-fg",
                          )}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="relative pt-4 pb-1">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-4">
                    {EVENTS.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        title={`${ev.label} — ${ev.detail}`}
                        aria-label={ev.label}
                        onClick={() => useSim.getState().jumpTo(ev.t)}
                        className="pointer-events-auto absolute top-0 -translate-x-1/2"
                        style={{ left: `${((ev.t + WINDOW_HOURS) / (2 * WINDOW_HOURS)) * 100}%` }}
                      >
                        <span
                          className={cn(
                            "block h-2 w-px",
                            ev.id === "ca" ? "h-3 bg-fg" : "bg-accent",
                          )}
                        />
                      </button>
                    ))}
                  </div>
                  <input
                    className="timeline-range"
                    type="range"
                    min={-WINDOW_HOURS}
                    max={WINDOW_HOURS}
                    step={0.01}
                    value={timeHours}
                    aria-label="Simulation time, hours from closest approach"
                    onChange={(e) =>
                      useSim.getState().setTimeHours(Number(e.target.value))
                    }
                  />
                  <div
                    className="pointer-events-none absolute top-[22px] left-0 h-0.5 rounded-full bg-clay"
                    style={{ width: `${progress * 100}%` }}
                  />
                  <div className="mt-2 flex justify-between font-mono text-2xs tracking-wider text-subtle uppercase">
                    <span>T−24h</span>
                    <span>Closest approach</span>
                    <span>T+24h</span>
                  </div>
                </div>

                <div className="mt-3 hidden flex-wrap gap-4 border-t border-border pt-3 text-xs text-muted sm:flex">
                  <Toggle
                    label="True scale"
                    on={trueScale}
                    onClick={() => useSim.getState().setTrueScale(!trueScale)}
                  />
                  <Toggle
                    label="Trajectory"
                    on={showPath}
                    onClick={() => useSim.getState().setShowPath(!showPath)}
                  />
                  <Toggle
                    label="GEO belt"
                    on={showGeo}
                    onClick={() => useSim.getState().setShowGeo(!showGeo)}
                  />
                  <Toggle
                    label="Moon"
                    on={showMoon}
                    onClick={() => useSim.getState().setShowMoon(!showMoon)}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {aboutOpen ? <About /> : null}
    </div>
  );
}

function Intro() {
  return (
    <div className="intro-veil pointer-events-auto absolute inset-0 flex flex-col justify-end px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:justify-center sm:px-12">
      <div className="mx-auto w-full max-w-xl sm:mx-0">
        <p className="intro-rise font-mono text-xs tracking-[0.32em] text-clay uppercase">
          13 April 2029  ·  21:46 UTC
        </p>
        <h1
          className="intro-rise mt-3 font-display text-6xl leading-none text-fg sm:text-7xl"
          style={{ animationDelay: "70ms" }}
        >
          Apophis
        </h1>
        <p
          className="intro-rise mt-4 max-w-md text-base leading-relaxed text-muted text-pretty"
          style={{ animationDelay: "140ms" }}
        >
          A 370-metre near-Earth asteroid passes 31,600 km from the surface —
          closer than the ring of geostationary satellites — then recedes into
          the night.
        </p>
        <div className="intro-rise mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "210ms" }}>
          <Button variant="primary" size="lg" onClick={() => beginFlyby()}>
            Begin flyby
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              beginFlyby();
              useSim.getState().jumpTo(0);
              useSim.getState().setPlaying(false);
            }}
          >
            Jump to closest approach
          </Button>
        </div>
        <p
          className="intro-rise mt-6 font-mono text-2xs tracking-wider text-subtle uppercase"
          style={{ animationDelay: "280ms" }}
        >
          Forty-eight hours around periapsis  ·  JPL close-approach data
        </p>
      </div>
    </div>
  );
}

function About() {
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-end justify-center bg-bg/70 p-3 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="about-title"
        className="panel max-h-[86dvh] w-full max-w-lg overflow-y-auto rounded-xl p-5 sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-2xs tracking-[0.24em] text-subtle uppercase">
              Briefing
            </p>
            <h2 id="about-title" className="font-display mt-1 text-3xl">
              The 2029 flyby
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label="Close briefing"
            onClick={() => useSim.getState().setAboutOpen(false)}
          >
            <X />
          </Button>
        </div>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted text-pretty">
          <p>
            On 13 April 2029 at 21:46 UTC, 99942 Apophis will sweep 31,600 km
            above Earth's surface — inside the geostationary belt (35,786 km)
            and a tenth of the way to the Moon.
          </p>
          <p>
            The body is roughly 370 metres across and elongated. At periapsis it
            moves at 7.4 km/s. Earth's gravity will bend the incoming
            hyperbola by about 27 degrees. Peak brightness is near magnitude 3,
            naked-eye from Europe, Africa and western Asia.
          </p>
          <p>
            This window covers twenty-four hours before closest approach through
            twenty-four hours after. Distances, speed and epoch follow published
            JPL close-approach values. The orbital plane is reconstructed so the
            ground track crosses the eastern Atlantic toward Africa.
          </p>
          <p>
            Apophis will not strike Earth in 2029. The asteroid is shown larger
            than true scale by default — a 370-metre rock is otherwise a point
            of light. Toggle true scale in the timeline.
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="font-mono text-sm text-fg tabular-nums">{value}</dd>
    </div>
  );
}

function MiniStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="panel rounded-md px-3 py-2">
      <p className="font-mono text-2xs tracking-wider text-subtle uppercase">{label}</p>
      <p className="font-mono text-sm text-fg tabular-nums">
        {value}
        {unit ? <span className="ml-1 text-subtle">{unit}</span> : null}
      </p>
    </div>
  );
}

function Toggle({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          on ? "bg-accent" : "bg-subtle",
        )}
      />
      {label}
    </button>
  );
}

function fmtLat(lat: number) {
  const a = Math.abs(lat).toFixed(1);
  return `${a}°${lat >= 0 ? "N" : "S"}`;
}

function fmtLon(lon: number) {
  const a = Math.abs(lon).toFixed(1);
  return `${a}°${lon >= 0 ? "E" : "W"}`;
}

function compactKm(km: number) {
  if (km >= 1000) return `${(km / 1000).toFixed(1)}k km`;
  return `${km.toFixed(0)} km`;
}
