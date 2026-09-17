# reviewer-core/specs/

Engine plans written before the code. Anything that also needs persistence or a
screen belongs in the root [`../../specs/`](../../specs/) — the engine only ever
receives resolved strings.

Naming: `<slug>.md`, or `L<NN>-<slug>.md` when it implements a lesson.

An engine spec should answer, in this order:

1. **Which invariant it touches** — zero I/O, mandatory grounding, single
   trusted injection guard. If it weakens one, say so explicitly and justify it;
   the default answer is that it must not.
2. **Prompt slot** — the new optional field, where its section renders relative
   to the existing ones, and confirmation that an empty value omits the section.
3. **Trust level** — trusted (system, memory) or untrusted (anything derived
   from repo or PR content, which must be `wrapUntrusted`-ed).
4. **Grounding** — how the new findings are grounded; a new full-file `kind`
   needs an explicit entry in `FULL_FILE_KINDS` and a reason.
5. **Tests** — the stubbed-`LLMProvider` cases, including the drop path.
