import { useState } from "react";
import { Repeat } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

type RecurType = "daily" | "weekly" | "monthly" | "yearly" | "custom";

interface RecurrenceValue {
  recurType?: RecurType;
  recurUntil?: string;
  recurDaysInterval?: number;
}

interface RecurrencePickerProps {
  value: RecurrenceValue;
  onChange: (value: RecurrenceValue) => void;
}

const FREQUENCY_OPTIONS: { value: RecurType; label: string }[] = [
  { value: "daily", label: "Diariamente" },
  { value: "weekly", label: "Semanalmente" },
  { value: "monthly", label: "Mensalmente" },
  { value: "yearly", label: "Anualmente" },
  { value: "custom", label: "Personalizar..." },
];

export function RecurrencePicker({ value, onChange }: RecurrencePickerProps) {
  const [enabled, setEnabled] = useState(!!value.recurType);

  const handleToggle = () => {
    if (enabled) {
      setEnabled(false);
      onChange({ recurType: undefined, recurUntil: undefined, recurDaysInterval: undefined });
    } else {
      setEnabled(true);
      onChange({ ...value, recurType: "daily" });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            enabled
              ? "bg-primary/10 text-primary border border-primary/30"
              : "bg-muted text-muted-foreground border border-transparent hover:bg-muted/80"
          }`}
        >
          <Repeat size={12} />
          {enabled ? "Recorrência ativa" : "Adicionar recorrência"}
        </button>
      </div>

      {enabled && (
        <div className="space-y-2 p-3 rounded-md border bg-muted/20">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">Frequência</label>
            <select
              value={value.recurType || "daily"}
              onChange={(e) => onChange({ ...value, recurType: e.target.value as RecurType })}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground"
            >
              {FREQUENCY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {value.recurType === "custom" && (
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">A cada quantos dias?</label>
              <input
                type="number"
                min={1}
                max={365}
                value={value.recurDaysInterval || 2}
                onChange={(e) => onChange({ ...value, recurDaysInterval: parseInt(e.target.value) || 2 })}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">Repetir até</label>
            <DatePicker
              value={value.recurUntil || ""}
              onChange={(v) => onChange({ ...value, recurUntil: v })}
              placeholder="Selecionar data final"
            />
          </div>
        </div>
      )}
    </div>
  );
}
