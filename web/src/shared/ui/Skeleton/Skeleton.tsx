import clsx from "clsx";
import type { HTMLAttributes } from "react";
import "./Skeleton.css";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  readonly height?: string;
  readonly width?: string;
}

export const Skeleton = ({
  className,
  height = "1rem",
  style,
  width = "100%",
  ...elementProps
}: SkeletonProps) => (
  <div
    {...elementProps}
    aria-hidden="true"
    className={clsx("skeleton", className)}
    style={{ ...style, height, width }}
  />
);
