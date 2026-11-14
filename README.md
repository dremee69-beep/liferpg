# LifeRPG

A cozy life game for two players. You level up five realms (Health, Mind,
Wealth, Together and Quest Abroad) by logging real-life actions with one tap.

It is a small web app you add to your phone's home screen. It works offline,
needs no login, and keeps all progress on your own device.

## Run it on your computer

You need [Node.js](https://nodejs.org) (LTS).

```bash
npm install
npm run dev
```

Then open the address it prints (it ends in `/liferpg/`).

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the app on your computer while you work on it |
| `npm test` | Runs the automatic checks for the game maths and saving |
| `npm run build` | Builds the finished app into the `dist` folder |
| `npm run preview` | Shows the finished build, exactly as it will be published |
| `npm run icons` | Redraws the app icons from `scripts/make-icons.mjs` |

## Where things are

| Path | What is in it |
| --- | --- |
| `src/game/rules.ts` | Every game number in one place (XP values, level curve, realms) |
| `src/game/xp.ts` | Level and XP maths |
| `src/game/actions.ts` | What logging and undoing an action does to a save |
| `src/storage/save.ts` | Saving, loading, export and import (versioned save format) |
| `src/components/` | The screens: player picker, Village, realm card, Camp |
| `tests/` | Automatic checks |

## Your data

Progress is stored only in your phone's browser storage. Nothing is sent
anywhere. Use Camp → "Share save file" or "Download save file" to keep a backup.

## Credits

See [CREDITS.md](CREDITS.md).
