interface BrandMarkProps {
  readonly size: number;
}

/** The football from the site icon, drawn in the current text colour. */
export const BrandMark = ({ size }: BrandMarkProps) => <svg
  aria-hidden="true"
  fill="none"
  height={size}
  viewBox="0 0 64 64"
  width={size}
>
  <ellipse
    cx="32"
    cy="32"
    rx="22"
    ry="14"
    stroke="currentColor"
    strokeWidth="4"
    transform="rotate(-30 32 32)"
  />
  <line stroke="currentColor" strokeLinecap="round" strokeWidth="4" x1="26" x2="38" y1="35.5" y2="28.5" />
</svg>;
