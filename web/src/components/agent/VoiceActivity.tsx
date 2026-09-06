export function VoiceActivity() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="relative flex h-10 w-10 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-wom-accent/40" />
        <span className="relative inline-flex h-6 w-6 rounded-full bg-wom-accent" />
      </span>
      <p className="text-sm font-semibold text-white">En vivo</p>
    </div>
  );
}
