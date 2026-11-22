// Shared numbers for Gilded Midnight. One place for every tuning knob so the
// world, the renderer and the screenshot stager all agree on the same geometry.

export const TILE = 32;
export const COLS = 40;
export const ROWS = 15;
export const VIEW_W = COLS * TILE; // 1280
export const VIEW_H = ROWS * TILE; // 480
export const HUD_H = 40;

// Movement, in pixels per second.
export const WALK_SPEED = 150;
export const SNEAK_SPEED = 92;
export const GUARD_PATROL_SPEED = 72;
export const GUARD_CHASE_SPEED = 168;
export const PLAYER_RADIUS = 11;
export const GUARD_RADIUS = 12;

// Vision. A cone is a range, a half-angle and a line of sight.
export const GUARD_CONE_RANGE = 245;
export const GUARD_CONE_HALF = 0.56; // radians, about 32 degrees
export const CAMERA_CONE_RANGE = 235;
export const CAMERA_CONE_HALF = 0.52;
export const CATCH_RADIUS = 19;
export const BUMP_RADIUS = 30; // closer than this, a guard notices you outright

// Alarm. 0 is calm, 100 is busted.
export const ALARM_MAX = 100;
export const ALARM_DECAY = 6; // per second while unseen
export const CHASE_ALARM = 55; // above this, guards hunt you
export const HACK_ALARM_COST = 8;
export const HACK_SECONDS = 1.5;
export const CAMERA_OFF_SECONDS = 12;

// Tools.
export const COINS_PER_LEVEL = 3;
export const COIN_THROW_RANGE = 270;
export const COIN_LURE_RADIUS = 265;
export const COIN_FLIGHT_SECONDS = 0.35;

// Scoring.
export const MAIN_LOOT_VALUE = 5000;
export const BONUS_LOOT_VALUE = 500;
export const PAR_SECONDS = 300;

// Palette: a night gallery. Navy floors, brass trim, gold loot, red danger.
export const COLORS = {
  floorA: '#20293d',
  floorB: '#1c2436',
  carpet: '#5a1f28',
  carpetEdge: '#7d2c38',
  wall: '#121826',
  wallTop: '#2c3a55',
  wallTrim: '#8a6d2f',
  caseGlass: '#3d6f8e',
  caseBase: '#2a2118',
  gold: '#f2c14e',
  goldDim: '#a8842c',
  guardCone: 'rgba(242, 193, 78, 0.20)',
  guardConeEdge: 'rgba(242, 193, 78, 0.45)',
  cameraCone: 'rgba(232, 72, 72, 0.20)',
  cameraConeEdge: 'rgba(232, 72, 72, 0.5)',
  guardBody: '#5d739f',
  guardCap: '#31405f',
  thiefCloak: '#2e2113',
  thiefTrim: '#f2c14e',
  exitGreen: '#3ecf6e',
  hudBg: 'rgba(10, 13, 22, 0.92)',
  text: '#e8e2d0',
  textDim: '#9aa3b5',
  alarmLow: '#3ecf6e',
  alarmMid: '#f2c14e',
  alarmHigh: '#e84848',
};
