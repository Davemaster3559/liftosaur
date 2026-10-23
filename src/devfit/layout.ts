export function DevFit_layout(
  width: number,
  textScale: number = 1
): { wide: boolean; gutter: number; maxWidth: number; gap: number } {
  const wide = width >= 700 && width / Math.max(1, textScale) >= 600;
  return { wide, gutter: wide ? 24 : 16, maxWidth: 1180, gap: wide ? 24 : 16 };
}
