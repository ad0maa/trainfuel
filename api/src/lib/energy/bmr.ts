// SPEC.md §6.1: Mifflin-St Jeor BMR. Pure, no DB access — the single most
// test-worthy calculation in the app per §9.

import type { Sex } from 'src/lib/db'

export interface CalculateAgeInput {
  birthDate: Date
  asOf: Date
}

/** Whole years of age as of `asOf`, accounting for whether the birthday has occurred yet this year. */
export function calculateAge({ birthDate, asOf }: CalculateAgeInput): number {
  let age = asOf.getUTCFullYear() - birthDate.getUTCFullYear()
  const asOfIsBeforeBirthdayThisYear =
    asOf.getUTCMonth() < birthDate.getUTCMonth() ||
    (asOf.getUTCMonth() === birthDate.getUTCMonth() &&
      asOf.getUTCDate() < birthDate.getUTCDate())
  if (asOfIsBeforeBirthdayThisYear) {
    age -= 1
  }
  return age
}

export interface CalculateBmrInput {
  sex: Sex
  weightKg: number
  heightCm: number
  age: number
}

/**
 * Mifflin-St Jeor BMR (SPEC.md §6.1):
 *   male:   10*weightKg + 6.25*heightCm − 5*age + 5
 *   female: 10*weightKg + 6.25*heightCm − 5*age − 161
 */
export function calculateBmr({
  sex,
  weightKg,
  heightCm,
  age,
}: CalculateBmrInput): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error(
      `calculateBmr: weightKg must be a positive number, got ${weightKg}`
    )
  }
  if (!Number.isFinite(heightCm) || heightCm <= 0) {
    throw new Error(
      `calculateBmr: heightCm must be a positive number, got ${heightCm}`
    )
  }
  if (!Number.isFinite(age) || age < 0) {
    throw new Error(
      `calculateBmr: age must be a non-negative number, got ${age}`
    )
  }

  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'MALE' ? base + 5 : base - 161
}
