/**
 * Runtime validation for the weigh-in / weigh-out form (routes /weigh-in
 * and /weigh-out). This is intentionally the ONLY Zod schema in the
 * project for V1 -- it exists because this is the one place a user
 * directly types values in, so client-side validation genuinely improves
 * the experience (immediate feedback before a round-trip to the API).
 *
 * This schema is hand-written, not generated, because Zod-from-OpenAPI
 * codegen isn't a well-established practice yet. It must be kept in sync
 * with the `POST /entries` request body in docs/openapi.yaml by hand --
 * see docs/CONTRACT.md for the full sync discipline.
 *
 * The API is still the authority: this schema improves UX, it does not
 * replace server-side validation. A client that skips this check entirely
 * (a malicious or buggy client) must still be rejected correctly by the
 * API's own msgspec validation.
 */
import { z } from 'zod'

export const entryTypeSchema = z.enum(['IN', 'OUT'])
export const foodCategoryCodeSchema = z.enum(['FRESH', 'FROZEN', 'AMBIENT'])

export const createEntrySchema = z
  .object({
    client_uuid: z.string().uuid(),
    entry_type: entryTypeSchema,
    location_id: z.string().uuid(),
    destination_location_id: z.string().uuid().nullable(),
    food_category_code: foodCategoryCodeSchema,
    weight_kg: z
      .number()
      .positive('Weight must be greater than zero')
      .max(1000, 'Weight seems too high -- double-check the value'),
    collection_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
      .refine((value) => new Date(value) <= new Date(), {
        message: 'Collection date cannot be in the future'
      }),
    notes: z.string().nullable()
  })
  .refine(
    (data) => (data.entry_type === 'IN' ? data.destination_location_id === null : true),
    { message: 'IN entries must not have a destination location', path: ['destination_location_id'] }
  )
  .refine(
    (data) => (data.entry_type === 'OUT' ? data.destination_location_id !== null : true),
    { message: 'OUT entries require a destination location', path: ['destination_location_id'] }
  )
  .refine(
    (data) => data.destination_location_id !== data.location_id,
    { message: 'Destination cannot be the same as the source location', path: ['destination_location_id'] }
  )

export type CreateEntryInput = z.infer<typeof createEntrySchema>
