export function Splash() {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center bg-bg px-6 text-fg">
      <p className="font-mono text-xs tracking-[0.28em] text-muted uppercase">
        NEO 99942
      </p>
      <h1 className="font-display mt-3 text-5xl">Apophis</h1>
      <p className="mt-4 max-w-sm text-center text-sm text-muted text-pretty">
        Earth flyby  ·  13 April 2029
      </p>
    </div>
  );
}
