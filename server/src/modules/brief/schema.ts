/**
 * PR Brief (L05) — the model's answer (D-21). Internal: never part of
 * `@devdigest/shared`; the stored and served shape is `PrBrief`.
 *
 * Every field is required (strict json_schema mode) and there is no
 * `.min` / `.int` / `.max`: a provider may reject constraints in a strict
 * schema, and the adapter's own parse must not fail on them (no second
 * request may follow — `maxRetries: 0`, R-12). The strict rules of R-33 run in
 * `validateAnswer` after the call; caps (R-35) and path grounding (R-30…R-32)
 * run in `groundAnswer`.
 */
import { z } from 'zod';
import { RiskSeverity } from '@devdigest/shared';

export const BriefModelAnswer = z.object({
  summary: z
    .string()
    .describe('What the PR does and why, in plain English text, at most 600 characters. No markdown, no links.'),
  risks: z
    .array(
      z.object({
        kind: z.string().describe('Short category, e.g. "security", "data-loss", "compatibility", "performance".'),
        title: z.string().describe('One line naming the risk.'),
        explanation: z.string().describe('Two or three plain-text sentences: what could go wrong and why.'),
        severity: RiskSeverity,
        file_refs: z
          .array(z.string())
          .describe(
            'Where the risk lives: "<path>", "<path>:<line>" or "<path>:<start>-<end>". Paths copied exactly from the changed-files or blast-radius blocks.',
          ),
      }),
    )
    .describe('At most 5 risks, most important first.'),
  review_focus: z
    .array(
      z.object({
        file: z.string().describe('A path copied exactly from the changed-files or blast-radius blocks.'),
        line: z
          .number()
          .describe('A new-side line inside the file\'s "lines:" ranges, or a caller line from the blast-radius block.'),
        reason: z.string().describe('One sentence: why a reviewer should read this line first.'),
      }),
    )
    .describe('At most 6 places to read first, in reading order.'),
});
export type BriefModelAnswer = z.infer<typeof BriefModelAnswer>;
