export type Stage = 'ideas' | 'copy' | 'design' | 'scheduled' | 'analyzed'
export type Channel = 'linkedin' | 'instagram' | 'facebook' | 'x' | 'blog' | 'email' | 'newsletter'
export type Market = 'spain' | 'latam' | 'uk' | 'france' | 'italy' | 'portugal' | 'brasil'
export type ContentStatus = 'pending' | 'in_progress' | 'approved' | 'rejected'
export type UserRole = 'admin' | 'manager' | 'user'

export interface Profile {
  id:         string
  email:      string
  full_name:  string | null
  role:       UserRole
  active:     boolean
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      calendar_items: {
        Row: CalendarItem
        Insert: Omit<CalendarItem, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CalendarItem, 'id' | 'created_at'>>
      }
      content_items: {
        Row: ContentItem
        Insert: Omit<ContentItem, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ContentItem, 'id' | 'created_at'>>
      }
      content_assets: {
        Row: ContentAsset
        Insert: Omit<ContentAsset, 'id' | 'created_at'>
        Update: Partial<Omit<ContentAsset, 'id' | 'created_at'>>
      }
      ideas: {
        Row: Idea
        Insert: Omit<Idea, 'id' | 'created_at'>
        Update: Partial<Omit<Idea, 'id' | 'created_at'>>
      }
      analytics_snapshots: {
        Row: AnalyticsSnapshot
        Insert: Omit<AnalyticsSnapshot, 'id' | 'created_at'>
        Update: Partial<Omit<AnalyticsSnapshot, 'id' | 'created_at'>>
      }
      brand_context: {
        Row: BrandContext
        Insert: Omit<BrandContext, 'id' | 'updated_at'>
        Update: Partial<Omit<BrandContext, 'id'>>
      }
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
    }
  }
}

export interface CalendarItem {
  id: string
  date: string
  time: string | null
  channel: Channel
  format: string | null
  campaign: string | null
  topic: string
  message_key: string | null
  cta: string | null
  market: Market
  status: string
  created_at: string
  updated_at: string
}

// Eventos nativos del calendario (presenciales y digitales).
// Distintos de content_items (pipeline) — aquí van ferias, reuniones, eventos genéricos.
export interface CalendarEvent {
  id:          string
  title:       string
  description: string | null
  start_time:  string // ISO
  end_time:    string // ISO
  all_day:     boolean
  color:       string
  category:    string | null
  tags:        string[]
  event_type:  'presential' | 'digital' | null
  location:    string | null
  channel:     string | null
  market:      string | null
  created_by:  string | null
  created_at:  string
  updated_at:  string
}

// ─── Fase 1A: Playbooks, Packages, Alerts, Market Rules ──────────────────

export type PlaybookType =
  | 'webinar' | 'event_presential' | 'event_online' | 'release'
  | 'newsletter' | 'campaign' | 'alliance' | 'workshop'
  | 'lead_magnet' | 'reactivation' | 'podcast'

export type MarketScope = 'all' | Market

export interface Playbook {
  id:                    string
  name:                  string
  type:                  PlaybookType
  description:           string | null
  market_scope:          MarketScope
  default_channels:      Channel[]
  required_assets:       string[]
  required_copy_blocks:  string[]
  approval_required:     boolean
  active:                boolean
  created_by:            string | null
  created_at:            string
  updated_at:            string
}

export type PlaybookTaskType =
  | 'post' | 'email' | 'newsletter' | 'landing' | 'reminder'
  | 'follow_up' | 'blog' | 'video' | 'banner' | 'pdf'

export interface PlaybookStep {
  id:                    string
  playbook_id:           string
  step_order:            number
  relative_day_offset:   number   // días respecto a anchor_date
  channel:               Channel | null
  content_type:          string | null
  task_type:             PlaybookTaskType
  title_template:        string | null
  instructions:          string | null
  required:              boolean
  approval_gate:         boolean
  depends_on_step_id:    string | null
}

export type PackageStatus = 'draft' | 'active' | 'completed' | 'cancelled'

export interface CampaignPackage {
  id:           string
  title:        string
  package_type: PlaybookType
  market:       Market
  objective:    string | null
  anchor_date:  string | null
  start_date:   string | null
  end_date:     string | null
  playbook_id:  string | null
  status:       PackageStatus
  created_by:   string | null
  created_at:   string
  updated_at:   string
}

export type AlertLevel = 'info' | 'warning' | 'critical'

export type AlertType =
  | 'missing_copy' | 'missing_image' | 'missing_approval'
  | 'missing_cta' | 'missing_landing' | 'package_incomplete'
  | 'scheduled_no_material' | 'dependency_not_met'
  | 'market_inconsistency'

export interface Alert {
  id:                       string
  level:                    AlertLevel
  type:                     AlertType
  title:                    string
  description:              string | null
  related_content_item_id:  string | null
  related_package_id:       string | null
  due_at:                   string | null
  resolved:                 boolean
  resolved_by:              string | null
  resolved_at:              string | null
  created_at:               string
}

