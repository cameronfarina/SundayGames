import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import type { ReactNode } from "react";
import "./DropdownMenu.css";

export interface DropdownMenuItem {
  readonly destructive?: boolean;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onSelect: () => void;
}

export interface DropdownMenuProps {
  readonly children?: ReactNode;
  readonly items: readonly DropdownMenuItem[];
  readonly label: string;
}

export const DropdownMenu = ({ children, items, label }: DropdownMenuProps) => (
  <MenuPrimitive.Root>
    <MenuPrimitive.Trigger aria-label={label} className="dropdown-menu__trigger">
      {children ?? "⋯"}
    </MenuPrimitive.Trigger>
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content className="dropdown-menu__content" sideOffset={6}>
        {items.map(item => (
          <MenuPrimitive.Item
            className={clsx(
              "dropdown-menu__item",
              item.destructive && "dropdown-menu__item--danger",
            )}
            key={item.label}
            onSelect={item.onSelect}
            {...(item.disabled === undefined ? {} : { disabled: item.disabled })}
          >
            {item.label}
          </MenuPrimitive.Item>
        ))}
      </MenuPrimitive.Content>
    </MenuPrimitive.Portal>
  </MenuPrimitive.Root>
);
