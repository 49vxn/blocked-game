import { ARENAS, createArena, TOP } from '../src/games/bedwars/maps/arena'
import { blockDef, AIR } from '../src/games/bedwars/blocks'

const aquarium = ARENAS.find((a) => a.id === 'aquarium')!
const map = createArena(['red', 'blue', 'green', 'yellow'] as ('red' | 'blue' | 'green' | 'yellow')[], aquarium)

const info = (x: number, y: number, z: number) => {
  const id = map.world.get(x, y, z)
  return id === AIR ? '.' : blockDef(id).name.slice(0, 12)
}

for (const base of map.bases) console.log(base.team, 'center', base.center, 'bed', base.bed)
console.log('\nColumn x=55..66 at z=29 (y rows TOP-3..TOP+2):')
for (let y = TOP + 2; y >= TOP - 3; y--) {
  let row = `y=${y}  `
  for (let x = 55; x <= 66; x++) row += (info(x, y, 29) + ' ').padStart(13)
  console.log(row)
}
console.log('\nGrid z=24..34, x=55..67 at y=TOP (top, body rows):')
for (let z = 24; z <= 34; z++) {
  let row = `z=${z} top:`
  for (let x = 55; x <= 67; x++) row += (info(x, TOP, z) + ' ').padStart(13)
  let row2 = `      body:`
  for (let x = 55; x <= 67; x++) row2 += (info(x, TOP + 1, z) + ' ').padStart(13)
  console.log(row + '\n' + row2)
}
