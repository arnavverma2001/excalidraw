import { BODY_SQUASH } from "./motion";

import type { Chain, FramePose } from "./motion";

const INK = "#141414";
export const PANTS = "#ff6b1a";
export const PANT_HALF_HIP = 4.8;
export const PANT_HALF_KNEE = 4.1;
export const PANT_HALF_ANKLE = 3.3;

type Pt = { x: number; y: number };

const line = (chain: Chain, withToe: boolean) =>
  withToe
    ? `${chain.ax},${chain.ay} ${chain.bx},${chain.by} ${chain.cx},${chain.cy} ${chain.dx},${chain.dy}`
    : `${chain.ax},${chain.ay} ${chain.bx},${chain.by} ${chain.cx},${chain.cy}`;

const normal = (from: Pt, to: Pt): Pt => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
};

const add = (point: Pt, dir: Pt, scale: number): Pt => ({
  x: point.x + dir.x * scale,
  y: point.y + dir.y * scale,
});

const fmt = (points: readonly Pt[]) =>
  points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");

/** Closed hip→knee→ankle fill wide enough to cover the ink legs. */
export const pantPolygon = (chain: Chain) => {
  const hip = { x: chain.ax, y: chain.ay };
  const knee = { x: chain.bx, y: chain.by };
  const ankle = { x: chain.cx, y: chain.cy };
  const thigh = normal(hip, knee);
  const shin = normal(knee, ankle);
  const atKnee = {
    x: thigh.x + shin.x,
    y: thigh.y + shin.y,
  };
  const kneeLen = Math.hypot(atKnee.x, atKnee.y) || 1;
  const kneeN = { x: atKnee.x / kneeLen, y: atKnee.y / kneeLen };

  return fmt([
    add(hip, thigh, PANT_HALF_HIP),
    add(knee, kneeN, PANT_HALF_KNEE),
    add(ankle, shin, PANT_HALF_ANKLE),
    add(ankle, shin, -PANT_HALF_ANKLE),
    add(knee, kneeN, -PANT_HALF_KNEE),
    add(hip, thigh, -PANT_HALF_HIP),
  ]);
};

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

const Pants = ({ chain }: { chain: Chain }) => (
  <polygon
    points={pantPolygon(chain)}
    fill={PANTS}
    stroke={PANTS}
    strokeWidth="1.2"
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
      <ellipse
        cx="13"
        cy={pose.shadowY}
        rx="6.5"
        ry="1.1"
        fill={`rgba(0,0,0,${pose.shadowOpacity})`}
      />
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
          <ellipse
            cx={pose.hipX}
            cy={pose.hipY + 1.4}
            rx={PANT_HALF_HIP + 0.6}
            ry="4.2"
            fill={PANTS}
          />
          {legs.map(({ chain, index }) => (
            <Pants key={`pants-${index}`} chain={chain} />
          ))}
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
