type BrandMarkProps = {
  size?: number;
  className?: string;
};

export default function BrandMark({ size = 24, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="8" cy="16" r="3.25" fill="currentColor" opacity="0.95" />
      <circle cx="16" cy="8" r="3.25" fill="currentColor" opacity="0.9" />
      <circle cx="24" cy="16" r="3.25" fill="currentColor" opacity="0.95" />
      <circle cx="16" cy="24" r="3.25" fill="currentColor" opacity="0.7" />
      <path
        d="M10.7 14.1 13.2 10.9M18.8 10.9l2.5 3.2M21.3 17.9l-2.5 3.2M13.2 21.1l-2.5-3.2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="2.25" fill="currentColor" />
    </svg>
  );
}
