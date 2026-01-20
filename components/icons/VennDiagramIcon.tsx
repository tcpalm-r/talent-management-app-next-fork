import { SVGProps } from 'react';

export function VennDiagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Top circle */}
      <circle cx="12" cy="8" r="6" />
      {/* Bottom left circle */}
      <circle cx="8" cy="14" r="6" />
      {/* Bottom right circle */}
      <circle cx="16" cy="14" r="6" />
    </svg>
  );
}
