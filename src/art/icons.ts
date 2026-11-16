// PIXEL ICONS
// Every icon is original art, drawn right here as a 12 x 12 grid of letters.
// Each letter is one colour from ICON_COLOURS; a dot is see-through.
// To change an icon, change its letters. Keep every row 12 letters long.

export const ICON_SIZE = 12

export const ICON_COLOURS: Record<string, string> = {
  K: '#3a2e22', // outline (dark brown)
  W: '#fffaf0', // cream white
  R: '#b5473c', // red
  r: '#e08a7d', // light red
  B: '#3f6ea8', // blue
  b: '#8fb0d6', // light blue
  Y: '#d9ae2b', // gold
  y: '#f4dc7c', // light gold
  O: '#8a6a12', // dark gold
  P: '#a8457d', // pink
  p: '#dc8cb7', // light pink
  G: '#2f7d5b', // green
  g: '#74bd98', // light green
  N: '#6b4423', // brown
  T: '#f1dfb3', // parchment
  t: '#cdb98c', // parchment shadow
}

export const ICONS = {
  // ----- Realms -----

  // Health: a heart
  health: [
    '............',
    '..KKK..KKK..',
    '.KrRRKKRRRK.',
    '.KrRRRRRRRK.',
    '.KRRRRRRRRK.',
    '.KRRRRRRRRK.',
    '..KRRRRRRK..',
    '...KRRRRK...',
    '....KRRK....',
    '.....KK.....',
    '............',
    '............',
  ],

  // Mind: an open book
  mind: [
    '............',
    '............',
    '.KKKK..KKKK.',
    'KWWWWKKWWWWK',
    'KWbbWKKWbbWK',
    'KWWWWKKWWWWK',
    'KWbbWKKWbbWK',
    'KWWWWKKWWWWK',
    'KBBBBKKBBBBK',
    '.KKKKKKKKKK.',
    '............',
    '............',
  ],

  // Wealth: a coin
  wealth: [
    '............',
    '....KKKK....',
    '..KKyyyyKK..',
    '.KyyYYYYYOK.',
    '.KyYYOOYYOK.',
    'KyYYOYYYYYOK',
    'KyYYOYYYYYOK',
    '.KyYYOOYYOK.',
    '.KYYYYYYYOK.',
    '..KKOOOOKK..',
    '....KKKK....',
    '............',
  ],

  // Together: two hearts side by side
  together: [
    '............',
    '.KK.KK......',
    'KWPKPPK.....',
    'KPPPPPK.....',
    '.KPPPKKK.KK.',
    '..KPKKppKppK',
    '...K.KpppppK',
    '......KpppK.',
    '.......KpK..',
    '........K...',
    '............',
    '............',
  ],

  // Quest Abroad: a globe
  questAbroad: [
    '............',
    '....KKKK....',
    '..KKbBBBKK..',
    '.KbggBBBBBK.',
    '.KggggBBgBK.',
    'KBgggBBgggBK',
    'KBBggBBgggBK',
    '.KBBgBBBggK.',
    '.KBBBBBBgBK.',
    '..KKBBBBKK..',
    '....KKKK....',
    '............',
  ],

  // ----- Other -----

  // A shield: covers a missed challenge week
  shield: [
    '............',
    '.KKKKKKKKKK.',
    '.KbbbbBBBBK.',
    '.KbWbbBBBBK.',
    '.KbbbbBBBBK.',
    '.KbbbbBBBBK.',
    '.KbbbbBBBBK.',
    '..KbbbBBBK..',
    '..KbbbBBBK..',
    '...KbbBBK...',
    '....KbBK....',
    '.....KK.....',
  ],

  // ----- Tabs -----

  // Village: the little house from the app icon
  village: [
    '............',
    '.....KK.....',
    '....KRRK....',
    '...KRRRRK...',
    '..KRRRRRRK..',
    '.KRRRRRRRRK.',
    'KKKKKKKKKKKK',
    '.KWWWWWWWWK.',
    '.KWBBWWNNWK.',
    '.KWBBWWNNWK.',
    '.KWWWWWNNWK.',
    '.KKKKKKKKKK.',
  ],

  // Quests: a scroll
  quests: [
    '............',
    '..KKKKKKKKK.',
    '.KTTTTTTTTTK',
    '.KtttttttttK',
    '..KTTTTTTTK.',
    '..KTNNNNTTK.',
    '..KTTTTTTTK.',
    '..KTNNNNNTK.',
    '..KTTTTTTTK.',
    '.KTTTTTTTTTK',
    '.KtttttttttK',
    '..KKKKKKKKK.',
  ],

  // Camp: a tent
  camp: [
    '............',
    '............',
    '.....KK.....',
    '....KggK....',
    '...KgGGGK...',
    '...KGGGGK...',
    '..KGGKKGGK..',
    '..KGGKKGGK..',
    '.KGGKNNKGGK.',
    '.KGGKNNKGGK.',
    'KKKKKKKKKKKK',
    '............',
  ],
} as const

// An IconName is one of: 'health' | 'mind' | ... | 'camp'
export type IconName = keyof typeof ICONS
