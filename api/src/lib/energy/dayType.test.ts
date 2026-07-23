import { resolveDayType } from './dayType'

describe('resolveDayType', () => {
  it('returns REST for an empty day', () => {
    expect(resolveDayType([])).toBe('REST')
  })

  it('returns REST for a day with only non-training items', () => {
    expect(
      resolveDayType([
        { type: 'MEDICATION' },
        { type: 'SUPPLEMENT' },
        { type: 'OTHER' },
      ])
    ).toBe('REST')
  })

  it('returns TRAINING for a plain RUN with no long/quality flags', () => {
    expect(
      resolveDayType([{ type: 'RUN', durationMin: 30, prescription: {} }])
    ).toBe('TRAINING')
  })

  it('returns TRAINING for a LIFT session', () => {
    expect(resolveDayType([{ type: 'LIFT' }])).toBe('TRAINING')
  })

  it('returns LONG_RUN when prescription.isLongRun is true', () => {
    expect(
      resolveDayType([
        { type: 'RUN', durationMin: 40, prescription: { isLongRun: true } },
      ])
    ).toBe('LONG_RUN')
  })

  it('returns LONG_RUN when durationMin >= 75 even without the flag', () => {
    expect(resolveDayType([{ type: 'RUN', durationMin: 75 }])).toBe('LONG_RUN')
  })

  it('does not treat a 74-minute run as a long run on duration alone', () => {
    expect(resolveDayType([{ type: 'RUN', durationMin: 74 }])).toBe('TRAINING')
  })

  it('returns QUALITY_RUN when prescription.isQualityRun is true', () => {
    expect(
      resolveDayType([
        {
          type: 'RUN',
          durationMin: 45,
          prescription: { isQualityRun: true },
        },
      ])
    ).toBe('QUALITY_RUN')
  })

  it('prioritizes LONG_RUN over QUALITY_RUN when both are scheduled the same day', () => {
    expect(
      resolveDayType([
        { type: 'RUN', prescription: { isQualityRun: true } },
        { type: 'RUN', prescription: { isLongRun: true } },
      ])
    ).toBe('LONG_RUN')
  })

  it('prioritizes QUALITY_RUN over a plain LIFT day', () => {
    expect(
      resolveDayType([
        { type: 'LIFT' },
        { type: 'RUN', prescription: { isQualityRun: true } },
      ])
    ).toBe('QUALITY_RUN')
  })

  it('ignores MEDICATION/SUPPLEMENT/OTHER items when a RUN/LIFT is also present', () => {
    expect(
      resolveDayType([
        { type: 'MEDICATION' },
        { type: 'RUN', prescription: { isLongRun: true } },
      ])
    ).toBe('LONG_RUN')
  })
})
