// THE MAP'S DECORATIONS: trees, mountains, landmarks and moving bits that
// make the map look like a game world. They are only for looks: they never
// catch a tap, and they don't change anything in the game.
//
// Each one is placed by its real longitude and latitude (east, north), so it
// sits in the right spot at every zoom. The picture for each kind is drawn in
// src/components/MapDecorations.tsx.
//
// For landmarks, `state` names the state or union territory the place is in.
// A test (tests/decorations.test.ts) checks every landmark really lands
// inside that state, every nature item lands in India, and every sea item
// lands in the sea.

export type NatureKind = 'tree' | 'pine' | 'palm' | 'peaks' | 'dunes'
export type LandmarkKind =
  | 'taj-mahal'
  | 'india-gate'
  | 'gateway-of-india'
  | 'charminar'
  | 'hawa-mahal'
  | 'golden-temple'
  | 'meenakshi-temple'
  | 'victoria-memorial'
export type MovingKind = 'cloud' | 'wave' | 'boat' | 'birds'

export type Decoration = { lon: number; lat: number } & (
  | { kind: NatureKind }
  | { kind: LandmarkKind; name: string; state: string }
  | { kind: MovingKind }
)

export const NATURE: readonly (Decoration & { kind: NatureKind })[] = [
  // Snowy peaks of the Himalaya.
  { kind: 'peaks', lon: 77.6, lat: 34.3 }, // Ladakh
  { kind: 'peaks', lon: 77.4, lat: 32.4 }, // Himachal Pradesh
  { kind: 'peaks', lon: 79.7, lat: 30.7 }, // Uttarakhand
  { kind: 'peaks', lon: 88.5, lat: 27.8 }, // Sikkim
  { kind: 'peaks', lon: 93.6, lat: 28.2 }, // Arunachal Pradesh
  // Pine forests on the lower slopes.
  { kind: 'pine', lon: 74.9, lat: 33.7 }, // Kashmir
  { kind: 'pine', lon: 76.9, lat: 31.3 }, // Himachal Pradesh
  { kind: 'pine', lon: 78.7, lat: 30.0 }, // Uttarakhand
  { kind: 'pine', lon: 92.3, lat: 27.3 }, // Arunachal Pradesh
  // Leafy forests: the Western Ghats, central India and the Northeast.
  { kind: 'tree', lon: 73.8, lat: 17.7 }, // Western Ghats, Maharashtra
  { kind: 'tree', lon: 75.7, lat: 12.5 }, // Western Ghats, Karnataka
  { kind: 'tree', lon: 80.6, lat: 22.3 }, // Madhya Pradesh forests
  { kind: 'tree', lon: 81.9, lat: 19.3 }, // Chhattisgarh forests
  { kind: 'tree', lon: 85.3, lat: 22.4 }, // Jharkhand forests
  { kind: 'tree', lon: 91.6, lat: 25.5 }, // Meghalaya
  { kind: 'tree', lon: 93.2, lat: 26.6 }, // Assam
  { kind: 'tree', lon: 93.9, lat: 24.4 }, // Manipur
  // Palms on the coasts and islands.
  { kind: 'palm', lon: 76.45, lat: 9.6 }, // Kerala
  { kind: 'palm', lon: 74.0, lat: 15.3 }, // Goa
  { kind: 'palm', lon: 73.4, lat: 17.0 }, // Konkan coast
  { kind: 'palm', lon: 79.6, lat: 11.8 }, // Tamil Nadu coast
  { kind: 'palm', lon: 92.7, lat: 11.6 }, // Andaman Islands
  { kind: 'palm', lon: 85.7, lat: 20.0 }, // Odisha coast
  // The Thar desert and the Rann of Kutch.
  { kind: 'dunes', lon: 70.9, lat: 26.9 }, // Jaisalmer
  { kind: 'dunes', lon: 72.5, lat: 28.2 }, // Bikaner
  { kind: 'dunes', lon: 71.5, lat: 25.6 }, // Barmer
  { kind: 'dunes', lon: 70.3, lat: 23.9 }, // Kutch
]

export const LANDMARKS: readonly (Decoration & { kind: LandmarkKind })[] = [
  { kind: 'golden-temple', name: 'Golden Temple', state: 'Punjab', lon: 74.88, lat: 31.62 },
  { kind: 'india-gate', name: 'India Gate', state: 'Delhi', lon: 77.23, lat: 28.61 },
  { kind: 'taj-mahal', name: 'Taj Mahal', state: 'Uttar Pradesh', lon: 78.04, lat: 27.17 },
  { kind: 'hawa-mahal', name: 'Hawa Mahal', state: 'Rajasthan', lon: 75.83, lat: 26.92 },
  {
    kind: 'victoria-memorial',
    name: 'Victoria Memorial',
    state: 'West Bengal',
    lon: 88.34,
    lat: 22.54,
  },
  {
    kind: 'gateway-of-india',
    name: 'Gateway of India',
    state: 'Maharashtra',
    lon: 72.85,
    lat: 19.2, // moved a little north: Mumbai's tip is too thin on the map
  },
  { kind: 'charminar', name: 'Charminar', state: 'Telangana', lon: 78.47, lat: 17.36 },
  {
    kind: 'meenakshi-temple',
    name: 'Meenakshi Temple',
    state: 'Tamil Nadu',
    lon: 78.12,
    lat: 9.92,
  },
]

// Things that move. Clouds, waves and boats are out at sea; birds fly over
// the plains of the north.
export const MOVING: readonly (Decoration & { kind: MovingKind })[] = [
  { kind: 'cloud', lon: 68.6, lat: 15.5 },
  { kind: 'cloud', lon: 70.5, lat: 9.0 },
  { kind: 'cloud', lon: 86.5, lat: 16.5 },
  { kind: 'cloud', lon: 90.5, lat: 12.0 },
  { kind: 'wave', lon: 69.0, lat: 19.5 },
  { kind: 'wave', lon: 72.0, lat: 12.5 },
  { kind: 'wave', lon: 84.5, lat: 13.0 },
  { kind: 'wave', lon: 88.5, lat: 18.5 },
  { kind: 'wave', lon: 76.5, lat: 7.0 },
  { kind: 'boat', lon: 70.6, lat: 16.0 },
  { kind: 'boat', lon: 87.0, lat: 14.0 },
  { kind: 'birds', lon: 81.0, lat: 26.6 },
  { kind: 'birds', lon: 84.5, lat: 25.7 },
]
