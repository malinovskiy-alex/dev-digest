/**
 * Onboarding Tour (L05) — the two internal zod shapes: the model's answer
 * (`TourNarrative`) and the envelope stored in `onboarding.json` (`StoredTour`).
 * Neither is a public contract; the DTO is `OnboardingTour` in `@devdigest/shared`.
 */
import { z } from 'zod';
import { TourComponentKind, TourSections } from '@devdigest/shared';

/**
 * The model's answer. Every field is required (strict json_schema mode) and
 * there is no `.min`/`.max`: caps and validity are enforced by grounding, in
 * code, after the call (step 6). The model never writes a path, a command or a
 * task target of its own — it refers to ids and paths it was given.
 */
export const TourNarrative = z.object({
  architecture: z.object({
    prose: z
      .string()
      .describe(
        'Markdown, 2-5 short paragraphs or bullets: the stack, the entry points and the request flow. Every path and identifier in backticks.',
      ),
    components: z
      .array(
        z.object({
          id: z.string().describe('Short unique id, e.g. "api".'),
          label: z.string().describe('One-line box label, at most 40 characters.'),
          kind: TourComponentKind,
          ref: z
            .string()
            .describe(
              'An indexed file path, a top-level folder or a dependency name copied verbatim from the facts. Never a URL.',
            ),
        }),
      )
      .describe('The main pieces of the system, for a box-and-arrow diagram.'),
    connections: z
      .array(
        z.object({
          from: z.string().describe('A component id.'),
          to: z.string().describe('A component id.'),
        }),
      )
      .describe('Directed edges between component ids.'),
  }),
  critical_paths: z
    .array(
      z.object({
        path: z.string().describe('A path from the critical-paths block.'),
        reason: z.string().describe('One line: why this file matters.'),
      }),
    )
    .describe('One reason per given critical path.'),
  commands: z
    .array(
      z.object({
        id: z.string().describe('A command id from the commands block, e.g. "cmd-2".'),
        comment: z.string().describe('One line: what this step does.'),
      }),
    )
    .describe('The given command ids in the order a newcomer should run them.'),
  reading_path: z
    .array(
      z.object({
        path: z.string().describe('A path from the reading-path block.'),
        why: z.string().describe('One line: why read this file at this point.'),
      }),
    )
    .describe('One why per given reading-path file, in the given order.'),
  tasks: z
    .array(
      z.object({
        candidate_id: z.string().describe('Exactly one id from the task-candidates block.'),
        title: z.string().describe('A short task title.'),
        reason: z.string().describe('One line: why this is a good first task.'),
      }),
    )
    .describe('3-5 good first tasks, each tied to one candidate.'),
});
export type TourNarrative = z.infer<typeof TourNarrative>;

/**
 * The versioned envelope stored in `onboarding.json` (D-4). On read it is
 * `safeParse`d; a row that does not parse counts as "no stored tour".
 */
export const StoredTour = z.object({
  v: z.literal(1),
  revision: z.string(),
  index_files: z.number().int(),
  source_files: z.number().int().nullable(),
  coverage_partial: z.boolean(),
  index_partial: z.boolean(),
  trimmed: z.boolean(),
  provider: z.string(),
  model: z.string(),
  cost_usd: z.number().nullable(),
  sections: TourSections,
});
export type StoredTour = z.infer<typeof StoredTour>;
