import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import "./PracticeSelect.css";

export interface PracticeSelectOption {
  readonly label: string;
  readonly value: string;
}

interface PracticeSelectProps {
  readonly label: string;
  readonly onValueChange: (value: string) => void;
  readonly options: readonly PracticeSelectOption[];
  readonly value: string;
}

export function PracticeSelect({ label, onValueChange, options, value }: PracticeSelectProps) {
  return (
    <Select.Root onValueChange={onValueChange} value={value}>
      <Select.Trigger aria-label={label} className="practice-select__trigger">
        <Select.Value />
        <Select.Icon className="practice-select__icon">
          <ChevronDown aria-hidden="true" size={18} strokeWidth={2} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="practice-select__content" position="popper" sideOffset={6}>
          <Select.Viewport className="practice-select__viewport">
            {options.map(option => (
              <Select.Item className="practice-select__item" key={option.value} value={option.value}>
                <Select.ItemIndicator className="practice-select__indicator">
                  <Check aria-hidden="true" size={16} />
                </Select.ItemIndicator>
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
