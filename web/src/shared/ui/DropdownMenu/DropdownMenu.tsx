import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import { Fragment, type ReactNode } from "react";
import "./DropdownMenu.css";

/** Widths at which the surrounding page takes a control back from this menu. */
export type DropdownMenuWidth = "tablet" | "laptop";

export interface DropdownMenuItem {
  readonly destructive?: boolean;
  readonly disabled?: boolean;
  /** Hides this group's divider from this width up, for when every row above
      the divider is gone. */
  readonly dividerHiddenFrom?: DropdownMenuWidth;
  /** Hidden from this width up, where the surrounding page shows this control. */
  readonly hiddenFrom?: DropdownMenuWidth;
  readonly label: string;
  readonly onSelect: () => void;
  readonly selected?: boolean;
  /** Starts a new group. Without it, a marked row in one group runs into a
      marked row in the next and the two read as a single selection. */
  readonly startsGroup?: boolean;
}

export interface DropdownMenuProps {
  readonly children?: ReactNode;
  /** Non-interactive block above the rows, for identity or context. */
  readonly header?: ReactNode;
  readonly items: readonly DropdownMenuItem[];
  readonly label: string;
}

export const DropdownMenu = ({ children, header, items, label }: DropdownMenuProps) => (
  <MenuPrimitive.Root modal={false}>
    <MenuPrimitive.Trigger aria-label={label} className="dropdown-menu__trigger">
      {children ?? "⋯"}
    </MenuPrimitive.Trigger>
    <MenuPrimitive.Portal>
      {/* Ending on the trigger's edge keeps the panel inside whatever gutter the
          trigger already sits in. Centred, it overhangs and collision handling
          only pulls it back to the bare viewport edge. */}
      <MenuPrimitive.Content align="end" className="dropdown-menu__content" sideOffset={6}>
        {header !== undefined && <div className="dropdown-menu__header">{header}</div>}
        {items.map(item => (
          <Fragment key={item.label}>
          {item.startsGroup === true && (
            <MenuPrimitive.Separator
              className={clsx(
                "dropdown-menu__separator",
                item.dividerHiddenFrom !== undefined
                  && `dropdown-menu__separator--hidden-from-${item.dividerHiddenFrom}`,
              )}
            />
          )}
          <MenuPrimitive.Item
            className={clsx(
              "dropdown-menu__item",
              item.destructive && "dropdown-menu__item--danger",
              item.hiddenFrom !== undefined && `dropdown-menu__item--hidden-from-${item.hiddenFrom}`,
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
