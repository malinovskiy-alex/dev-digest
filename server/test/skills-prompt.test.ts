import { describe, it, expect } from 'vitest';
import { assemblePrompt } from '@devdigest/reviewer-core';

/**
 * L02 — skills reach the prompt (spec §11, row 3). Pure assembly, no Postgres,
 * no LLM, no executor: `run-executor` resolves the ordered, enabled skill
 * bodies and hands them to `reviewPullRequest`, which forwards them verbatim to
 * `assemblePrompt`. Everything the product promises about skills-in-the-prompt
 * is therefore decided by `assemblePrompt`, and is pinned here exactly.
 *
 * The repository side (attached + globally enabled + ordered by
 * `agent_skills.order`) is covered by `skills.it.test.ts`; this file covers what
 * happens to those bodies once they are resolved.
 */

const BASE = {
  system: 'You are a reviewer.',
  diff: '@@ -1 +1 @@\n+const stripeKey = "sk_live_1"',
  task: "Review PR #482 'rate limit'",
} as const;

const SKILL_A = '# Flake patterns\nA sleep is not a synchronisation primitive.';
const SKILL_B = '# API contract gate\nA response shape change needs a version note.';

describe('assemblePrompt + skills', () => {
  it('keeps both skill bodies, in the order given', () => {
    const { assembly } = assemblePrompt({ ...BASE, skills: [SKILL_A, SKILL_B] });

    expect(assembly.skills).toContain(SKILL_A);
    expect(assembly.skills).toContain(SKILL_B);
    // Order is the product contract: `agent_skills.order` → prompt order, so a
    // user reordering skills in the Agent editor reorders the instructions the
    // model reads. Assert positionally, not just membership.
    expect(assembly.skills!.indexOf(SKILL_A)).toBeLessThan(assembly.skills!.indexOf(SKILL_B));
  });

  it('renders ## Skills / rules in the user message with both bodies', () => {
    const { messages } = assemblePrompt({ ...BASE, skills: [SKILL_A, SKILL_B] });
    const user = messages[1]!.content;

    expect(user).toContain('## Skills / rules');
    expect(user).toContain(SKILL_A);
    expect(user).toContain(SKILL_B);
    expect(user.indexOf(SKILL_A)).toBeLessThan(user.indexOf(SKILL_B));
  });

  it('places the skills block OUTSIDE every <untrusted> block (D6)', () => {
    /**
     * This is the tripwire for spec D6, and it is counter-intuitive on purpose.
     *
     * An enabled skill is INSTRUCTIONS, not data. The system prompt carries
     * INJECTION_GUARD (`reviewer-core/src/prompt.ts:16`), which tells the model
     * that everything inside <untrusted>…</untrusted> is data to be analyzed and
     * that any instruction found there must be ignored. So a skill body wrapped
     * in those delimiters — the "obvious" hardening for anyone who reads the
     * guard and sees an un-wrapped block — would be neutralised: the skill could
     * never flag anything, every skill in the product would silently stop
     * working, and no other test would notice. Hence this assertion.
     *
     * The safety for imported skills lives in the lifecycle instead: stored
     * `enabled = false`, full body shown in the import preview, nothing reaches
     * the prompt until it is enabled AND attached.
     */
    const { messages } = assemblePrompt({
      ...BASE,
      skills: [SKILL_A],
      specs: ['# Security baseline\nNo secrets in code.'],
      prDescription: 'Adds a rate limiter.',
    });
    const user = messages[1]!.content;

    // The guard the skill must not fall under is present in this prompt at all.
    expect(messages[0]!.content).toContain('<untrusted>…</untrusted>');
    // And this prompt really does contain delimiter-wrapped sections (diff, PR
    // body, specs), so "not inside one" below is a meaningful claim.
    expect(user).toContain('<untrusted source="diff">');

    // Walk the untrusted regions and assert the skill body overlaps none of
    // them. `wrapUntrusted` escapes any nested `</untrusted>`, so these blocks
    // never nest and a linear scan is exact.
    const untrustedRegions: Array<[number, number]> = [];
    const open = /<untrusted source="[^"]*">/g;
    for (let m = open.exec(user); m !== null; m = open.exec(user)) {
      const end = user.indexOf('</untrusted>', m.index);
      expect(end).toBeGreaterThan(-1);
      untrustedRegions.push([m.index, end + '</untrusted>'.length]);
    }
    expect(untrustedRegions.length).toBeGreaterThan(0);

    const skillStart = user.indexOf(SKILL_A);
    const skillEnd = skillStart + SKILL_A.length;
    expect(skillStart).toBeGreaterThan(-1);
    for (const [from, to] of untrustedRegions) {
      expect(skillStart >= from && skillEnd <= to).toBe(false);
    }

    // Same for the heading — it sits between blocks, never inside one. (It is
    // NOT before all of them: `## PR description` is rendered first and is
    // delimiter-wrapped, so "outside" is the claim, not "first".)
    const headingAt = user.indexOf('## Skills / rules');
    expect(headingAt).toBeGreaterThan(-1);
    for (const [from, to] of untrustedRegions) {
      expect(headingAt >= from && headingAt < to).toBe(false);
    }
  });

  it('omits the section entirely when no skills are attached', () => {
    const { assembly, messages } = assemblePrompt(BASE);

    expect(assembly.skills).toBeNull();
    expect(messages[1]!.content).not.toContain('## Skills / rules');
  });

  it('is byte-identical with no skills, with skills: [], and to the pre-L02 baseline', () => {
    // The control-experiment baseline. `run-executor` spreads
    // `...(skills.length ? { skills } : {})`, so an agent with no skills calls
    // reviewPullRequest exactly as it did before L02. Pin BOTH arms: the
    // omitted-key call (what the executor makes) and the empty-array call (what
    // a future refactor might make) must produce the same bytes, and neither
    // may differ from the no-skills prompt in any character.
    const baseline = assemblePrompt(BASE);
    const empty = assemblePrompt({ ...BASE, skills: [] });

    expect(empty.messages[1]!.content).toBe(baseline.messages[1]!.content);
    expect(empty.messages[0]!.content).toBe(baseline.messages[0]!.content);
    expect(empty.assembly).toEqual(baseline.assembly);
    expect(empty.assembly.skills).toBeNull();

    // A skills call must actually differ — otherwise the identity above would
    // be vacuously true and the control experiment would prove nothing.
    const withSkill = assemblePrompt({ ...BASE, skills: [SKILL_A] });
    expect(withSkill.messages[1]!.content).not.toBe(baseline.messages[1]!.content);
  });
});
