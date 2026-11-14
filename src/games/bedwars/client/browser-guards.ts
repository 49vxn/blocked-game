/**
 * Browser behaviour that fights a first-person game.
 *
 * A page can always suppress its own right-click menu, and it can cancel the
 * browser shortcuts the browser allows it to cancel. It cannot take Ctrl+W,
 * Ctrl+T or Ctrl+1..9 away from the tab strip; that needs JavaScript full
 * screen plus the Keyboard Lock API, which `Game` requests while playing.
 * These guards cover every screen, including the main menu and the pause card,
 * where the game's own input binder is not running yet.
 */

const TEXT_FIELD = 'input, textarea, select, [contenteditable="true"]'

/** Ctrl/Cmd shortcuts a page may cancel and a game never wants. */
const BLOCKED_SHORTCUTS = new Set(['KeyD', 'KeyF', 'KeyJ', 'KeyO', 'KeyP', 'KeyS', 'KeyU', 'F1', 'F3'])

function isTextField(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(TEXT_FIELD)
}

export function installBrowserGuards(): void {
  // Right click is the game's "use". Every screen gets the game's own menu
  // instead of the browser's; text fields keep paste and spellcheck.
  document.addEventListener(
    'contextmenu',
    (event) => {
      if (!isTextField(event.target)) event.preventDefault()
    },
    true,
  )
  // Middle click starts autoscroll, which freezes the game until it is dismissed.
  document.addEventListener(
    'mousedown',
    (event) => {
      if (event.button === 1 && !isTextField(event.target)) event.preventDefault()
    },
    true,
  )
  // Ctrl+S, Ctrl+P, Ctrl+F and friends open browser panels over the game.
  // Ctrl+W, Ctrl+T and Ctrl+1..9 are not cancelable here: only full screen can
  // hand those to the page (see Game.syncKeyboardLock).
  window.addEventListener(
    'keydown',
    (event) => {
      if (!(event.ctrlKey || event.metaKey) || isTextField(event.target)) return
      if (BLOCKED_SHORTCUTS.has(event.code)) event.preventDefault()
    },
    true,
  )
}
