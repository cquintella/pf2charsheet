/** Reverse the column on the back of a portrait sheet printed on the long edge. */
export function mirroredCardPosition(index: number, columns: number): { row: number; column: number } {
  return { row: Math.floor(index / columns) + 1, column: columns - (index % columns) };
}
