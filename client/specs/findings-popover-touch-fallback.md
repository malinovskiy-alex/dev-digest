# A touch fallback for the findings popover

**Status:** built, but not the way this plan describes — read the deviation
below before trusting the steps. Surfaced while building the popover (see
[`../../specs/L01-findings-by-severity.md`](../../specs/L01-findings-by-severity.md)).

## What shipped instead

Nothing branches on `pointerType`. A click **pins** the panel open on every
input, so the touch path and the mouse path are the same code:
`src/components/findings-popover/useFindingsPopover.ts`. Steps 2 and 4 of the
plan below are therefore moot — there is no non-mouse branch, and the delays
already only apply to the hover path, which touch never reaches.

Step 3 shipped as written: a document `mousedown` listener, registered only
while a *pinned* panel is open, closing on a target outside both the panel and
the trigger — and it does check the panel by ref, because the panel renders
outside the trigger's subtree.

One thing the plan did not anticipate: a click on a panel the pointer had
already opened must pin it, not toggle it shut. On a mouse, hover always wins
the race to open, so a plain toggle makes every click read as "dismiss".

**Goal:** make the PR list's findings preview reachable without a mouse pointer.

## The problem

`pulls/_components/FindingsCell/` opens its popover on `mouseenter` and on
`focus`. That covers a mouse and a keyboard. It does not cover touch:

- there is no hover on touch, so nothing opens on tap;
- and the trigger deliberately calls `preventDefault()` + `stopPropagation()` on
  click, so that a click on the chips does not fire the row's `router.push` to
  the PR detail page.

The combined effect is that on a phone or a tablet, tapping the `Findings` cell
does **nothing at all** — worse than before the popover existed, when the tap
would at least have opened the PR.

## What it should do

Tap the chips → the popover opens. Tap them again, tap outside, or press
`Escape` → it closes. The row still must not navigate from that tap.

## Plan

1. **Detect the input, not the device.** Branch on the `pointerType` of a
   `pointerdown` / `click` event (`"touch"` / `"pen"` vs `"mouse"`) rather than on
   a width media query or a user-agent string. A laptop with a touchscreen has
   both, and the right behaviour is per-interaction.
2. **In `FindingsCell.tsx`:** on a non-mouse pointer, toggle `anchor` instead of
   swallowing the event. Keep `preventDefault()`/`stopPropagation()` in both
   branches — the row must never navigate from this cell.
3. **Close on an outside tap.** The hover path never needed this; a tapped-open
   popover does. `vendor/ui/kit/Dropdown.tsx` has the pattern: a document
   `mousedown` listener that closes when the event target is outside the panel.
   Register it only while open, alongside the existing `scroll`/`resize`
   handlers — and note the panel is rendered outside the cell's subtree, so the
   check needs a ref on the panel, not `contains` on the cell.
4. **Leave the delays to the mouse.** `OPEN_DELAY_MS` exists so that sweeping the
   pointer across the list opens nothing. A tap is deliberate; open immediately,
   as the `focus` path already does.

## Tests

Extend `FindingsCell.test.tsx`:

- `fireEvent.pointerDown(trigger, { pointerType: "touch" })` then click → the
  dialog opens with no timer advance, and the mocked `router.push` is still not
  called;
- a second tap closes it;
- a tap outside closes it;
- the existing mouse tests stay green — a `pointerType: "mouse"` click must still
  open nothing.

## Not in scope

Making the previews themselves interactive. They stay read-only on every input
(`FindingPreview.test.tsx` enforces it); Accept/Reject belongs on the PR detail
page.
