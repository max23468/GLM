import { Info } from "lucide-react";
import type { ReactNode } from "react";

type HelpTooltipProps = {
  label?: string;
  children: ReactNode;
};

export function HelpTooltip({ label = "Aiuto compilazione", children }: HelpTooltipProps) {
  return (
    <span className="help-tooltip">
      <button type="button" aria-label={label}>
        <Info size={13} aria-hidden="true" />
      </button>
      <span className="help-tooltip-content" role="tooltip">
        {children}
      </span>
    </span>
  );
}
