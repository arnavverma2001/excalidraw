import { PICTIONARY_WORDS } from "./words";

import {
  answersMatch,
  formatClock,
  normalizeAnswer,
  pickWord,
  remainingMs,
  ROUND_DURATION_MS,
  startRound,
  submitGuess,
  tickRound,
} from "./game";

const words = ["Ice cream", "Cat", "Hot dog"];

describe("pictionary round", () => {
  it("normalizes case, spacing, and punctuation", () => {
    expect(normalizeAnswer("  Ice-Cream! ")).toBe("icecream");
    expect(normalizeAnswer("hot   dog")).toBe("hotdog");
    expect(answersMatch("Ice cream", "ice-cream")).toBe(true);
    expect(answersMatch("Cat", "cats")).toBe(false);
    expect(answersMatch("Cat", "???")).toBe(false);
  });

  it("picks a listed word and skips the previous prompt", () => {
    expect(pickWord(words, () => 0)).toBe("Ice cream");
    expect(pickWord(words, () => 0.99)).toBe("Hot dog");
    expect(pickWord(words, () => 0, "Ice cream")).toBe("Cat");
    expect(pickWord(["Cat"], () => 0, "Cat")).toBe("Cat");
    expect(() => pickWord([], () => 0)).toThrow(/empty/);
  });

  it("starts a playing round on the built-in list", () => {
    const round = startRound({
      words: PICTIONARY_WORDS,
      nowMs: 1_000,
      random: () => 0,
    });

    expect(PICTIONARY_WORDS).toContain(round.word);
    expect(round.status).toBe("playing");
    expect(round.durationMs).toBe(ROUND_DURATION_MS);
    expect(round.startedAtMs).toBe(1_000);
    expect(remainingMs(round, 1_000)).toBe(ROUND_DURATION_MS);
    expect(formatClock(ROUND_DURATION_MS)).toBe("1:00");
    expect(formatClock(1_500)).toBe("0:02");
    expect(formatClock(0)).toBe("0:00");
  });

  it("rejects a wrong guess and keeps the round open", () => {
    const round = startRound({ words, nowMs: 0, random: () => 0 });
    const result = submitGuess(round, "banana", 1_000);

    expect(result.outcome).toBe("incorrect");
    expect(result.round.status).toBe("playing");
    expect(result.round.lastGuess).toBe("banana");
    expect(result.round.lastResult).toBe("incorrect");
    expect(result.round.word).toBe(round.word);
    expect(remainingMs(result.round, 1_000)).toBe(ROUND_DURATION_MS - 1_000);
  });

  it("accepts a matching guess and closes the round", () => {
    const round = startRound({ words, nowMs: 0, random: () => 0 });
    const result = submitGuess(round, " ICE cream ", 5_000);

    expect(result.outcome).toBe("correct");
    expect(result.round.status).toBe("correct");
    expect(result.round.lastResult).toBe("correct");
    expect(remainingMs(result.round, 5_000)).toBe(ROUND_DURATION_MS - 5_000);
    expect(remainingMs(result.round, 50_000)).toBe(ROUND_DURATION_MS - 5_000);

    const again = submitGuess(result.round, "ice cream", 6_000);
    expect(again.outcome).toBe("closed");
    expect(again.round).toBe(result.round);
  });

  it("ignores an empty guess", () => {
    const round = startRound({ words, nowMs: 0, random: () => 0 });
    const result = submitGuess(round, "   ", 100);

    expect(result.outcome).toBe("empty");
    expect(result.round).toBe(round);
  });

  it("times out when the clock runs out, including mid-guess", () => {
    const round = startRound({
      words,
      nowMs: 0,
      random: () => 0,
      durationMs: 5_000,
    });

    expect(tickRound(round, 4_999)).toBe(round);
    const expired = tickRound(round, 5_000);
    expect(expired.status).toBe("timeout");
    expect(tickRound(expired, 9_000)).toBe(expired);
    expect(formatClock(remainingMs(expired, 9_000))).toBe("0:00");

    const late = submitGuess(round, "ice cream", 5_000);
    expect(late.outcome).toBe("closed");
    expect(late.round.status).toBe("timeout");
  });

  it("ships a non-empty list of distinct prompts", () => {
    const normalized = PICTIONARY_WORDS.map((word) => normalizeAnswer(word));
    expect(normalized.length).toBeGreaterThan(40);
    expect(new Set(normalized).size).toBe(normalized.length);
    expect(normalized.every((word) => word.length > 0)).toBe(true);
  });
});
