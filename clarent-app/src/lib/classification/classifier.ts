/**
 * Lane 1 / Lane 2 classifier.
 *
 * Pure rule-based engine. Inputs are already-resolved waste stream
 * metadata + the generator's intake answers. Output is the lane the
 * job should flow through, a confidence score (0–100), and a list of
 * human-readable reasons describing why the classifier arrived at that
 * decision.
 *
 * Lane 1 = instant-pricing eligible, Lane 2 = ops review + RFQ.
 *
 * Decision order (first match wins, subsequent rules only tighten
 * confidence):
 *   1. Stream-level lane_eligibility is lane_2 → hard route to Lane 2
 *   2. Container condition is significantly damaged → hard route to Lane 2
 *   3. Container condition is minor_damage → hard route to Lane 2
 *   4. Containers not UN-spec certified → hard route to Lane 2
 *   5. Generator hasn't certified no-mixing → hard route to Lane 2
 *   6. Container condition unknown → stay Lane 1 but lower confidence
 *   7. Very large quantity (> 10 containers) → lower confidence
 *   8. Default → Lane 1 at full confidence
 *
 * Phase 8 AI classification will call this first, then use SDS parsing,
 * photo analysis, and historical job similarity to further adjust the
 * confidence score and potentially override to Lane 2.
 */

import type { laneEligibilityEnum } from '@/lib/db/schema';

export type Lane = 'lane_1' | 'lane_2';

export type LaneEligibility = (typeof laneEligibilityEnum.enumValues)[number];

export type ContainerCondition = 'intact' | 'minor_damage' | 'significant_damage' | 'unknown';

export type ClassificationInput = {
  stream: {
    key: string;
    laneEligibility: LaneEligibility;
  };
  containerType: string;
  containerCount: number;
  containerCondition: ContainerCondition | null;
  unContainerCertified: boolean;
  generatorCertifiedNoMixing: boolean;
};

export type ClassificationResult = {
  lane: Lane;
  confidence: number;
  reasons: string[];
};

const MAX_LANE_1_CONTAINERS = 10;

export function classify(input: ClassificationInput): ClassificationResult {
  const reasons: string[] = [];

  // 1. Stream-level lane_2 → hard route
  if (input.stream.laneEligibility === 'lane_2') {
    return {
      lane: 'lane_2',
      confidence: 95,
      reasons: [
        `Waste stream "${input.stream.key}" is marked lane_2 (complex classification or specialty handling required)`,
      ],
    };
  }

  // 2-3. Damaged containers → hard route to lane_2
  if (input.containerCondition === 'significant_damage') {
    return {
      lane: 'lane_2',
      confidence: 100,
      reasons: ['Container reported with significant damage — specialty handling required'],
    };
  }

  if (input.containerCondition === 'minor_damage') {
    return {
      lane: 'lane_2',
      confidence: 90,
      reasons: ['Container reported with minor damage — ops review required'],
    };
  }

  // 4. UN-spec certification is a Lane 1 prerequisite
  if (!input.unContainerCertified) {
    return {
      lane: 'lane_2',
      confidence: 90,
      reasons: ['Containers not certified as UN-specification — repack required before pickup'],
    };
  }

  // 5. Mixing certification is a Lane 1 prerequisite
  if (!input.generatorCertifiedNoMixing) {
    return {
      lane: 'lane_2',
      confidence: 85,
      reasons: [
        'Generator has not certified waste is not mixed with other streams — ops review required',
      ],
    };
  }

  // At this point we're on Lane 1. Compute confidence downgrades.
  let confidence = 100;

  // 6. Unknown container condition
  if (input.containerCondition === 'unknown' || input.containerCondition === null) {
    confidence -= 20;
    reasons.push('Container condition not reported — confidence reduced');
  }

  // 7. Large quantity
  if (input.containerCount > MAX_LANE_1_CONTAINERS) {
    confidence -= 10;
    reasons.push(
      `Quantity (${input.containerCount} containers) above standard Lane 1 threshold — confidence reduced`,
    );
  }

  if (reasons.length === 0) {
    reasons.push('Standard waste stream with certified, intact containers');
  }

  return {
    lane: 'lane_1',
    confidence,
    reasons,
  };
}
