import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import { Fragment, type ReactNode } from "react";
import "./DropdownMenu.css";

export interface DropdownMenuItem {
  readonly destructive?: boolean;
  readonly disabled?: boolean;
  readonly label: string;
  /** Hidden on wide screens, where the surrounding page shows this control. */
  readonly narrowOnly?: boolean;
  readonly onSelect: () => void;
  readonly selected?: boolean;
  /** Starts a new group. Without it, a marked row in one group runs into a
      marked row in the next and the two read as a single selection. */
  readonly startsGroup?: boolean;
}

export interface DropdownMenuProps {
  readonly children?: ReactNode;
  readonly items: readonly DropdownMenuItem[];
  readonly label: string;
}

export const DropdownMenu = ({ children, items, label }: DropdownMenuProps) => (
  <MenuPrimitive.Root modal={false}>
    <MenuPrimitive.Trigger aria-label={label} className="dropdown-menu__trigger">
      {children ?? "⋯"}
    </MenuPrimitive.Trigger>
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content className="dropdown-menu__content" sideOffset={6}>
        {items.map(item => (
          <Fragment key={item.label}>
          {item.startsGroup === true && (
            <MenuPrimitive.Separator className="dropdown-menu__separator" />
          )}
          <MenuPrimitive.Item
            className={clsx(
              "dropdown-menu__item",
              item.destructive && "dropdown-menu__item--danger",
              item.narrowOnly === true && "dropdown-menu__item--narrow",
              item.selected === true && "dropdown-menu__item--selected",
            )}
            aria-current={item.selected === true ? "true" : undefined}
            onSelect={item.onSelect}
            {...(item.disabled === undefined ? {} : { disabled: item.disabled })}
          >
            {item.label}
          </MenuPrimitive.Item>
          </Fragment>
        ))}
      </MenuPrimitive.Content>
    </MenuPrimitive.Portal>
  </MenuPrimitive.Root>
);
