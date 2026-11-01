/** Tailwind class strings for the Onboarding Tour page. Same tokens as ProjectContextView/styles.ts. */
export const cx = {
  page: "flex flex-col gap-4",
  // Below `lg` (1024 px) the aside is hidden and the sections take the full width (AC-80).
  layout: "grid grid-cols-1 gap-6 items-start lg:grid-cols-[1fr_200px]",
  sections: "flex min-w-0 flex-col gap-4",
  aside: "sticky top-4 hidden lg:block",
  skeletons: "flex flex-col gap-3",
} as const;
