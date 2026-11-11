# Meridian Broker Platform — Project Plan

**Stack:** React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui + TanStack Router v1 + TanStack Query v5 + IndexedDB (`idb`) + Web Worker + `@tanstack/react-virtual` + Zustand (theme only)

**Deployment:** Vercel or GitHub Pages (static, zero backend)

---

## Design System Decision

**kept: shadcn/ui + Tailwind CSS**

Rationale:
- Components are copied into `src/components/ui/*` — you ship only what you use; no runtime library tax.
- Dark mode by default via Tailwind `dark:` variants + CSS variables, ideal for a trading terminal.
- Full control over density, padding, and row heights — critical for order books, positions tables, and virtualized grids.
- Built on Radix UI primitives with React 19 support and built-in accessibility.
- Owning the component source lets you demonstrate memory-safe patterns (row recycling, detached-node guards) without fighting a theme provider.

Alternatives considered and rejected: MUI (heavy bundle, theme provider fights), Ant Design (large bundle, slower React 19 adoption), Chakra UI (runtime style overhead), Radix headless alone (more build work, no added benefit over shadcn).

---

## 1. Vision

A frontend-only, high-frequency stock broker terminal demonstrating senior-level engineering:
- Custom virtualization for 100,000+ item lists with fixed, minimal DOM node count
- Off-main-thread market data via Web Worker (zero server setup)
- Offline-first optimistic trade execution with IndexedDB persistence
- Zero memory degradation over long-lived sessions
- Clean feature boundaries prepared for future microfrontend extraction

---

## 2. Pages & Features

| Page | Purpose | Key Functionality |
|------|---------|-------------------|
| **Home** | Market dashboard | Popular stocks virtualized grid, market movers, debounced global search, market status banner |
| **Portfolio** | Account overview | Wallet/buying power/total equity, virtualized positions table with unrealized P&L, position drill-down |
| **Watchlist** | User-curated symbols | Add/remove/reorder symbols, per-symbol price alerts, optimistic UI, IndexedDB persistence |
| **Profile** | User identity | Name, email, KYC status, wallet balance, settings, theme toggle, logout |
| **Trading** (cross-page modal) | Order execution | Buy/Sell ticket (market/limit), optimistic placement, virtualized L2 order book, virtualized time & sales tape, order history |

---

## 3. Architecture — Layered State

```
LAYER 4: UI Shell State (React useState/useReducer)
  → sidebar, active route, modals, form values

LAYER 3: Optimistic Transactions (React 19 useOptimistic + TanStack Query)
  → order placement, watchlist add/remove, limit order edits

LAYER 2: Cache / Persistence (TanStack Query v5 + IndexedDB)
  → positions, open orders, account balance, watchlist symbols, user profile

LAYER 1: Hot Market Stream (Web Worker → Ring Buffer → useSyncExternalStore)
  → L1 ticks, L2 order book, time & sales tape (60k+ msgs/min)
  → React never sees per-tick setState

LAYER 0: Virtualization (@tanstack/react-virtual)
  → geometry for watchlist, positions, order book, tape
  → YOU recycle DOM nodes; library computes offsets
```

**Thread ownership:**
- **Main thread:** React rendering, virtualization, DOM, user input, async IndexedDB
- **Worker:** Synthetic market data generation, exchange fill simulation, batch assembly
- **IndexedDB:** Persisted cache, mutation queue, sync metadata (all async)

---

## 4. State Management Rules

**No Zustand for global/trading state.**
- TanStack Query owns cached/persisted data
- React 19 `useOptimistic` owns transactional UI state
- `useSyncExternalStore` owns high-frequency external streams
- React `useState`/`useReducer` + URL params own shell UI state

**Zustand is used for exactly one thing: Theme.**
- Persisted to `localStorage` via `zustand/middleware` `persist`
- Read by Header, Layout, and shadcn components via hook (no `useContext`, no provider wrapper)
- Store lives outside React; applies `<html>` class before hydration to prevent flash

---

## 5. Virtualization Strategy

`@tanstack/react-virtual` provides headless geometry (offsets, indices, overscan). You own DOM node recycling and object pooling.

