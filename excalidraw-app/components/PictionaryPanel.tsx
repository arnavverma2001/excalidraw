import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { newElementWith } from "@excalidraw/element";
import React, { useEffect, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  formatClock,
  remainingMs,
  startRound,
  submitGuess,
  tickRound,
} from "../pictionary/game";
import { PICTIONARY_WORDS } from "../pictionary/words";

import "./PictionaryPanel.scss";

import type { PictionaryRound } from "../pictionary/game";

const clearDrawing = (excalidrawAPI: ExcalidrawImperativeAPI | null) => {
  if (!excalidrawAPI) {
    return;
  }
  const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
  if (!elements.some((element) => !element.isDeleted)) {
    return;
  }
  excalidrawAPI.updateScene({
    elements: elements.map((element) =>
      element.isDeleted
        ? element
        : newElementWith(element, { isDeleted: true }),
    ),
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
};

export const PictionaryPanel: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onExit: () => void;
}> = ({ excalidrawAPI, onExit }) => {
  const [round, setRound] = useState<PictionaryRound>(() =>
    startRound({ words: PICTIONARY_WORDS, nowMs: Date.now() }),
  );
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [guess, setGuess] = useState("");
  const [wordHidden, setWordHidden] = useState(false);

  useEffect(() => {
    if (round.status !== "playing") {
      return;
    }
    const id = window.setInterval(() => {
      const nextNow = Date.now();
      setNowMs(nextNow);
      setRound((current) => tickRound(current, nextNow));
    }, 250);
    return () => window.clearInterval(id);
  }, [round.status]);

  const playing = round.status === "playing";
  const showWord = !playing || !wordHidden;
  const clockMs = remainingMs(round, nowMs ?? round.startedAtMs);
  const lowTime = playing && clockMs <= 10_000;

  const onGuess = (event: React.FormEvent) => {
    event.preventDefault();
    const result = submitGuess(round, guess, Date.now());
    setRound(result.round);
    if (result.outcome === "correct" || result.outcome === "incorrect") {
      setGuess("");
    }
  };

  const onNextRound = () => {
    clearDrawing(excalidrawAPI);
    setRound((current) =>
      startRound({
        words: PICTIONARY_WORDS,
        nowMs: Date.now(),
        avoid: current.word,
      }),
    );
    setNowMs(null);
    setGuess("");
    setWordHidden(false);
  };

  let feedback: string | null = null;
  let feedbackTone: "correct" | "incorrect" | "timeout" | null = null;
  if (round.status === "correct") {
    feedback = `Correct. The word was ${round.word}.`;
    feedbackTone = "correct";
  } else if (round.status === "timeout") {
    feedback = `Time's up. The word was ${round.word}.`;
    feedbackTone = "timeout";
  } else if (round.lastResult === "incorrect" && round.lastGuess) {
    feedback = `"${round.lastGuess}" is not the word.`;
    feedbackTone = "incorrect";
  }

  return (
    <section
      className="pictionary-panel"
      data-testid="pictionary-panel"
      aria-label="Pictionary"
    >
      <div className="pictionary-panel__header">
        <div className="pictionary-panel__title">Pictionary</div>
        <div
          className={
            lowTime
              ? "pictionary-panel__timer pictionary-panel__timer--low"
              : "pictionary-panel__timer"
          }
          data-testid="pictionary-timer"
          role="timer"
        >
          {formatClock(clockMs)}
        </div>
        <button
          type="button"
          className="pictionary-panel__exit"
          data-testid="pictionary-exit"
          onClick={onExit}
        >
          Exit
        </button>
      </div>

      <div className="pictionary-panel__section">
        <div className="pictionary-panel__label">Drawer</div>
        {showWord ? (
          <p className="pictionary-panel__word" data-testid="pictionary-word">
            {round.word}
          </p>
        ) : (
          <p className="pictionary-panel__word pictionary-panel__word--hidden">
            Word hidden
          </p>
        )}
        <div className="pictionary-panel__row">
          <p className="pictionary-panel__hint">
            Draw it on the canvas. Hide the word before handing the screen over.
          </p>
          {playing && (
            <button
              type="button"
              data-testid="pictionary-hide-word"
              onClick={() => setWordHidden((hidden) => !hidden)}
            >
              {wordHidden ? "Show word" : "Hide word"}
            </button>
          )}
        </div>
      </div>

      <form
        className="pictionary-panel__section"
        onSubmit={onGuess}
        aria-label="Guesser"
      >
        <div className="pictionary-panel__label">Guesser</div>
        <div className="pictionary-panel__guess-form">
          <input
            id="pictionary-guess"
            className="pictionary-panel__input"
            type="text"
            data-testid="pictionary-guess-input"
            aria-label="Guess"
            value={guess}
            autoComplete="off"
            disabled={!playing}
            placeholder={playing ? "Type a guess" : "Round over"}
            onChange={(event) => setGuess(event.target.value)}
          />
          <button
            type="submit"
            data-testid="pictionary-guess-submit"
            disabled={!playing || guess.trim().length === 0}
          >
            Guess
          </button>
        </div>
      </form>

      {feedback && feedbackTone && (
        <p
          className={`pictionary-panel__feedback pictionary-panel__feedback--${feedbackTone}`}
          data-testid="pictionary-feedback"
          role="status"
        >
          {feedback}
        </p>
      )}

      <div className="pictionary-panel__row">
        <button
          type="button"
          data-testid="pictionary-next"
          onClick={onNextRound}
        >
          Next round
        </button>
      </div>
    </section>
  );
};
