// WordPress REST APIのレスポンス型定義

export interface LetterPost {
  id: number;
  date: string;        // ISO 8601 UTC
  modified: string;
  title: { rendered: string };
  _links: { 'wp:attachment': [{ href: string }] };
}

export interface MediaFile {
  id: number;
  date: string;
  modified: string;    // 最終更新日時（訂正版選択に使用）
  title: { rendered: string };
  mime_type: string;
  source_url: string;  // 完全URL: https://tatibana.ed.jp/.../file.pdf
  post: number;
}

export interface CrawlerConfig {
  wordpressBaseUrl: string;  // https://tatibana.ed.jp/youtien
  gcsBucketName: string;     // school-agent-prod-pdf-uploads
  gcsProjectId: string;
  sinceDateTime: string;     // ISO 8601 UTC (Cloud Workflowsから受け取る)
}

export interface UploadResult {
  mediaId: number;
  gcsPath: string;
  skipped: boolean;
}
