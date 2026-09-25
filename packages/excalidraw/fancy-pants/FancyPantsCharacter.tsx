import type { Anim } from "./physics";

/**
 * Original vector runner. Geometric on purpose so it does not resemble
 * any existing game sprite.
 */
export const FancyPantsCharacter = ({
  anim,
  time,
  facing,
  climbingUp,
}: {
  anim: Anim;
  time: number;
  facing: 1 | -1;
  climbingUp: boolean;
}) => {
  const runSwing = anim === "run" ? Math.sin(time * 12) : 0;
  const climbSwing = anim === "climb" ? Math.sin(time * 8) : 0;
  const bob = anim === "idle" ? Math.sin(time * 3) * 1.1 : 0;
  const legL =
    anim === "jump" ? -28 : anim === "climb" ? climbSwing * 22 : runSwing * 30;
  const legR =
    anim === "jump"
      ? -16
      : anim === "climb"
      ? -climbSwing * 22
      : -runSwing * 30;
  const armL =
    anim === "jump"
      ? -130
      : anim === "climb"
      ? -150 + climbSwing * 16
      : runSwing * 26;
  const armR =
    anim === "jump"
      ? -110
      : anim === "climb"
      ? -150 - climbSwing * 16
      : -runSwing * 26;
  const tilt =
    anim === "climb" ? (climbingUp ? -8 : 10) : anim === "run" ? 6 : 0;

  return (
    <svg
      viewBox="0 0 26 44"
      width="100%"
      height="100%"
      aria-hidden="true"
      style={{
        transform: `translateY(${bob}px) scaleX(${facing}) rotate(${tilt}deg)`,
        transformOrigin: "50% 80%",
        overflow: "visible",
      }}
    >
      <ellipse cx="13" cy="42.2" rx="7" ry="1.3" fill="rgba(0,0,0,0.18)" />
      <g transform={`rotate(${armL} 8 18)`}>
        <rect x="6.2" y="16" width="3.2" height="11" rx="1.6" fill="#243044" />
      </g>
      <g transform={`rotate(${armR} 18 18)`}>
        <rect x="16.6" y="16" width="3.2" height="11" rx="1.6" fill="#243044" />
      </g>
      <rect x="8" y="16" width="10" height="9" rx="2.5" fill="#243044" />
      <path d="M8 18.5h10l-1.2 3.2H9.2z" fill="#e07a3d" />
      <rect x="7" y="23.5" width="12" height="9" rx="2" fill="#3c4ea3" />
      <rect x="12" y="23.5" width="2" height="9" fill="#f2c14e" />
      <g transform={`rotate(${legL} 10 28)`}>
        <rect x="8" y="30" width="3.6" height="9" rx="1.6" fill="#243044" />
        <rect
          x="7.2"
          y="37.2"
          width="5.4"
          height="3.2"
          rx="1.2"
          fill="#1c1a17"
        />
      </g>
      <g transform={`rotate(${legR} 16 28)`}>
        <rect x="14.4" y="30" width="3.6" height="9" rx="1.6" fill="#243044" />
        <rect
          x="13.6"
          y="37.2"
          width="5.4"
          height="3.2"
          rx="1.2"
          fill="#1c1a17"
        />
      </g>
      <circle cx="13" cy="10" r="6.1" fill="#f4d2b0" />
      <path
        d="M7.2 9.2c.4-4.6 3-6.6 5.8-6.6s5.4 2 5.8 6.6c-1.6-1.2-3.5-1.8-5.8-1.8s-4.2.6-5.8 1.8z"
        fill="#0f6e6a"
      />
      <circle cx="10.7" cy="10.4" r="0.8" fill="#1c1a17" />
      <circle cx="15.3" cy="10.4" r="0.8" fill="#1c1a17" />
    </svg>
  );
};
