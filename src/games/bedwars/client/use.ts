/**
 * The mouse and E key both queue a `use` for the next 20 Hz tick. A bow is the
 * only held-use item: if the button came back up before the tick consumed the
 * click, starting a draw would leave the view model charging with no release
 * coming. Everything else keeps its one-shot tap behaviour.
 */
export function startsBowDraw(heldKind: string | undefined, useHeld: boolean): boolean {
  return heldKind !== 'bow' || useHeld
}
