/** Constants for CreateSkillFromConventionsModal. */

/** Wider than the skills create modal: this one carries a code editor. */
export const MODAL_WIDTH = 820;

/** Rows for the body editor — enough to read a rule and its evidence at once. */
export const BODY_ROWS = 14;

/**
 * Characters per token, for the body's size hint. The same crude estimate the
 * run trace uses (`PromptBlock`), and crude on purpose: the number is there to
 * compare one body against another, not to predict a bill.
 */
export const CHARS_PER_TOKEN = 4;
