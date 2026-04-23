/**
 * Re-exports from the repo `full-version` app (`tsconfig` path `@fullversion/*` → `../full-version/src/*`).
 * Same MUI + aliases (`@/`, `@core/`, etc.) as this starter. If a re-export fails at runtime, that widget may
 * depend on full-only routes/types — use it as a reference and copy a slim variant into `pharmaERPFE`.
 */
export { default as EcommerceStatisticsCard } from '@fullversion/views/apps/ecommerce/dashboard/StatisticsCard'
export { default as LogisticsStatisticsCard } from '@fullversion/views/apps/logistics/dashboard/LogisticsStatisticsCard'
export { default as AcademyWelcomeCard } from '@fullversion/views/apps/academy/dashboard/WelcomeCard'
