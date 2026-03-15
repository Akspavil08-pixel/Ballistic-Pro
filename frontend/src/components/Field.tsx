import { ReactNode } from "react";
import { Tooltip } from "react-tooltip";
import { tooltipText } from "../tooltips/tooltipText";

interface FieldProps {
  id: string;
  label: string;
  tooltipKey: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number";
  step?: number;
  min?: number;
  placeholder?: string;
  icon?: ReactNode;
  unit?: string;
}

export function Field({
  id,
  label,
  tooltipKey,
  value,
  onChange,
  type = "number",
  step,
  min,
  placeholder,
  icon,
  unit
}: FieldProps) {
  const tooltipId = `tip-${id}`;
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold flex items-center gap-2 text-slate-200" htmlFor={id}>
        <span className="text-ocean">{icon}</span>
        {label}
        <span
          className="text-[11px] text-slate-400 cursor-help"
          data-tooltip-id={tooltipId}
          data-tooltip-content={tooltipText[tooltipKey] || ""}
        >
          ⓘ
        </span>
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          className="w-full rounded-lg border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
          type={type}
          value={value}
          min={min}
          step={step}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {unit ? <span className="text-xs text-slate-400">{unit}</span> : null}
      </div>
      <Tooltip id={tooltipId} place="top" className="max-w-xs text-xs" />
    </div>
  );
}
