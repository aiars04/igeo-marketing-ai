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

export interface ContentItem {
  id: string
  calendar_item_id: string | null
  stage: Stage
  title: string
  channel: Channel
  market: Market
  campaign: string | null
  content: string | null
  status: ContentStatus
  ai_generated: boolean
  clarity_pass: boolean | null
  clarity_summary: string | null
  human_approved: boolean
  approved_by: string | null
  approved_at: string | null
  scheduled_at: string | null
  published_at: string | null
  postiz_id: string | null
  created_at: string
  updated_at: string
}

export interface ContentAsset {
  id: string
  content_item_id: string
  storage_path: string
  asset_type: string
  prompt: string | null
  approved: boolean
  created_at: string
}

export interface Idea {
  id: string
  title: string
  description: string | null
  channel: Channel | null
  market: Market
  source: 'human' | 'ai'
  status: 'pending' | 'accepted' | 'rejected' | 'converted'
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

export interface BrandContext {
  id: string
  key: string
  content: string
  market: Market
  updated_at: string
}
