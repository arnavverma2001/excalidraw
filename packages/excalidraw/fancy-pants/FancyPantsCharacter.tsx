import { BODY_SQUASH } from "./motion";

import type { Chain, FramePose } from "./motion";

const INK = "#141414";

const line = (chain: Chain, withToe: boolean) =>
  withToe
    ? `${chain.ax},${chain.ay} ${chain.bx},${chain.by} ${chain.cx},${chain.cy} ${chain.dx},${chain.dy}`
    : `${chain.ax},${chain.ay} ${chain.bx},${chain.by} ${chain.cx},${chain.cy}`;

const Limb = ({ chain, toe }: { chain: Chain; toe: boolean }) => (
  <polyline
    points={line(chain, toe)}
    fill="none"
    stroke={INK}
    strokeWidth="1.35"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

/**
 * Draws the pose from stepLook. Facing, lean, and flight are already
 * baked into the coordinates. Hair rotation is world-space.
 */
export const FancyPantsCharacter = ({ pose }: { pose: FramePose }) => {
  const sy = 1 - Math.min(1.2, Math.max(-0.35, pose.compress)) * BODY_SQUASH;
  const legs = pose.legs
    .map((chain, index) => ({ chain, index }))
    .sort((a, b) => a.chain.cx - b.chain.cx);

  return (
    <svg
      viewBox="0 0 26 44"
      width="100%"
      height="100%"
      aria-hidden="true"
      overflow="visible"
    >
      <ellipse cx="13" cy="43" rx="6.5" ry="1.1" fill="rgba(0,0,0,0.16)" />
      <g transform={`translate(0 ${pose.bob})`}>
        <g transform={`translate(13 42.3) scale(1 ${sy}) translate(-13 -42.3)`}>
          {pose.arms.map((chain, index) => (
            <Limb key={`arm-${index}`} chain={chain} toe={false} />
          ))}
          <line
            x1={pose.shoulderX}
            y1={pose.shoulderY}
            x2={pose.hipX}
            y2={pose.hipY}
            stroke={INK}
            strokeWidth="1.35"
            strokeLinecap="round"
          />
          {legs.map(({ chain, index }) => (
            <Limb key={`leg-${index}`} chain={chain} toe />
          ))}
          <circle cx={pose.headX} cy={pose.headY} r="4.35" fill={INK} />
          <circle cx={pose.eyeX} cy={pose.eyeY} r="0.9" fill="#f4f1ea" />
        </g>
      </g>
      <g transform={`translate(${pose.hairX} ${pose.hairY})`}>
        {pose.spikes.map((spike, index) => (
          <polygon
            key={index}
            fill={INK}
            points={`0,${-spike.len} ${-spike.w / 2},0 ${spike.w / 2},0`}
            transform={`rotate(${spike.angle}) translate(0 -4.3)`}
          />
        ))}
      </g>
    </svg>
  );
};
