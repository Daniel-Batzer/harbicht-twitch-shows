import { z } from "zod";

// Boundary validation for the voting-timer field of the host's start form
// (Decisions 029, 047). Kept outside the "use server" actions file so it can
// be tested. The domain only requires a positive whole number of seconds or
// null; the presets and the custom range are a choice of this form.

/** The form offers these durations, plus "no timer" and a custom value. */
export const VOTING_DURATION_PRESETS = [30, 60, 90] as const;

export const CUSTOM_VOTING_DURATION_LIMITS = { minSeconds: 10, maxSeconds: 600 } as const;

/** Radio value for "no timer". */
export const NO_VOTING_TIMER = "NONE";
/** Radio value for a custom duration; the seconds come from a separate field. */
export const CUSTOM_VOTING_TIMER = "CUSTOM";

const customSecondsSchema = z
  .string()
  .trim()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(
    z.number().int().min(CUSTOM_VOTING_DURATION_LIMITS.minSeconds).max(CUSTOM_VOTING_DURATION_LIMITS.maxSeconds),
  );

export type VotingDurationInputResult = { ok: true; votingDurationSeconds: number | null } | { ok: false };

/**
 * `choice` is the radio value (`NONE`, a preset such as `60`, or `CUSTOM`);
 * `customSeconds` is only read for `CUSTOM`. Anything else is rejected instead
 * of silently falling back to a default.
 */
export function parseVotingDurationInput(choice: unknown, customSeconds: unknown): VotingDurationInputResult {
  if (choice === NO_VOTING_TIMER) return { ok: true, votingDurationSeconds: null };

  if (choice === CUSTOM_VOTING_TIMER) {
    const parsed = customSecondsSchema.safeParse(customSeconds);
    return parsed.success ? { ok: true, votingDurationSeconds: parsed.data } : { ok: false };
  }

  const preset = VOTING_DURATION_PRESETS.find((seconds) => String(seconds) === choice);
  return preset === undefined ? { ok: false } : { ok: true, votingDurationSeconds: preset };
}
