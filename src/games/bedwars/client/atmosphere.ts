import type { MapMeta } from '../maps/types'

/** A sky/fog/sun palette for one arena. Colours are hex strings so the data can travel as plain JSON. */
export interface Atmosphere {
  skyTop: string
  skyMiddle: string
  skyBottom: string
  sunColor: string
  sunDirection: [number, number, number]
  ambientColor: string
  sunlightIntensity: number
  minLightLevel: number
  /** Fractions of the player's render distance. */
  fogNearFactor: number
  fogFarFactor: number
  cloudColor: string
  cloudHeight: number
}

const DEFAULT: Atmosphere = {
  skyTop: '#4f8fe6',
  skyMiddle: '#bfe0ff',
  skyBottom: '#3e5a86',
  sunColor: '#fff6e0',
  sunDirection: [0.45, 1, 0.3],
  ambientColor: '#8c9ab0',
  sunlightIntensity: 0.85,
  minLightLevel: 0.18,
  fogNearFactor: 0.45,
  fogFarFactor: 1,
  cloudColor: '#ffffff',
  cloudHeight: 45,
}

const PRESETS: Record<string, Atmosphere> = {
  skyreach: DEFAULT,
  lanterns: {
    skyTop: '#2d2a5e',
    skyMiddle: '#e9a77c',
    skyBottom: '#3b233b',
    sunColor: '#ffb37a',
    sunDirection: [0.5, 0.32, 0.2],
    ambientColor: '#8b7690',
    sunlightIntensity: 0.72,
    minLightLevel: 0.22,
    fogNearFactor: 0.35,
    fogFarFactor: 0.82,
    cloudColor: '#f7c7a8',
    cloudHeight: 38,
  },
  dunes: {
    skyTop: '#5b9bd5',
    skyMiddle: '#f1d6a0',
    skyBottom: '#8a5a3a',
    sunColor: '#fff0c0',
    sunDirection: [0.2, 1, 0.1],
    ambientColor: '#c9a878',
    sunlightIntensity: 0.92,
    minLightLevel: 0.2,
    fogNearFactor: 0.5,
    fogFarFactor: 1.12,
    cloudColor: '#fff3dd',
    cloudHeight: 48,
  },
  frostpeak: {
    skyTop: '#5e8fc4',
    skyMiddle: '#dcecf8',
    skyBottom: '#8ba3b8',
    sunColor: '#eaf6ff',
    sunDirection: [0.35, 0.8, 0.45],
    ambientColor: '#a9c4d6',
    sunlightIntensity: 0.8,
    minLightLevel: 0.2,
    fogNearFactor: 0.35,
    fogFarFactor: 0.85,
    cloudColor: '#ffffff',
    cloudHeight: 40,
  },
  ruins: {
    skyTop: '#416f78',
    skyMiddle: '#c8d7b8',
    skyBottom: '#36463a',
    sunColor: '#e8f0c0',
    sunDirection: [0.4, 0.8, 0.2],
    ambientColor: '#8fa48a',
    sunlightIntensity: 0.78,
    minLightLevel: 0.2,
    fogNearFactor: 0.4,
    fogFarFactor: 0.9,
    cloudColor: '#dde8d0',
    cloudHeight: 42,
  },
}

/** The palette for a map; an unknown map uses its sky colour with the default sunset of light. */
export function atmosphereFor(map: Pick<MapMeta, 'name' | 'sky'>): Atmosphere {
  const preset = PRESETS[map.name.toLowerCase()]
  if (preset) return preset
  return { ...DEFAULT, skyMiddle: map.sky || DEFAULT.skyMiddle }
}
