/**
 * Same-screen round logic.
 *
 * Collab syncs canvas elements through the room socket. It has no channel
 * for a secret prompt and guesses, and adding one would mean a new message
 * type plus room state. v1 keeps the prompt on this machine: the drawer
 * reads it here, and the guesser types into the guess box.
 */

export const ROUND_DURATION_MS = 60_000;

export type RoundStatus = "playing" | "correct" | "timeout";

export type PictionaryRound = {
  word: string;
  startedAtMs: number;
  durationMs: number;
  status: RoundStatus;
  endedAtMs: number | null;
  lastGuess: string | null;
  lastResult: "correct" | "incorrect" | null;
};

export type GuessOutcome = "correct" | "incorrect" | "empty" | "closed";

export function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function answersMatch(word: string, guess: string): boolean {
  const normalizedGuess = normalizeAnswer(guess);
  return (
    normalizedGuess.length > 0 && normalizedGuess === normalizeAnswer(word)
  );
}

export function pickWord(
  words: readonly string[],
  random: () => number = Math.random,
  avoid?: string,
): string {
  if (words.length === 0) {
    throw new Error("Pictionary word list is empty");
  }

  const avoided = avoid ? normalizeAnswer(avoid) : "";
  const eligible =
    avoided.length > 0
      ? words.filter((word) => normalizeAnswer(word) !== avoided)
      : words;
  const source = eligible.length > 0 ? eligible : words;
  const index = Math.min(
    source.length - 1,
    Math.max(0, Math.floor(random() * source.length)),
  );

  return source[index];
}

export function startRound(options: {
  words: readonly string[];
  nowMs: number;
  random?: () => number;
  avoid?: string;
  durationMs?: number;
}): PictionaryRound {
  return {
    word: pickWord(options.words, options.random, options.avoid),
    startedAtMs: options.nowMs,
    durationMs: options.durationMs ?? ROUND_DURATION_MS,
    status: "playing",
    endedAtMs: null,
    lastGuess: null,
    lastResult: null,
  };
}

export function remainingMs(round: PictionaryRound, nowMs: number): number {
  if (round.status === "timeout") {
    return 0;
  }
  const at = round.status === "playing" ? nowMs : round.endedAtMs ?? nowMs;
  return Math.max(0, round.startedAtMs + round.durationMs - at);
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function tickRound(
  round: PictionaryRound,
  nowMs: number,
): PictionaryRound {
  if (round.status !== "playing") {
    return round;
  }
  if (nowMs >= round.startedAtMs + round.durationMs) {
    return {
      ...round,
      status: "timeout",
      endedAtMs: round.startedAtMs + round.durationMs,
    };
  }
  return round;
}

export function submitGuess(
  round: PictionaryRound,
  guess: string,
  nowMs: number,
): { round: PictionaryRound; outcome: GuessOutcome } {
  const current = tickRound(round, nowMs);
  if (current.status !== "playing") {
    return { round: current, outcome: "closed" };
  }
  if (!normalizeAnswer(guess)) {
    return { round: current, outcome: "empty" };
  }
  if (answersMatch(current.word, guess)) {
    return {
      outcome: "correct",
      round: {
        ...current,
        status: "correct",
        endedAtMs: nowMs,
        lastGuess: guess.trim(),
        lastResult: "correct",
      },
    };
  }
  return {
    outcome: "incorrect",
    round: {
      ...current,
      lastGuess: guess.trim(),
      lastResult: "incorrect",
    },
  };
}
