import { describe, expect, it } from 'vitest';
import { classify, type ClassificationInput } from './classifier';

const baseStandard: ClassificationInput = {
  stream: { key: 'waste_paint', laneEligibility: 'lane_1' },
  containerType: '55gal_drum',
  containerCount: 3,
  containerCondition: 'intact',
  unContainerCertified: true,
  generatorCertifiedNoMixing: true,
};

describe('classify — happy path', () => {
  it('routes a standard Lane 1 stream with all checks passing to lane_1 at 100', () => {
    const result = classify(baseStandard);
    expect(result.lane).toBe('lane_1');
    expect(result.confidence).toBe(100);
    expect(result.reasons).toEqual(['Standard waste stream with certified, intact containers']);
  });

  it('routes a Lane 1 stream with "both" eligibility to lane_1 when conditions are met', () => {
    const result = classify({
      ...baseStandard,
      stream: { key: 'mixed_stream', laneEligibility: 'both' },
    });
    expect(result.lane).toBe('lane_1');
    expect(result.confidence).toBe(100);
  });
});

describe('classify — stream-level routing', () => {
  it('routes a lane_2-marked stream to lane_2 regardless of other conditions', () => {
    const result = classify({
      ...baseStandard,
      stream: { key: 'lab_pack', laneEligibility: 'lane_2' },
    });
    expect(result.lane).toBe('lane_2');
    expect(result.confidence).toBe(95);
    expect(result.reasons[0]).toContain('lab_pack');
    expect(result.reasons[0]).toContain('lane_2');
  });
});

describe('classify — container condition', () => {
  it('routes significant_damage to lane_2 at full confidence', () => {
    const result = classify({ ...baseStandard, containerCondition: 'significant_damage' });
    expect(result.lane).toBe('lane_2');
    expect(result.confidence).toBe(100);
    expect(result.reasons[0]).toContain('significant damage');
  });

  it('routes minor_damage to lane_2 at reduced confidence', () => {
    const result = classify({ ...baseStandard, containerCondition: 'minor_damage' });
    expect(result.lane).toBe('lane_2');
    expect(result.confidence).toBe(90);
    expect(result.reasons[0]).toContain('minor damage');
  });

  it('accepts unknown condition but reduces confidence', () => {
    const result = classify({ ...baseStandard, containerCondition: 'unknown' });
    expect(result.lane).toBe('lane_1');
    expect(result.confidence).toBe(80);
    expect(result.reasons.some((r) => r.includes('not reported'))).toBe(true);
  });

  it('accepts null condition and treats it like unknown', () => {
    const result = classify({ ...baseStandard, containerCondition: null });
    expect(result.lane).toBe('lane_1');
    expect(result.confidence).toBe(80);
  });
});

describe('classify — certifications', () => {
  it('routes to lane_2 when containers are not UN-spec certified', () => {
    const result = classify({ ...baseStandard, unContainerCertified: false });
    expect(result.lane).toBe('lane_2');
    expect(result.confidence).toBe(90);
    expect(result.reasons[0]).toContain('UN-specification');
  });

  it('routes to lane_2 when generator has not certified no-mixing', () => {
    const result = classify({ ...baseStandard, generatorCertifiedNoMixing: false });
    expect(result.lane).toBe('lane_2');
    expect(result.confidence).toBe(85);
    expect(result.reasons[0]).toContain('not mixed');
  });

  it('prefers the more severe lane_2 reason (damage > no-cert > no-mixing) on order', () => {
    const result = classify({
      ...baseStandard,
      containerCondition: 'significant_damage',
      unContainerCertified: false,
      generatorCertifiedNoMixing: false,
    });
    expect(result.lane).toBe('lane_2');
    expect(result.reasons[0]).toContain('significant damage');
  });
});

describe('classify — quantity', () => {
  it('keeps lane_1 for quantities at or below the threshold', () => {
    const result = classify({ ...baseStandard, containerCount: 10 });
    expect(result.lane).toBe('lane_1');
    expect(result.confidence).toBe(100);
  });

  it('reduces confidence for quantities above the Lane 1 threshold', () => {
    const result = classify({ ...baseStandard, containerCount: 11 });
    expect(result.lane).toBe('lane_1');
    expect(result.confidence).toBe(90);
    expect(result.reasons.some((r) => r.includes('above standard Lane 1'))).toBe(true);
  });

  it('stacks quantity + unknown condition confidence penalties', () => {
    const result = classify({
      ...baseStandard,
      containerCount: 15,
      containerCondition: 'unknown',
    });
    expect(result.lane).toBe('lane_1');
    expect(result.confidence).toBe(70);
    expect(result.reasons).toHaveLength(2);
  });
});
