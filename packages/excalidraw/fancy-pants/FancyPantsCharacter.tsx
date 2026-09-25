import { useRef } from "react";

import {
  CLIMB_OMEGA,
  RUN_OMEGA,
  chainEnd,
  climbArm,
  climbLeg,
  hairBlowDegrees,
  jumpArms,
  jumpLegs,
  runArm,
  runLeg,
  stepWind,
} from "./poses";

import type { Joint } from "./poses";
import type { Anim } from "./physics";

const HIP = { x: 13, y: 26.5 };
const SHOULDER = { x: 13, y: 15.2 };
const HEAD = { x: 13, y: 8.2 };

const SPIKES = [
  { rest: -36, len: 7.2, w: 2.3 },
  { rest: -14, len: 9.4, w: 2.5 },
  { rest: 6, len: 10.2, w: 2.3 },
  { rest: 24, len: 8.2, w: 2.1 },
  { rest: 42, len: 6.4, w: 1.8 },
];

const limbPoints = (
  rootX: number,
  rootY: number,
  joint: Joint,
  upper: number,
  lower: number,
) => {
  const { knee, end } = chainEnd(joint, upper, lower);
  return {
    kneeX: rootX + knee.x,
    kneeY: rootY + knee.y,
    endX: rootX + end.x,
    endY: rootY + end.y,
  };
};

const Stick = ({
  x1,
  y1,
  x2,
  y2,
  x3,
  y3,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
}) => (
  <polyline
    points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`}
    fill="none"
    stroke="#141414"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

/**
 * Original stick figure. Motion is timed from watching a run, jump, and
 * climb: a full stride, arms opposite the legs, hair streaming backward.
 */
export const FancyPantsCharacter = ({
  anim,
  time,
  facing,
  climbingUp,
  speed = 0,
}: {
  anim: Anim;
  time: number;
  facing: 1 | -1;
  climbingUp: boolean;
  speed?: number;
}) => {
  const windRef = useRef(Math.min(1, Math.abs(speed) / 200));
  windRef.current = stepWind(
    windRef.current,
    anim === "idle" ? speed * 0.35 : speed,
  );
  const wind = windRef.current;
  const phase = time * (anim === "climb" ? CLIMB_OMEGA : RUN_OMEGA);

  const bob =
    anim === "run"
      ? Math.cos(phase * 2) * 2.1
      : anim === "idle"
      ? Math.sin(time * 2.6) * 0.7
      : anim === "climb"
      ? Math.sin(phase * 2) * 0.8
      : 0;
  const lean =
    anim === "run"
      ? 13
      : anim === "climb"
      ? climbingUp
        ? 18
        : 8
      : anim === "jump"
      ? -8
      : 2;

  let leadLeg: Joint;
  let trailLeg: Joint;
  let leadArm: Joint;
  let trailArm: Joint;

  if (anim === "jump") {
    const legs = jumpLegs();
    const arms = jumpArms();
    leadLeg = legs.lead;
    trailLeg = legs.trail;
    leadArm = arms.lead;
    trailArm = arms.trail;
  } else if (anim === "climb") {
    leadLeg = climbLeg(phase);
    trailLeg = climbLeg(phase + Math.PI);
    leadArm = climbArm(phase);
    trailArm = climbArm(phase + Math.PI);
  } else if (anim === "run") {
    leadLeg = runLeg(phase);
    trailLeg = runLeg(phase + Math.PI);
    leadArm = runArm(phase);
    trailArm = runArm(phase + Math.PI);
  } else {
    const sway = Math.sin(time * 1.7) * 0.06;
    leadLeg = { thigh: 0.12 + sway, knee: 0.16 };
    trailLeg = { thigh: -0.08 - sway, knee: 0.14 };
    leadArm = { thigh: 0.08 + sway, knee: 0.12 };
    trailArm = { thigh: -0.1 - sway, knee: 0.1 };
  }

  const legA = limbPoints(HIP.x, HIP.y, leadLeg, 9.2, 8.4);
  const legB = limbPoints(HIP.x, HIP.y, trailLeg, 9.2, 8.4);
  const armA = limbPoints(SHOULDER.x, SHOULDER.y, leadArm, 6.4, 5.6);
  const armB = limbPoints(SHOULDER.x, SHOULDER.y, trailArm, 6.4, 5.6);
  const blow = hairBlowDegrees(speed, wind, facing);
  const hairShift = (blow / 62) * 2.2;

  return (
    <svg
      viewBox="0 0 26 44"
      width="100%"
      height="100%"
      aria-hidden="true"
      overflow="visible"
      data-wind={wind.toFixed(2)}
    >
      <g transform={`translate(0 ${bob})`}>
        <g transform={`translate(13 0) scale(${facing} 1) translate(-13 0)`}>
          <g transform={`rotate(${lean} 13 42)`}>
            <ellipse
              cx="13"
              cy="43"
              rx="6.5"
              ry="1.1"
              fill="rgba(0,0,0,0.16)"
            />
            <Stick
              x1={SHOULDER.x}
              y1={SHOULDER.y}
              x2={armA.kneeX}
              y2={armA.kneeY}
              x3={armA.endX}
              y3={armA.endY}
            />
            <Stick
              x1={SHOULDER.x}
              y1={SHOULDER.y}
              x2={armB.kneeX}
              y2={armB.kneeY}
              x3={armB.endX}
              y3={armB.endY}
            />
            <line
              x1={HEAD.x}
              y1={HEAD.y + 4}
              x2={HIP.x}
              y2={HIP.y}
              stroke="#141414"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
            <Stick
              x1={HIP.x}
              y1={HIP.y}
              x2={legA.kneeX}
              y2={legA.kneeY}
              x3={legA.endX}
              y3={legA.endY}
            />
            <Stick
              x1={HIP.x}
              y1={HIP.y}
              x2={legB.kneeX}
              y2={legB.kneeY}
              x3={legB.endX}
              y3={legB.endY}
            />
            <line
              x1={legA.endX - 2.2}
              y1={legA.endY}
              x2={legA.endX + 2.4}
              y2={legA.endY}
              stroke="#141414"
              strokeWidth="2.1"
              strokeLinecap="round"
            />
            <line
              x1={legB.endX - 2.2}
              y1={legB.endY}
              x2={legB.endX + 2.4}
              y2={legB.endY}
              stroke="#141414"
              strokeWidth="2.1"
              strokeLinecap="round"
            />
            <g transform={`translate(${hairShift} 0)`}>
              {SPIKES.map((spike, index) => {
                const flutter =
                  wind > 0.25
                    ? Math.sin(time * 24 + index * 0.8) * 7 * wind
                    : Math.sin(time * 2.1 + index) * 2.4;
                const len = spike.len * (1 + wind * 0.5);
                const angle = spike.rest + blow + flutter;
                return (
                  <polygon
                    key={index}
                    fill="#141414"
                    points={`0,${-len} ${-spike.w / 2},0 ${spike.w / 2},0`}
                    transform={`translate(${HEAD.x} ${HEAD.y}) rotate(${angle}) translate(0 -4.3)`}
                  />
                );
              })}
            </g>
            <circle cx={HEAD.x} cy={HEAD.y} r="4.35" fill="#141414" />
            <circle
              cx={HEAD.x + 1.5}
              cy={HEAD.y - 0.2}
              r="0.7"
              fill="#f4f1ea"
            />
          </g>
        </g>
      </g>
    </svg>
  );
};
