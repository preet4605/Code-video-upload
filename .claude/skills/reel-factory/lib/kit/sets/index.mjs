// sets: registry. buildSet(name, opts) -> set (see core.mjs for the contract). VARIANTS lists two looks per set for the gallery.
import { schoolCourtyard } from './open.mjs';
import { villageAangan, street, roadNight, templeSteps } from './open2.mjs';
import { corridor, stairwell, room, haveliCorridor } from './interior.mjs';
export { makePalette, PALETTES, TODS } from './core.mjs';
export const SETS = { schoolCourtyard, villageAangan, haveliCorridor, templeSteps, corridor, stairwell, roadNight, street, room };
export const SET_NAMES = Object.keys(SETS);
export const VARIANTS = {
  schoolCourtyard: [{ tod: 'noon', palette: 'whitewash', seed: 1 }, { tod: 'night', palette: 'cream', seed: 4, arches: 4, props: ['well'] }],
  villageAangan: [{ tod: 'noon', seed: 1 }, { tod: 'dusk', seed: 3, palette: 'ochre' }],
  haveliCorridor: [{ variant: 'day', seed: 1 }, { variant: 'night', seed: 2 }],
  templeSteps: [{ variant: 'dusk', seed: 1 }, { variant: 'night', seed: 5, palette: 'whitewash' }],
  corridor: [{ variant: 'hostel', seed: 1 }, { variant: 'school', seed: 3 }],
  stairwell: [{ variant: 'flats', seed: 1 }, { variant: 'office', seed: 2 }],
  roadNight: [{ variant: 'highway', seed: 1 }, { variant: 'rain', seed: 2 }],
  street: [{ variant: 'wet', seed: 1 }, { variant: 'dry', seed: 2, palette: 'ochre' }],
  room: [{ variant: 'bedroom', seed: 1 }, { variant: 'girls', seed: 2, curtain: '#2f6b86' }],
};
export function buildSet(name, opts = {}) { const f = SETS[name]; if (!f) throw new Error(`unknown set "${name}" (have ${SET_NAMES.join(', ')})`); return f(opts); }
