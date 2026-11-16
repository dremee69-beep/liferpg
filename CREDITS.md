# Credits

Every piece of art, font and sound in LifeRPG is listed here with its license.
Nothing from any commercial game is used.

## Art

| Asset | Files | Source | License |
| --- | --- | --- | --- |
| App icon (outlined village house) | `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, `public/favicon.png` | Original, drawn in code by `scripts/make-icons.mjs` | Made for this project |
| In-app outline icons (heart, book, coin, two hearts, globe, shield, house, page, tent) | `src/art/line-icons.ts` | Original, drawn as lines in that file | Made for this project |
| Map of India: state and country outlines | `src/map/india.ts`, made by `scripts/make-map.mjs` | [Natural Earth](https://www.naturalearthdata.com) (1:50m states; 1:10m countries, India point-of-view edition) | Public domain |
| Map of India: terrain picture and height grid | `public/map/india-relief.png` and `public/map/india-heights.png`, made by `scripts/make-map.mjs` | Elevation tiles (Terrarium format, zoom 6) from the [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) open data set. For this region the heights are SRTM and GMTED2010 data courtesy of the U.S. Geological Survey, and ETOPO1 from the U.S. National Oceanic and Atmospheric Administration | Free to use with this credit |
| Map of India: town names and positions | `src/map/towns.ts`, made by `scripts/make-map.mjs` | [GeoNames](https://www.geonames.org) "cities1000" list (places with at least 1,000 people), India only; two names changed to their modern spelling | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Pixel icons from the earlier look (no longer shown in the app) | `src/art/icons.ts` | Original, drawn as letter grids in that file | Made for this project |

## Fonts

| Asset | Files | Source | License |
| --- | --- | --- | --- |
| Nunito (variable, Latin letters) | bundled from the `@fontsource-variable/nunito` npm package | [The Nunito Project Authors](https://github.com/googlefonts/nunito), packaged by [Fontsource](https://fontsource.org) | SIL Open Font License 1.1 |

## Sound and music

None.

## Software

Built with [Vite](https://vite.dev), [React](https://react.dev),
[TypeScript](https://www.typescriptlang.org) and
[vite-plugin-pwa](https://vite-pwa-org.netlify.app), all free and open source
(MIT license).
