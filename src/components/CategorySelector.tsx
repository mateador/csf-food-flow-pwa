import type { components } from '../types/api'

type FoodCategory = components['schemas']['FoodCategory']

interface CategorySelectorProps {
  categories: FoodCategory[]
  value: string
  onChange: (code: string) => void
}

/**
 * Large tappable buttons instead of a <select> dropdown. A dropdown needs
 * two taps (open, then choose) plus more careful aiming on a small
 * screen than a big button does -- with only 6 categories, showing them
 * all at once as one-tap buttons is a real reduction in friction, not
 * just a visual change.
 */
export function CategorySelector({ categories, value, onChange }: CategorySelectorProps) {
  return (
    <div class="grid grid-cols-2 gap-2" role="group" aria-label="Select a category">
      {categories.map((cat) => {
        const isSelected = value === cat.code
        return (
          <button
            key={cat.code}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(cat.code)}
            class={
              isSelected
                ? 'rounded-lg border-2 border-csf-purple bg-csf-purple px-4 py-3 text-left text-base font-medium text-white active:scale-[0.98]'
                : 'rounded-lg border-2 border-neutral-200 bg-white px-4 py-3 text-left text-base text-neutral-700 active:scale-[0.98]'
            }
          >
            {cat.name}
          </button>
        )
      })}
    </div>
  )
}