// GCSアップロードロジック
/**
 * GCSにファイルが既に存在するか確認する
 */
export const isAlreadyUploaded = async (storage, bucketName, gcsPath) => {
    const [exists] = await storage.bucket(bucketName).file(gcsPath).exists();
    return exists;
};
/**
 * PDFをURLからダウンロードしてBufferで返す
 */
export const downloadPdf = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`PDF ダウンロード失敗: url=${url} status=${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
};
/**
 * GCSメタデータに設定する original-filename を生成する
 * source_url のパス末尾ファイル名をURLエンコードして返す（GASと同形式）
 */
export const buildOriginalFilename = (sourceUrl) => {
    const decoded = decodeURIComponent(sourceUrl.split('/').pop() ?? '');
    return encodeURIComponent(decoded);
};
/**
 * PDFをGCSにアップロードする
 * dbtが読み取るメタデータ（original-filename等）を付与する
 */
export const uploadToGcs = async (storage, bucketName, gcsPath, content, media) => {
    const file = storage.bucket(bucketName).file(gcsPath);
    const metadata = {
        contentType: 'application/pdf',
        metadata: {
            // dbtの stg_pdf_uploads__extracted_texts.sql が参照するフィールド
            'original-filename': buildOriginalFilename(media.source_url),
            'source-url': media.source_url,
            'letter-id': String(media.post),
            'media-id': String(media.id),
        },
    };
    await file.save(content, metadata);
};
//# sourceMappingURL=gcs.js.map