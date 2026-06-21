# LATTICE

A browser-based daily puzzle game. Route mirrors to guide a laser through numbered tiles in order, then reach the flag.

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS 4
- Framer Motion

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play.

## How to Play

1. Place mirrors on empty cells by dragging from the toolbox
2. Click placed mirrors to cycle: `/` → `\` → remove
3. Route the laser through numbered tiles in the target code order
4. Reach the flag to complete the puzzle

## Project Structure

```
src/
  app/           # Next.js pages
  components/    # UI components
  data/          # Puzzle definitions
  hooks/         # React hooks
  lib/           # Game logic (laser engine, validation)
```

## Adding Puzzles

Add puzzle definitions to `src/data/puzzles.ts`:

```typescript
{
  id: 2,
  code: "3142",
  gridSize: 8,
  source: { x: 0, y: 4, direction: "right" },
  flag: { x: 7, y: 4 },
  numbers: [...],
  obstacles: [...]
}
```
