import { describe, expect, test } from 'bun:test'
import { actionFor, bind, DEFAULT_SETTINGS, keyLabel, parseSettings, pixelRatio } from '../src/games/bedwars/client/settings'

describe('settings', () => {
  test('saved values are validated and missing ones fall back to defaults', () => {
    const s = parseSettings({ sensitivity: 99, fov: 'wide', sprintMode: 'toggle', volume: 0.2, keys: { jump: ['KeyJ'], sneak: 'nope' } })
    expect(s.sensitivity).toBe(4)
    expect(s.fov).toBe(DEFAULT_SETTINGS.fov)
    expect(s.sprintMode).toBe('toggle')
    expect(s.volume).toBe(0.2)
    expect(s.keys.jump).toEqual(['KeyJ'])
    expect(s.keys.sneak).toEqual(DEFAULT_SETTINGS.keys.sneak)
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
  })

  test('settings saved with the old default sensitivity get the new, faster one', () => {
    expect(DEFAULT_SETTINGS.sensitivity).toBeGreaterThan(1)
    expect(parseSettings({ sensitivity: 1 }).sensitivity).toBe(DEFAULT_SETTINGS.sensitivity)
    // A deliberate choice of 1, saved since, is kept.
    expect(parseSettings({ sensitivity: 1, version: 2 }).sensitivity).toBe(1)
    expect(parseSettings({ sensitivity: 0.7 }).sensitivity).toBe(0.7)
  })

  test('Q drops the held item', () => {
    expect(actionFor(DEFAULT_SETTINGS, 'KeyQ')).toBe('drop')
  })

  test('E uses, Tab opens inventory and G holds the leaderboard', () => {
    expect(actionFor(DEFAULT_SETTINGS, 'KeyE')).toBe('use')
    expect(DEFAULT_SETTINGS.keys.inventory).toEqual(['Tab'])
    expect(actionFor(DEFAULT_SETTINGS, 'Tab')).toBe('inventory')
    expect(DEFAULT_SETTINGS.keys.players).toEqual(['KeyG'])
    expect(actionFor(DEFAULT_SETTINGS, 'KeyG')).toBe('players')
  })

  test('old E inventory and Tab leaderboard bindings migrate', () => {
    const s = parseSettings({ version: 2, keys: { inventory: ['KeyE'], players: ['Tab'] } })
    expect(s.keys.inventory).toEqual(['Tab'])
    expect(s.keys.players).toEqual(['KeyG'])
    expect(s.keys.use).toEqual(['KeyE'])
    // A deliberate non-default binding is not overwritten.
    const custom = parseSettings({ version: 2, keys: { inventory: ['KeyI'], players: ['KeyP'] } })
    expect(custom.keys.inventory).toEqual(['KeyI'])
    expect(custom.keys.players).toEqual(['KeyP'])
  })

  test('bridging assist is auto by default and accepts on/off', () => {
    expect(DEFAULT_SETTINGS.bridgeAssist).toBe('auto')
    expect(parseSettings({ bridgeAssist: 'on' }).bridgeAssist).toBe('on')
    expect(parseSettings({ bridgeAssist: 'off' }).bridgeAssist).toBe('off')
    expect(parseSettings({ bridgeAssist: 'sometimes' }).bridgeAssist).toBe('auto')
  })

  test('bridge style defaults to Bedrock and migrates old saves', () => {
    expect(DEFAULT_SETTINGS.bridgeStyle).toBe('bedrock')
    expect(parseSettings({ version: 3, bridgeAssist: 'on' }).bridgeStyle).toBe('bedrock')
    expect(parseSettings({ bridgeStyle: 'forward' }).bridgeStyle).toBe('forward')
    expect(parseSettings({ bridgeStyle: 'sideways' }).bridgeStyle).toBe('bedrock')
  })

  test('sprint defaults to the browser-safe key, never Ctrl+W', () => {
    expect(DEFAULT_SETTINGS.keys.sprint).toEqual(['KeyR'])
    expect(actionFor(DEFAULT_SETTINGS, 'ControlLeft')).toBeUndefined()
    expect(actionFor(DEFAULT_SETTINGS, 'KeyR')).toBe('sprint')
  })

  test('an older Ctrl sprint binding is moved to R on the web', () => {
    expect(parseSettings({ version: 2, keys: { sprint: ['ControlLeft', 'KeyR'] } }).keys.sprint).toEqual(['KeyR'])
    expect(parseSettings({ version: 2, keys: { sprint: ['ControlLeft'] } }).keys.sprint).toEqual(['KeyR'])
    // A deliberate second key is kept, not discarded with Ctrl.
    expect(parseSettings({ version: 2, keys: { sprint: ['ControlLeft', 'KeyX'] } }).keys.sprint).toEqual(['KeyR', 'KeyX'])
  })

  test('sandbox movement defaults to Classic, validates saved values and cycles with M', () => {
    expect(DEFAULT_SETTINGS.sandboxMovement).toBe('classic')
    expect(parseSettings({ sandboxMovement: 'snapline' }).sandboxMovement).toBe('snapline')
    expect(parseSettings({ sandboxMovement: 'flowline' }).sandboxMovement).toBe('flowline')
    expect(parseSettings({ sandboxMovement: 'icy' }).sandboxMovement).toBe('classic')
    expect(actionFor(DEFAULT_SETTINGS, 'KeyM')).toBe('movement')
  })

  test('starting play in full screen is saved and validated', () => {
    expect(parseSettings({ autoFullscreen: true }).autoFullscreen).toBe(true)
    expect(parseSettings({ autoFullscreen: false }).autoFullscreen).toBe(false)
    expect(parseSettings({ autoFullscreen: 'yes' }).autoFullscreen).toBe(DEFAULT_SETTINGS.autoFullscreen)
  })

  test('binding a key moves it off any other action', () => {
    const s = bind(DEFAULT_SETTINGS, 'jump', 'KeyE')
    expect(actionFor(s, 'KeyE')).toBe('jump')
    expect(s.keys.use).toEqual([])
    expect(s.keys.inventory).toEqual(['Tab'])
    expect(s.keys.jump[0]).toBe('KeyE')
  })

  test('labels and quality', () => {
    expect(keyLabel('KeyW')).toBe('W')
    expect(keyLabel('ShiftLeft')).toBe('Left Shift')
    expect(keyLabel('Digit3')).toBe('3')
    expect(pixelRatio('low', 2)).toBe(0.75)
    expect(pixelRatio('high', 3)).toBe(2)
  })
})
