import { ReactNode } from "react";
import { Tooltip } from "react-tooltip";
import { tooltipText } from "../tooltips/tooltipText";

interface Option {
  label: string;
  value: string;
}

interface SelectFieldProps {
  id: string;
  label: string;
  tooltipKey: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  icon?: ReactNode;
}

export function SelectField({ id, label, tooltipKey, value, onChange, options, icon }: SelectFieldProps) {
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
      <select
        id={id}
        className="w-full rounded-lg border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="text-black">
            {opt.label}
          </option>
        ))}
      </select>
      <Tooltip id={tooltipId} place="top" className="max-w-xs text-xs" />
    </div>
  );
}
