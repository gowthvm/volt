export default function Logo() {
  return (
    <div className="flex items-center gap-3">
      <span className="text-base font-extrabold tracking-[-0.03em] text-text-primary">Volt</span>
      <span className="text-xs text-text-tertiary hidden sm:inline">{'//'}</span>
    </div>
  );
}
