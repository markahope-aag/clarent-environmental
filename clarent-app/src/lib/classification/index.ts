// Rule-based Lane 1 / Lane 2 classifier.
//
// Given an intake form submission + the target waste stream's metadata,
// decide whether the job is eligible for Lane 1 (instant instant-priced
// pickup) or Lane 2 (ops review, RFQ to vendors). Also emits a confidence
// score and an audit-friendly list of reasons that led to the decision.
//
// The engine is strict-downgrade: any "hard" trigger (damaged container,
// missing certification, unknown stream, high-volume job) forces lane_2
// regardless of baseline. "Soft" triggers (minor damage, missing photos)
// keep the baseline but eat confidence points so the ops team can see
// which jobs are borderline.

export type Lane = 'lane_1' | 'lane_2';

export type LaneEligibility = 'lane_1' | 'lane_2' | 'both';

export type ContainerCondition = 'intact' | 'minor_damage' | 'significant_damage' | 'unknown';

export type ClassificationInput = {
  /** Waste stream key from the intake. `null` or empty string means unknown. */
  wasteStreamKey: string | null;
  /** Stream's lane_eligibility from waste_streams. `null` when stream not found. */
  wasteStreamLaneEligibility: LaneEligibility | null;
  /** Stream's waste framework (rcra_hazardous, universal_waste, etc). Informational only. */
  wasteFramework: string | null;
  containerType: string;
  containerCount: number;
  containerCondition: ContainerCondition;
  /** Whether the generator affirmed UN-spec containerized. */
  unContainerCertified: boolean;
  /** Whether intake photos were uploaded. */
  hasPhotos: boolean;
  /** Generator affirmations block from the intake certification step. */
  certifications: {
    notMixed: boolean;
    containersSealedAndLabeled: boolean;
    sourceIdentified: boolean;
  };
};

export type ClassificationResult = {
  lane: Lane;
  confidence: number;
  reasons: string[];
  downgrades: string[];
};

/** Upper bound — completely clean submission. */
const BASELINE_CONFIDENCE = 95;

/** Confidence floor — we never return below this value. */
const MIN_CONFIDENCE = 5;

/** Container count threshold above which jobs route to Lane 2. */
const LANE_1_MAX_CONTAINERS = 20;

type DowngradeRule = {
  /** If true, trigger a hard downgrade to lane_2. */
  hard: boolean;
  confidenceCost: number;
  reason: string;
};

type Evaluator = (input: ClassificationInput) => DowngradeRule | null;

const EVALUATORS: Evaluator[] = [
  // Unknown or missing stream → ops review
  (i) =>
    !i.wasteStreamKey || !i.wasteStreamLaneEligibility
      ? {
          hard: true,
          confidenceCost: 35,
          reason: 'Waste stream not recognized — routed to ops for classification',
        }
      : null,

  // Stream itself is lane_2-only
  (i) =>
    i.wasteStreamLaneEligibility === 'lane_2'
      ? {
          hard: true,
          confidenceCost: 0,
          reason: 'Waste stream is Lane 2 eligible only',
        }
      : null,

  // Container condition
  (i) => {
    switch (i.containerCondition) {
      case 'significant_damage':
        return {
          hard: true,
          confidenceCost: 40,
          reason: 'Container has significant damage — specialist review required',
        };
      case 'unknown':
        return {
          hard: true,
          confidenceCost: 25,
          reason: 'Container condition unknown — ops must inspect',
        };
      case 'minor_damage':
        return {
          hard: false,
          confidenceCost: 10,
          reason: 'Container has minor damage',
        };
      default:
        return null;
    }
  },

  // Container spec
  (i) =>
    !i.unContainerCertified
      ? {
          hard: true,
          confidenceCost: 20,
          reason: 'Containers are not UN-spec certified',
        }
      : null,

  // Certification affirmations
  (i) =>
    !i.certifications.notMixed
      ? {
          hard: true,
          confidenceCost: 25,
          reason: 'Generator did not certify that waste is not mixed with other streams',
        }
      : null,

  (i) =>
    !i.certifications.containersSealedAndLabeled
      ? {
          hard: false,
          confidenceCost: 10,
          reason: 'Containers are not yet sealed and labeled',
        }
      : null,

  (i) =>
    !i.certifications.sourceIdentified
      ? {
          hard: false,
          confidenceCost: 15,
          reason: 'Waste source process not identified',
        }
      : null,

  // Photos
  (i) =>
    !i.hasPhotos
      ? {
          hard: false,
          confidenceCost: 15,
          reason: 'No intake photos attached',
        }
      : null,

  // Volume threshold
  (i) =>
    i.containerCount > LANE_1_MAX_CONTAINERS
      ? {
          hard: true,
          confidenceCost: 15,
          reason: `High-volume job (${i.containerCount} containers > ${LANE_1_MAX_CONTAINERS}) — routed to ops`,
        }
      : null,

  // Sanity: container count must be positive
  (i) =>
    i.containerCount <= 0
      ? {
          hard: true,
          confidenceCost: 30,
          reason: 'Container count must be at least 1',
        }
      : null,
];

/**
 * Classify an intake submission into Lane 1 or Lane 2.
 */
export function classify(input: ClassificationInput): ClassificationResult {
  const baselineLane: Lane =
    input.wasteStreamLaneEligibility === 'lane_1' || input.wasteStreamLaneEligibility === 'both'
      ? 'lane_1'
      : 'lane_2';

  let confidence = BASELINE_CONFIDENCE;
  let lane: Lane = baselineLane;
  const reasons: string[] = [];
  const downgrades: string[] = [];

  for (const evaluator of EVALUATORS) {
    const rule = evaluator(input);
    if (!rule) continue;
    confidence -= rule.confidenceCost;
    downgrades.push(rule.reason);
    if (rule.hard) lane = 'lane_2';
  }

  if (lane === 'lane_1') {
    reasons.push('Standard waste stream, clean certification, instant-price eligible');
  } else if (downgrades.length === 0) {
    reasons.push('Routed to Lane 2 per waste stream eligibility');
  } else {
    reasons.push('Routed to Lane 2 — one or more downgrade conditions triggered');
  }

  return {
    lane,
    confidence: Math.max(MIN_CONFIDENCE, Math.min(100, Math.round(confidence))),
    reasons,
    downgrades,
  };
}

/** Clean-submission factory for tests and UI defaults. */
export function cleanLane1Input(overrides: Partial<ClassificationInput> = {}): ClassificationInput {
  return {
    wasteStreamKey: 'used_oil',
    wasteStreamLaneEligibility: 'lane_1',
    wasteFramework: 'used_oil',
    containerType: '55gal_drum',
    containerCount: 2,
    containerCondition: 'intact',
    unContainerCertified: true,
    hasPhotos: true,
    certifications: {
      notMixed: true,
      containersSealedAndLabeled: true,
      sourceIdentified: true,
    },
    ...overrides,
  };
}
