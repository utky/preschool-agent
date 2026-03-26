import { Storage } from '@google-cloud/storage';
import type { MediaFile } from './types.js';
/**
 * GCSにファイルが既に存在するか確認する
 */
export declare const isAlreadyUploaded: (storage: Storage, bucketName: string, gcsPath: string) => Promise<boolean>;
/**
 * PDFをURLからダウンロードしてBufferで返す
 */
export declare const downloadPdf: (url: string) => Promise<Buffer>;
/**
 * GCSメタデータに設定する original-filename を生成する
 * source_url のパス末尾ファイル名をURLエンコードして返す（GASと同形式）
 */
export declare const buildOriginalFilename: (sourceUrl: string) => string;
/**
 * PDFをGCSにアップロードする
 * dbtが読み取るメタデータ（original-filename等）を付与する
 */
export declare const uploadToGcs: (storage: Storage, bucketName: string, gcsPath: string, content: Buffer, media: MediaFile) => Promise<void>;
//# sourceMappingURL=gcs.d.ts.map