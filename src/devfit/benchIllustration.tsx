import { JSX } from "react";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { Tailwind_semantic } from "../utils/tailwindConfig";

export function DevFitBenchIllustration(props: { kind: "sit_up" | "back_extension" }): JSX.Element {
  const c = Tailwind_semantic().devfit;
  const sitUp = props.kind === "sit_up";
  return (
    <Svg
      width="100%"
      height={160}
      viewBox="0 0 280 160"
      accessibilityRole="image"
      accessibilityLabel={
        sitUp
          ? "Sit-up bench: face upward, curling the torso toward the knees"
          : "Back-extension bench: face downward, hips supported, hinging the torso"
      }
    >
      <Line x1={20} y1={148} x2={260} y2={148} stroke={c.line} strokeWidth={3} />
      {sitUp ? (
        <>
          <Path d="M55 110 L225 140 M90 116 L75 148 M205 137 L220 148" stroke={c.muted} strokeWidth={7} fill="none" />
          <Path
            d="M75 91 L125 106 L166 84 L206 121"
            stroke={c.accent}
            strokeWidth={9}
            fill="none"
            strokeLinecap="round"
          />
          <Circle cx={60} cy={82} r={12} fill={c.accent} />
          <Path d="M103 53 L125 106" stroke={c.success} strokeWidth={7} fill="none" strokeLinecap="round" />
          <Circle cx={99} cy={37} r={11} fill={c.success} />
          <Path d="M45 51 Q49 24 72 23 M66 17 L74 23 L67 31" stroke={c.success} strokeWidth={3} fill="none" />
        </>
      ) : (
        <>
          <Path d="M122 108 L185 148 M122 108 L96 148 M165 140 L212 140" stroke={c.muted} strokeWidth={7} fill="none" />
          <Rect x={111} y={94} width={27} height={18} rx={4} fill={c.muted} />
          <Path
            d="M69 80 L120 99 L171 138 L201 138"
            stroke={c.accent}
            strokeWidth={9}
            fill="none"
            strokeLinecap="round"
          />
          <Circle cx={52} cy={75} r={12} fill={c.accent} />
          <Path d="M88 131 L120 99" stroke={c.success} strokeWidth={7} fill="none" strokeLinecap="round" />
          <Circle cx={76} cy={142} r={11} fill={c.success} />
          <Path d="M47 120 Q32 106 41 92 M34 98 L41 89 L48 98" stroke={c.success} strokeWidth={3} fill="none" />
        </>
      )}
    </Svg>
  );
}
