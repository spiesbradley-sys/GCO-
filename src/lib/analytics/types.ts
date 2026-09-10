// Typed contract for the CFO dashboard. The service (service.ts) currently fills
// these from a deterministic mock layer; the linked accounting systems will
// replace the mock with real queries behind the SAME types.

export type Period = string; // 'YYYY-MM'

export const AR_BUCKETS = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'] as const;
export type ArBucketKey = (typeof AR_BUCKETS)[number];

export const AR_BUCKET_LABEL: Record<ArBucketKey, string> = {
  current: 'Current',
  d1_30: '1–30',
  d31_60: '31–60',
  d61_90: '61–90',
  d90_plus: '90+',
};

export type KpiKey =
  | 'collections'
  | 'production'
  | 'collectionRate'
  | 'cashOnHand'
  | 'totalAr'
  | 'arOver90';

export type Kpi = {
  key: KpiKey;
  label: string;
  /** Preformatted display value (currency or percent). */
  display: string;
  /** Signed variance vs prior period, already sign-aware for meaning. */
  variance: {
    /** Direction of the number itself. */
    direction: 'up' | 'down';
    /** Whether that movement is good for this metric. */
    favorable: boolean;
    text: string; // e.g. "+4.2% vs Feb"
  } | null;
};

export type LocationRef = { id: string; name: string };
export type ProviderRef = { id: string; name: string };

export type CashflowPoint = {
  /** Opaque bucket id (period sub-bucket) — safe for URLs. */
  bucketId: string;
  label: string; // e.g. "Wk 1"
  cashInCents: number;
  cashOutCents: number;
  cashOnHandCents: number;
  budgetNetCents: number;
};

export type ArBucketDatum = {
  bucket: ArBucketKey;
  amountCents: number;
  invoiceCount: number;
};

export type ArRow = {
  /** Opaque row id (location or payer) — never a raw name in a URL. */
  refId: string;
  label: string;
  byBucket: Record<ArBucketKey, number>;
  totalCents: number;
};

export type LocationRow = {
  locationId: string;
  location: string;
  revenueCents: number;
  productionCents: number;
  collectionsCents: number;
  collectionRate: number; // 0..1
  arCents: number;
  budgetRevenueCents: number;
  varianceCents: number; // revenue - budget
};

export type PnlRow = {
  lineId: string;
  account: string;
  category: 'revenue' | 'cogs' | 'opex' | 'other';
  actualCents: number;
  budgetCents: number;
  varianceCents: number; // actual - budget
  /** Whether a positive variance is favorable for this category. */
  positiveIsFavorable: boolean;
};

export type WaterfallStep = {
  /** Opaque step id — safe for URLs. */
  stepId: string;
  label: string;
  /** For start/end anchor bars. */
  kind: 'start' | 'delta' | 'end';
  /** Signed amount for delta steps; absolute for anchors. */
  amountCents: number;
};

export type ProviderRow = {
  providerId: string;
  provider: string;
  productionCents: number;
  collectionsCents: number;
  collectionRate: number;
  adjustmentsCents: number;
};

export type TrendPoint = { label: string; valueCents?: number; rate?: number };

export type CfoDashboardData = {
  period: Period;
  periodLabel: string;
  priorLabel: string;
  scope: { level: 'group' | 'location'; locationId: string | null; locationName: string | null };
  locations: LocationRef[];
  kpis: Kpi[];
  cashflow: CashflowPoint[];
  ar: { buckets: ArBucketDatum[]; byLocation: ArRow[]; byPayer: ArRow[]; totalCents: number };
  locationRows: LocationRow[];
  pnl: { rows: PnlRow[]; ebitdaWaterfall: WaterfallStep[] };
  providerRows: ProviderRow[];
  collectionRateTrend: TrendPoint[];
};