| Component | Item Count | DOM Budget | Type |
|-----------|------------|------------|------|
| Popular Stocks Grid | 500 | ≤30 nodes | Row |
| Positions Table | 100 holdings | ≤20 nodes | Row |
| Watchlist | 1,000+ symbols | ≤30 nodes | Row |
| Order Book L2 | ~200 levels/side | ≤40 nodes | Row (bid + ask) |
| Time & Sales Tape | 10,000+ trades | ≤40 nodes | Row |

**CI gate:** DOM node count never exceeds 64 during scroll soak.

---

## 6. Memory Management Protocol

- **Object pooling:** Reusable wrappers for `TradeTick`, `OrderBookLevel`, `PositionRow`
- **Listener registry:** Central `Disposable` pool for all `addEventListener`, `postMessage`, `ResizeObserver`, `BroadcastChannel`; auto-cleanup on unmount/logout
- **Detached DOM guard (dev):** `FinalizationRegistry` + `WeakRef` assertions that virtualized nodes are recycled, never orphaned
- **Worker lifecycle:** `worker.terminate()` on logout/tab close
- **GC profiling:** `window.gc()` in CI (`--expose-gc`), heap snapshot diffs, `performance.measureUserAgentSpecificMemory()`
- **Target:** JS heap flat (≤10% growth) after 15 min at 100k ticks/min

---

## 7. Offline-First Brokerage

**IndexedDB schema (`idb`):**
- `ticks` (key: `seq`) — cached market history, TTL-capped
- `positions` (key: `symbol`) — user holdings
- `orders` (key: `id`) — order history and status
- `watchlist` (key: `symbol`) — user-curated symbols
- `mutations` (key: `clientOrderId`) — pending optimistic writes
- `syncMeta` (key: `symbol`) — last synced sequence per symbol

**Optimistic order flow:**
1. User clicks Buy/Sell → UI shows `pending` instantly via `useOptimistic`
2. Write queued in IndexedDB `mutations` store
3. Worker simulates exchange latency (50–200ms)
4. On fill: status → `filled`; position/wallet update optimistically
5. On reject: rollback UI, show error toast
6. Offline: order stays `pending`; background sync flushes on reconnect

---

## 8. Plugin Interface — Market Data Provider

Abstract the Web Worker behind a provider interface so the broker can swap synthetic mock data for a real feed (Polygon.io, Alpaca, FIX gateway) without touching UI or state layers.

### Interface (`src/market/provider.ts`)

```ts
export interface MarketDataProvider {
  /** Connect to the data source. */
  connect(symbols: string[]): void
  /** Disconnect and clean up. */
  disconnect(): void
  /** Subscribe to a typed topic (ticks, book, tape, alerts). */
  subscribe<T>(topic: string, handler: (msg: T) => void): () => void
  /** Adjust stream frequency (mock only; real providers may ignore). */
  setRate(hz: number): void
  /** Health status for the UI banner. */
  health(): ProviderHealth
}

export interface ProviderHealth {
  connected: boolean
  latencyMs: number
  lastError?: string
}
```

### Contract with the Stream Layer

The `streams/marketStore.ts` depends only on `MarketDataProvider`, not on the concrete mock worker. The provider pushes to the ring buffer via a callback registered at connect time.

### Providers

| Provider | Implementation | Use Case |
|----------|---------------|----------|
| `MockMarketProvider` | Web Worker generator (current) | Offline demo, zero backend, CI testing |
| `PolygonProvider` | WebSocket + REST (future) | Real market data |
| `AlpacaProvider` | WebSocket (future) | Brokerage integration |
| `SimulatedExchangeProvider` | Worker + fill simulation | Order testing without live risk |

### Senior Signal

- **Dependency inversion:** UI and cache layers never import the worker directly.
- **Swap without rewrite:** Adding a real feed requires one new class implementing the interface, not refactoring components.
- **Testability:** Unit tests can inject a fake provider that emits deterministic ticks.

---

## 9. Microfrontend Readiness (Not Implemented Now)

Monorepo structured for future extraction:

