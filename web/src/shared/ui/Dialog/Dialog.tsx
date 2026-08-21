import * as DialogPrimitive from "@radix-ui/react-dialog";
import clsx from "clsx";
import { X } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { VisuallyHidden } from "../VisuallyHidden/VisuallyHidden.js";
import "./Dialog.css";

export interface DialogProps {
  readonly children: ReactNode;
  readonly contentClassName?: string;
  readonly description?: string;
  readonly dismissible?: boolean;
  readonly footer?: ReactNode;
  readonly onOpenChange?: (open: boolean) => void;
  readonly open?: boolean;
  readonly title: string;
  readonly trigger?: ReactElement;
}

export const Dialog = ({
  children,
  contentClassName,
  description,
  dismissible = true,
  footer,
  onOpenChange,
  open,
  title,
  trigger,
}: DialogProps) => (
  <DialogPrimitive.Root
    {...(onOpenChange === undefined ? {} : {
      onOpenChange: (nextOpen: boolean) => {
        if (nextOpen || dismissible) onOpenChange(nextOpen);
      },
    })}
    {...(open === undefined ? {} : { open })}
  >
    {trigger !== undefined && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog__overlay" data-testid="dialog-overlay" />
      <DialogPrimitive.Content
        className={clsx("dialog__content", contentClassName)}
        onEscapeKeyDown={event => { if (!dismissible) event.preventDefault(); }}
        onInteractOutside={event => { if (!dismissible) event.preventDefault(); }}
        onPointerDownOutside={event => { if (!dismissible) event.preventDefault(); }}
      >
        <header className="dialog__header">
          <div>
            <DialogPrimitive.Title className="dialog__title">{title}</DialogPrimitive.Title>
            {description !== undefined && (
              <DialogPrimitive.Description className="dialog__description">
                {description}
              </DialogPrimitive.Description>
            )}
            {description === undefined && (
              <VisuallyHidden>
                <DialogPrimitive.Description>{title} dialog</DialogPrimitive.Description>
              </VisuallyHidden>
            )}
          </div>
        </header>
        <div className="dialog__body">{children}</div>
        {footer !== undefined && <footer className="dialog__footer">{footer}</footer>}
        {dismissible && <DialogPrimitive.Close aria-label="Close dialog" className="dialog__close">
          <X aria-hidden="true" size={20} />
        </DialogPrimitive.Close>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
);
