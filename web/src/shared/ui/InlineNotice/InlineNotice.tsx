import {
  AlertCircle,
  CheckCircle2,
  CircleAlert,
  Info,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import "./InlineNotice.css";

export type NoticeVariant = "info" | "success" | "warning" | "error";

const noticeIcons: Record<NoticeVariant, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: CircleAlert,
  error: AlertCircle,
};

export interface InlineNoticeProps {
  readonly children: ReactNode;
  readonly title?: string;
  readonly variant: NoticeVariant;
}

export const InlineNotice = ({ children, title, variant }: InlineNoticeProps) => {
  const Icon = noticeIcons[variant];

  return (
    <div className={`inline-notice inline-notice--${variant}`} role={variant === "error" ? "alert" : "status"}>
      <Icon aria-hidden="true" className="inline-notice__icon" size={20} />
      <div>
        {title !== undefined && <strong className="inline-notice__title">{title}</strong>}
        <div className="inline-notice__message">{children}</div>
      </div>
    </div>
  );
};
