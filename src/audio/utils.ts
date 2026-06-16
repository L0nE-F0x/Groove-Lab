/** Audio-domain helpers shared by the engine and the meters. */
import { clamp } from '../utils/helpers';

/** Floor (dB) the meters map to 0. Below this is treated as silence. */
export const METER_FLOOR_DB = -48;

/**
 * Convert a Tone.Meter reading (dB, can be -Infinity..~+6) into a 0..1 level
 * suitable for drawing a meter bar. Slightly eased so quiet signals still show.
 */
export const meterToLevel = (db: number): number => {
  if (!isFinite(db)) return 0;
  const norm = clamp((db - METER_FLOOR_DB) / -METER_FLOOR_DB, 0, 1);
  return norm ** 0.6; // perceptual-ish curve
};
