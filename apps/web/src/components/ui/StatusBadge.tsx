type Tone = "ok" | "pending" | "error" | "off";

export function StatusBadge({
  label,
  tone = "off",
}: {
  label: string;
  tone?: Tone;
}) {
  return (
    <span className={`status-badge status-${tone}`}>
      <span className="status-dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
