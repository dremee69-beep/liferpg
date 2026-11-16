// OUTLINE ICONS
// Every icon is original art, drawn right here as a few lines on a 24 x 24
// grid. Each line is an SVG "path": a list of pen moves (M = move to,
// L/H/V = straight lines, C/S/A = curves, Z = close the shape).
//
// `fill: true` means the shape is coloured in (with the realm's colour, or
// white); without it the path is only an outline, used for details drawn on
// top of a shape.

export type IconPath = { d: string; fill?: true }

export const LINE_ICONS = {
  // ----- Realms -----

  // Health: a heart
  health: [
    {
      d: 'M12 21s-8.5-5.3-8.5-11.2A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 8.5 2.8C20.5 15.7 12 21 12 21z',
      fill: true,
    },
  ],

  // Mind: an open book
  mind: [
    {
      d: 'M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z',
      fill: true,
    },
    { d: 'M12 6.5v13' },
  ],

  // Wealth: a coin
  wealth: [
    { d: 'M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0z', fill: true },
    { d: 'M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0z' },
  ],

  // Together: two hearts side by side
  together: [
    {
      d: 'M9 14s-6-3.7-6-7.9a3.4 3.4 0 0 1 6-1.5 3.4 3.4 0 0 1 6 1.5c0 4.2-6 7.9-6 7.9z',
      fill: true,
    },
    {
      d: 'M15 20.5s-6-3.7-6-7.9a3.4 3.4 0 0 1 6-1.5 3.4 3.4 0 0 1 6 1.5c0 4.2-6 7.9-6 7.9z',
      fill: true,
    },
  ],

  // Quest Abroad: a globe
  questAbroad: [
    { d: 'M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0z', fill: true },
    { d: 'M8.5 12a3.5 8.5 0 1 0 7 0a3.5 8.5 0 1 0-7 0z' },
    { d: 'M3.5 12h17' },
  ],

  // ----- Other -----

  // A shield: covers a missed challenge week
  shield: [
    {
      d: 'M12 3l7.5 2.5v6c0 4.5-3 7.8-7.5 9.5-4.5-1.7-7.5-5-7.5-9.5v-6z',
      fill: true,
    },
  ],

  // ----- Tabs -----

  // Village: a little house
  village: [
    { d: 'M4 11l8-7 8 7v9.5H4z', fill: true },
    { d: 'M10 20.5v-5.5h4v5.5' },
  ],

  // Quests: a page with a list
  quests: [
    {
      d: 'M7 3.5h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z',
      fill: true,
    },
    { d: 'M9 9h6M9 13h6M9 17h3' },
  ],

  // Map: a folded map
  map: [
    { d: 'M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z', fill: true },
    { d: 'M9 4v13.5M15 6.5V20' },
  ],

  // Camp: a tent
  camp: [
    { d: 'M12 4L3 20h18z', fill: true },
    { d: 'M12 12v8' },
  ],
} as const satisfies Record<string, readonly IconPath[]>

// An IconName is one of: 'health' | 'mind' | ... | 'camp'
export type IconName = keyof typeof LINE_ICONS
