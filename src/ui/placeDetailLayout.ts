/** Native sheet onLayout and window geometry share this viewport contract. */
export function placeDetailLayout(height: number, top: number, bottom: number, measuredHeight: number) {
  const mapHeight = Math.max(0, height - top);
  const closeSpace = 66;
  const visibleMapMin = Math.min(160, mapHeight * 0.28);
  const maxHeight = Math.max(0, mapHeight - closeSpace - visibleMapMin - 16);
  const sheetHeight = measuredHeight > 0 ? Math.min(measuredHeight, maxHeight) : maxHeight;
  return { maxHeight, paddingBottom: 18 + Math.max(bottom, 8), boundsPadding: { top: closeSpace, right: 34, bottom: sheetHeight + 16, left: 34 } };
}
