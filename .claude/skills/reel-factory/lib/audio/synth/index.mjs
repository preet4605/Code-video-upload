// Registry of tier-A synth kinds. Each entry: { fn(params, ctx) -> Float32Array | {L,R,pre_s?} | {x,pre_s}, dur_s, gain_db, layer, ... }
import { KINDS as modal } from './modal.mjs';
import { KINDS as friction } from './friction.mjs';
import { KINDS as plucked } from './plucked.mjs';
import { KINDS as noise } from './noise.mjs';
import { KINDS as cinematic } from './cinematic.mjs';
import { KINDS as music } from '../music.mjs';

export const SYNTH_KINDS = Object.freeze({ ...modal, ...friction, ...plucked, ...noise, ...cinematic, ...music });
export const LAYERS = ['sfx', 'music', 'ambience', 'room'];
export const AUTOMATION_KINDS = ['drop'];
export const kindNames = () => [...Object.keys(SYNTH_KINDS), ...AUTOMATION_KINDS];
