interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

export function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      className={`flex items-center gap-3 rounded-full border px-4 py-2 text-sm transition ${
        checked ? "bg-ocean text-white border-ocean" : "bg-slate-900/70 text-sand border-slate-700/70"
      }`}
      onClick={() => onChange(!checked)}
    >
      <span className={`h-3 w-3 rounded-full ${checked ? "bg-mint" : "bg-slate/30"}`} />
      {label}
    </button>
  );
}