- **Shared kernel (never split):** design system, TypeScript types, TanStack Query client, IndexedDB schema, Web Worker generator, auth/session
- **Feature boundaries (extraction candidates):** `home`, `portfolio`, `watchlist`, `profile`, `trading`
- **Extraction seams:** route-based lazy loading (`dynamic import`), no feature-to-feature imports, namespaced IndexedDB stores, URL params for cross-feature communication
- **Future path:** extract `@meridian/trading` or `@meridian/watchlist` as Module Federation remotes or separate deployables loaded by host shell

---

## 9. Repository Structure

```
meridian-broker/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── vitest.config.ts
├── playwright.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── router.tsx
│   ├── lib/utils.ts
│   ├── store/theme.ts              # Zustand (theme only)
│   ├── components/ui/              # shadcn/ui primitives
│   ├── components/layout/
│   ├── components/home/
│   ├── components/portfolio/
│   ├── components/watchlist/
│   ├── components/profile/
│   ├── components/trading/
│   ├── components/common/          # perfHud.tsx, offlineBanner.tsx
│   ├── components/virtualization/
│   ├── worker/marketGenerator.ts
│   ├── worker/exchangeSimulator.ts
│   ├── worker/messageSchema.ts
│   ├── worker/workerFactory.ts
│   ├── streams/marketStore.ts
│   ├── streams/backPressure.ts
│   ├── streams/objectPool.ts
│   ├── cache/indexedDB.ts
│   ├── cache/queryClient.ts
│   ├── cache/optimistic.ts
│   ├── cache/sync.ts
│   ├── hooks/useMarketStream.ts
│   ├── hooks/usePortfolio.ts
│   ├── hooks/useOrders.ts
│   ├── hooks/useWatchlist.ts
│   ├── hooks/useAccount.ts
│   ├── hooks/useTheme.ts
│   ├── types/broker.ts
│   └── utils/formatting.ts
├── tests/
│   ├── e2e/soak.test.ts
│   ├── virtualization/
│   └── cache/
├── PLAN.md
└── README.md
```

---

## 10. CI / Observability Gates

| Job | Tool | Assertion |
|-----|------|-----------|
| Unit | Vitest | Object pool, ring buffer, back-pressure logic |
| E2E Smoke | Playwright | All 4 pages load; optimistic order updates UI |
| Soak | Playwright | 15-min run at 100k ticks/min; heap ≤10% growth; DOM ≤60 |
| Bundle | Vite + size-limit | < 250 KB gzipped JS |
| Lighthouse CI | Lighthouse | Performance ≥ 90, Accessibility ≥ 90 |

**Perf HUD:** Toggleable overlay showing JS heap, DOM node count, FPS, INP, and worker lag.

---

## 11. Milestones

| M | Focus | Deliverable |
|---|-------|-------------|
| M1 | Scaffold | Vite + React 19 + TS + Tailwind + shadcn/ui + TanStack Router + TanStack Query |
| M2 | Kernel | Shared types, IDB schema, Query client, Worker market generator, Zustand theme store |
| M3 | Home | Popular stocks grid, market movers, search (virtualized) |
| M4 | Portfolio | Account summary, positions virtualized table, P&L |
| M5 | Watchlist | Add/remove, alerts, optimistic UI, IDB persistence |
| M6 | Profile | User info, wallet, settings, theme, logout |
| M7 | Trading | Trade ticket, order book, tape, order history, optimistic fills |
| M8 | Boundaries | ESLint import rules enforcing feature isolation; lazy route splitting verified |
| M9 | Memory | Perf HUD, CI soak test, detached-node guard |
| M10 | Ship | Deploy to Vercel/GitHub Pages; README documentation |

---

## 12. Anti-Patterns Explicitly Avoided

| Anti-Pattern | Replacement |
|--------------|-------------|
| Storing 100k ticks in React state | `useSyncExternalStore` + external ring buffer |
| `setInterval` → `setState` per tick | Batched postMessage → one state update per frame |
| `useContext` for theme | Zustand store (selectors, persistence, no provider) |
| Redux/Zustand for cached data | TanStack Query v5 + IndexedDB |
| Unbounded IndexedDB growth | TTL-capped `ticks` store + mutation queue limits |
| Feature-to-feature imports | Kernel-mediated communication or URL params |
