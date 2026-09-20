import { SkillsListView } from "./_components/SkillsListView";

/* Route: /skills (Skills list + editor, L02). Thin route entry — the grid, the
   preview rail, the create modal, the import drawer, styles, constants, helpers
   and i18n are colocated under _components/SkillsListView. */
export default function SkillsPage() {
  return <SkillsListView />;
}
