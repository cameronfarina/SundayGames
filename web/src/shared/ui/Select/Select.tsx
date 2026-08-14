import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import "./Select.css";

export interface SelectOption {
  readonly disabled?: boolean;
  readonly label: string;
  readonly value: string;
}

export interface SelectProps {
  readonly disabled?: boolean;
  readonly id: string;
  readonly label: string;
  readonly onValueChange: (value: string) => void;
  readonly options: readonly SelectOption[];
  readonly placeholder?: string;
  readonly value?: string;
}

export const Select = ({
  disabled = false,
  id,
  label,
  onValueChange,
  options,
  placeholder = "Select an option",
  value,
}: SelectProps) => (
  <div className="select-field">
    <label className="select-field__label" htmlFor={id}>{label}</label>
    <SelectPrimitive.Root
      disabled={disabled}
      onValueChange={onValueChange}
      {...(value === undefined ? {} : { value })}
    >
      <SelectPrimitive.Trigger className="select-field__trigger" id={id}>
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon aria-hidden="true" className="select-field__chevron">
          <ChevronDown size={18} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="select-field__content" position="popper" sideOffset={6}>
          <SelectPrimitive.Viewport className="select-field__viewport">
            {options.map(option => (
              <SelectPrimitive.Item
                className="select-field__option"
                {...(option.disabled === undefined ? {} : { disabled: option.disabled })}
                key={option.value}
                value={option.value}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="select-field__check">
                  <Check aria-hidden="true" size={17} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  </div>
);
