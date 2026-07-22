import { calculateAge, calculateBmr } from './bmr'

describe('calculateAge', () => {
  it('returns the same year difference when the birthday has already passed this year', () => {
    expect(
      calculateAge({
        birthDate: new Date('1992-01-15T00:00:00Z'),
        asOf: new Date('2026-07-15T00:00:00Z'),
      })
    ).toBe(34)
  })

  it('subtracts one year when the birthday has not yet occurred this year', () => {
    expect(
      calculateAge({
        birthDate: new Date('1992-12-25T00:00:00Z'),
        asOf: new Date('2026-07-15T00:00:00Z'),
      })
    ).toBe(33)
  })

  it('treats the birthday itself as already turned', () => {
    expect(
      calculateAge({
        birthDate: new Date('1992-07-15T00:00:00Z'),
        asOf: new Date('2026-07-15T00:00:00Z'),
      })
    ).toBe(34)
  })

  it('handles the day before the birthday correctly (same month)', () => {
    expect(
      calculateAge({
        birthDate: new Date('1992-07-15T00:00:00Z'),
        asOf: new Date('2026-07-14T00:00:00Z'),
      })
    ).toBe(33)
  })
})

describe('calculateBmr', () => {
  it('computes male BMR per Mifflin-St Jeor (+5)', () => {
    // 10*80 + 6.25*180 - 5*34 + 5 = 800 + 1125 - 170 + 5 = 1760
    expect(
      calculateBmr({ sex: 'MALE', weightKg: 80, heightCm: 180, age: 34 })
    ).toBeCloseTo(1760, 5)
  })

  it('computes female BMR per Mifflin-St Jeor (-161)', () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
    expect(
      calculateBmr({ sex: 'FEMALE', weightKg: 60, heightCm: 165, age: 30 })
    ).toBeCloseTo(1320.25, 5)
  })

  it('throws for non-positive weight', () => {
    expect(() =>
      calculateBmr({ sex: 'MALE', weightKg: 0, heightCm: 180, age: 34 })
    ).toThrow(/weightKg/)
    expect(() =>
      calculateBmr({ sex: 'MALE', weightKg: -5, heightCm: 180, age: 34 })
    ).toThrow(/weightKg/)
  })

  it('throws for non-positive height', () => {
    expect(() =>
      calculateBmr({ sex: 'MALE', weightKg: 80, heightCm: 0, age: 34 })
    ).toThrow(/heightCm/)
  })

  it('throws for negative age', () => {
    expect(() =>
      calculateBmr({ sex: 'MALE', weightKg: 80, heightCm: 180, age: -1 })
    ).toThrow(/age/)
  })
})
