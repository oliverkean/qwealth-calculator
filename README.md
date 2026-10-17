# qwealth-calculator

Next.js App Router starter for the Qwealth calculator. The calculator's inputs, formulas, and validation rules are not implemented yet.

## Requirements

- Node.js 22.12 or newer in the Node 22 line
- npm

## Run locally

```powershell
npm install
npm run dev
```

Open http://localhost:3000. The page currently shows the generated Next.js starter screen.

## Quality checks

```powershell
npm run lint
npm run typecheck
npm run test:run
npm run build
```

`npm run check` runs all four checks in sequence. `npm test` starts Vitest in watch mode. The current test checks that the starter page renders; replace it with calculator behavior tests as the product is built.

## Stack

- Next.js App Router, React, and TypeScript
- Tailwind CSS 4 through the generated Turbopack configuration
- Recharts for charts in future client components
- Vitest, jsdom, and React Testing Library for unit and component tests

The `@/*` import alias points to `src/`. Tailwind is already imported in `src/app/globals.css`; no separate PostCSS configuration is needed for this generated setup.

## Deploy to Vercel

After pushing this repository to GitHub, import `oliverkean/qwealth-calculator` into Vercel. Select the repository root as the project directory and leave the detected Next.js build settings in place. There are currently no required environment variables. Run `npm run check` before pushing a deployable change.