export interface MarketRules {
  id:                 string
  market:             Market
  keyword_rules:      {
    primary?:   string[]
    secondary?: string[]
    forbidden?: string[]
  }
  terminology_rules:  {
    prefer?: Record<string, string>  // ej. {"control de plagas": "sanidad ambiental"}
  }
  no_say_rules:       string[]
  cta_rules:          {
    default?: string
    [channel: string]: string | undefined
  }
  notes:              string | null
  updated_by:         string | null
  created_at:         string
  updated_at:         string
}

// ─── Sistema de Sugerencias / Mejoras ────────────────────────────────────

export type ImprovementType     = 'bug' | 'mejora' | 'idea'
export type ImprovementPriority = 'baja' | 'media' | 'alta'
export type ImprovementStatus   = 'pendiente' | 'revisada' | 'completada' | 'descartada'

export interface Improvement {
  id:                string
  title:             string
  description:       string
  attachment_url:    string
  type:              ImprovementType
  priority:          ImprovementPriority
  status:            ImprovementStatus
  created_by:        string | null
  created_by_email:  string | null
  created_by_name:   string | null
  created_at:        string
  updated_at:        string
}

// ─── Fase 3: SEO Intelligence ────────────────────────────────────────────

export type SeoIntent = 'informational' | 'commercial' | 'transactional' | 'navigational'
export type SeoLevel  = 'high' | 'medium' | 'low'
export type SeoBriefStatus = 'draft' | 'approved' | 'converted' | 'archived'

export interface SeoResearchSession {
  id:         string
  topic:      string
  market:     Market
  channel:    Channel | null
  notes:      string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SeoKeyword {
  id:                  string
  research_session_id: string
  keyword:             string
  intent:              SeoIntent | null
  estimated_volume:    SeoLevel | null
  difficulty:          SeoLevel | null
  suggested_format:    string | null
  notes:               string | null
  created_at:          string
}

export interface SeoBrief {
  id:                       string
  title:                    string
  primary_keyword:          string
  secondary_keywords:       string[]
  market:                   Market
  channel:                  Channel | null
  intent:                   SeoIntent | null
  target_length:            number | null
  suggested_h2:             string[]
  cta:                      string | null
  content_outline:          string | null
  research_session_id:      string | null
  related_content_item_id:  string | null
  status:                   SeoBriefStatus
  created_by:               string | null
  created_at:               string
  updated_at:               string
}

// ─────────────────────────────────────────────────────────────────────────

export interface ContentItem {
  id: string
  calendar_item_id: string | null
  stage: Stage
  title: string
  channel: Channel
  market: Market
  campaign: string | null
  content: string | null
  description: string | null
  status: ContentStatus
  ai_generated: boolean
  clarity_pass: boolean | null
  clarity_summary: string | null
  human_approved: boolean
  approved_by: string | null
  approved_at: string | null
  scheduled_at: string | null
  published_at: string | null
  // Fase 1A:
  package_id: string | null
  playbook_step_id: string | null
  // ──────────
  postiz_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ContentAsset {
  id: string
  content_item_id: string | null
  storage_path: string
  asset_type: string
  prompt: string | null
  approved: boolean
  created_at: string
  carousel_id: string | null
  position: number | null
  channel: Channel | 'uncategorized' | null
  folder_id: string | null
  // Migración 011 (consolidación de schema drift):
  created_by: string | null
  aspect_ratio: string | null
  width: number | null
  height: number | null
  mime_type: string | null
}

export interface ImageFolder {
  id:         string
  name:       string
  channel:    Channel | null
  system:     boolean
  color:      string | null
  icon:       string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Idea {
  id: string
  title: string
  description: string | null
  channel: Channel | null
  market: Market
  source: 'human' | 'ai'
  status: 'pending' | 'accepted' | 'rejected' | 'converted'
  created_by: string | null
  created_at: string
}

export interface AnalyticsSnapshot {
  id: string
  content_item_id: string
  snapshot_date: string
  likes: number
  comments: number
  shares: number
  reach: number
  impressions: number
  clicks: number
  raw_data: Record<string, unknown> | null
  ai_evaluation: string | null
  created_at: string
}

export type BrandMarket = Market | 'all'

export interface BrandContext {
  id:         string
  key:        string
  content:    string
  market:     BrandMarket
  created_by: string | null
  created_at: string
  updated_at: string
}

// Definición estructurada de qué assets necesita un content_type.
// Las dimensiones son SUGERIDAS (no se valida obligatoriedad en BD).
// Se inyectan en el prompt de Gemini para que sepa qué piezas describir,
// y se muestran como checklist en el ImageDrivePanel del pipeline.
export interface ContentTypeFormatSpec {
  needs_copy?:   boolean
  needs_script?: boolean
  images?: Array<{
    label:    string         // ej. "Banner principal", "Thumbnail"
    width?:   number | null
    height?:  number | null
    required?: boolean        // sugerida obligatoria sí/no
    notes?:   string | null
  }>
  carousel?: {
    min:     number          // mínimo de slides
    max:     number          // máximo de slides
    width?:  number | null
    height?: number | null
  } | null
}

export interface ContentType {
  id:           string
  name:         string
  channel:      Channel
  description:  string
  process:      string
  style:        string
  active:       boolean
  format_spec:  ContentTypeFormatSpec
  created_by:   string | null
  created_at:   string
  updated_at:   string
}
