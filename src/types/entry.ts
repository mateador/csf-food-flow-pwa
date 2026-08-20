/**
 * Small hand-written convenience aliases on top of the generated api.ts
 * types. Kept separate from api.ts so regenerating types never clobbers
 * project-specific helper types.
 */
import type { components } from './api'

export type Entry = components['schemas']['Entry']
export type Location = components['schemas']['Location']
export type FoodCategory = components['schemas']['FoodCategory']
export type User = components['schemas']['User']
export type WeeklyReport = components['schemas']['WeeklyReport']
