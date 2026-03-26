import type { LetterPost, MediaFile } from './types.js';
/**
 * WordPress REST APIからletter投稿を全件取得する
 * ページネーションを自動処理する
 */
export declare const fetchLetters: (baseUrl: string, modifiedAfter: Date) => Promise<LetterPost[]>;
/**
 * 指定したletter投稿に紐づくPDF添付ファイルを取得する
 */
export declare const fetchAttachments: (baseUrl: string, letterId: number) => Promise<MediaFile[]>;
/**
 * GCSパスを生成する純粋関数
 * web/{YYYY}/{MM}/{media_id}_{sanitized_title}.pdf
 */
export declare const buildGcsPath: (media: MediaFile) => string;
/**
 * ファイル名をサニタイズする純粋関数
 * 日本語はそのまま保持し、ファイルシステムで不正な文字のみ除去する
 */
export declare const sanitizeFilename: (title: string) => string;
//# sourceMappingURL=wordpress.d.ts.map