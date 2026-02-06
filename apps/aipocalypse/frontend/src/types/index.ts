// Signal ratings
export type SignalRating = 'strong_sell' | 'sell' | 'hold' | 'buy' | 'strong_buy'
export type QueueItemStatus = 'queued' | 'in_progress' | 'completed' | 'failed'
export type ThesisType = 'disruption' | 'secular_trend' | 'macro' | 'regulatory'
export type ImpactDirection = 'positive' | 'negative' | 'mixed'
export type MoatRating = 'strong' | 'moderate' | 'weak' | 'none'

export interface Hypothesis {
  id: string
  title: string
  description: string
  thesis_type: ThesisType
  affected_industry_ids: string[]
  affected_company_type_ids: string[]
  impact_direction: ImpactDirection
  confidence_level: number
  tags: string[]
  status: 'active' | 'archived'
  supporting_evidence: string[]
  counter_arguments: string[]
  created_at: string
  updated_at: string
}

export interface Industry {
  id: string
  name: string
  slug: string
  parent_id: string | null
  level: number
  icon: string
  description: string
  sort_order: number
  company_count: number
  is_system: boolean
  created_at: string
  updated_at: string
}

export interface IndustryTreeNode extends Industry {
  children: IndustryTreeNode[]
}

export interface Company {
  id: string
  name: string
  ticker: string
  industry_id: string | null
  sub_industry_id: string | null
  description: string
  sec_cik: string | null
  exchange: string | null
  current_pe: number | null
  forward_pe: number | null
  historical_pe_1yr: number | null
  market_cap: number | null
  revenue: number | null
  gross_margin: number | null
  operating_margin: number | null
  current_price: number | null
  price_change_1yr: number | null
  financial_data_updated_at: string | null
  linked_hypothesis_ids: string[]
  latest_signal: SignalRating | null
  latest_report_id: string | null
  latest_report_date: string | null
  report_count: number
  tags: string[]
  created_at: string
  updated_at: string
}

export interface HypothesisImpact {
  hypothesis_id: string
  impact_summary: string
}

export interface Citation {
  source: string
  url?: string
  accessed_at?: string
  excerpt?: string
}

export interface PricePoint {
  date: string
  close: number
}

export interface AnalystConsensus {
  targetMeanPrice: number | null
  targetHighPrice: number | null
  targetLowPrice: number | null
  recommendationKey: string | null
  recommendationMean: number | null
  numberOfAnalystOpinions: number | null
  currentPrice: number | null
}

export interface KeyMetrics {
  trailingPE?: number
  forwardPE?: number
  marketCap?: number
  totalRevenue?: number
  ebitda?: number
  totalCash?: number
  totalDebt?: number
  freeCashflow?: number
  returnOnEquity?: number
  dividendYield?: number
  beta?: number
  enterpriseValue?: number
  priceToBook?: number
  priceToSalesTrailing12Months?: number
  grossMargins?: number
  operatingMargins?: number
  profitMargins?: number
  revenueGrowth?: number
  earningsGrowth?: number
}

export interface ForwardValuationScenario {
  name: string
  probability: number
  description: string
  revenue_cagr: number
  year5_revenue: number
  year5_eps: number
  terminal_pe: number
  implied_price: number
}

export interface ForwardValuationCurrentData {
  price: number
  market_cap: number
  shares_outstanding: number
  ttm_revenue: number
  ttm_gaap_eps: number
}

export interface ForwardValuation {
  current_data: ForwardValuationCurrentData
  scenarios: ForwardValuationScenario[]
  weighted_fair_value: number
  vs_current_pct: number
}

export interface ResearchReport {
  id: string
  company_id: string
  company_name: string
  company_ticker: string
  version: number
  signal: SignalRating
  signal_confidence: number
  executive_summary: string
  business_model_analysis: string
  revenue_sources: string
  margin_analysis: string
  moat_assessment: string
  moat_rating: MoatRating
  ai_impact_analysis: string
  ai_vulnerability_score: number
  competitive_landscape: string
  valuation_assessment: string
  investment_recommendation: string
  management_strategy_response: string | null
  section_insights: Record<string, string> | null
  forward_valuation: ForwardValuation | null
  hypothesis_impacts: HypothesisImpact[]
  citations: Citation[]
  sec_filings_used: string[]
  model_used: string
  generation_time_seconds: number | null
  input_tokens: number | null
  output_tokens: number | null
  price_history: PricePoint[] | null
  analyst_consensus: AnalystConsensus | null
  key_metrics: KeyMetrics | null
  created_at: string
  updated_at: string
}

export interface ReportListItem {
  id: string
  company_id: string
  company_name: string
  company_ticker: string
  version: number
  signal: SignalRating
  signal_confidence: number
  executive_summary: string
  moat_rating: MoatRating
  ai_vulnerability_score: number
  created_at: string
}

export interface QueueItem {
  id: string
  company_id: string
  company_name: string
  company_ticker: string
  status: QueueItemStatus
  priority: number
  started_at: string | null
  completed_at: string | null
  report_id: string | null
  error_message: string | null
  retry_count: number
  notes: string
  created_at: string
  updated_at: string
}

export interface DashboardStats {
  total_companies: number
  total_reports: number
  total_hypotheses: number
  strong_sell_count: number
  sell_count: number
  hold_count: number
  buy_count: number
  strong_buy_count: number
}

export interface LeaderboardEntry {
  id: string
  name: string
  ticker: string
  industry_name: string | null
  signal: SignalRating | null
  signal_confidence: number | null
  current_pe: number | null
  historical_pe_1yr: number | null
  market_cap: number | null
  latest_report_date: string | null
  hypothesis_names: string[]
}

export interface AppSettings {
  anthropic_api_key_set: boolean
  sec_edgar_user_agent: string
  queue_batch_size: number
  default_model: string
}

export interface QueueStatus {
  queued: number
  in_progress: number
  completed: number
  failed: number
  total: number
}

export interface TestResult {
  success: boolean
  message: string
}
