/** Tailwind class strings for the Onboarding Tour page. Same tokens as ProjectContextView/styles.ts. */
export const cx = {
  // Top padding keeps the heading well clear of the shell's top bar (design D-3).
  page: "px-8 pb-12 pt-9",
  // "On this page" is a left column; below `lg` (1024 px) it is hidden and the
  // content takes the full width (AC-80, design D-1).
  layout: "grid grid-cols-1 items-start gap-10 lg:grid-cols-[220px_minmax(0,1fr)]",
  aside: "sticky top-9 hidden lg:block",
  content: "flex min-w-0 flex-col gap-7",
  sections: "flex min-w-0 flex-col gap-6",
  skeletons: "flex flex-col gap-3 px-8 pt-9",
} as const;
