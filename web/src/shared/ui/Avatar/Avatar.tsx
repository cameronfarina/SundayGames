import clsx from "clsx";
import { accountInitials, avatarTone } from "./accountIdentity";
import "./Avatar.css";

export type AvatarSize = "sm" | "md" | "lg";

export interface AvatarProps {
  readonly className?: string;
  readonly displayName?: string;
  readonly email: string;
  /** Seeds the colour. Pass the account id so a rename keeps the colour. */
  readonly seed: string;
  readonly size?: AvatarSize;
}

export const Avatar = ({ className, displayName, email, seed, size = "md" }: AvatarProps) => (
  <span
    aria-hidden="true"
    className={clsx(
      "avatar",
      `avatar--${size}`,
      `avatar--tone-${String(avatarTone(seed))}`,
      className,
    )}
  >
    {accountInitials(email, displayName)}
  </span>
);
