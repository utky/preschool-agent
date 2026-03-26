// Cloud Run Jobエントリーポイント
import { Storage } from '@google-cloud/storage';
import { loadConfig } from './config.js';
import { fetchLetters, fetchAttachments, buildGcsPath } from './wordpress.js';
import { isAlreadyUploaded, downloadPdf, uploadToGcs, } from './gcs.js';
const run = async () => {
    const config = loadConfig();
    const storage = new Storage({ projectId: config.gcsProjectId });
    console.log(`クローラー開始: sinceDateTime=${config.sinceDateTime}`);
    const sinceDate = new Date(config.sinceDateTime);
    const letters = await fetchLetters(config.wordpressBaseUrl, sinceDate);
    console.log(`letter投稿数: ${letters.length}`);
    const results = [];
    for (const letter of letters) {
        const attachments = await fetchAttachments(config.wordpressBaseUrl, letter.id);
        for (const media of attachments) {
            const gcsPath = buildGcsPath(media);
            // 既にアップロード済みならスキップ（冪等性保証）
            const alreadyUploaded = await isAlreadyUploaded(storage, config.gcsBucketName, gcsPath);
            if (alreadyUploaded) {
                console.log(`スキップ（既存）: ${gcsPath}`);
                results.push({ mediaId: media.id, gcsPath, skipped: true });
                continue;
            }
            const pdfBuffer = await downloadPdf(media.source_url);
            await uploadToGcs(storage, config.gcsBucketName, gcsPath, pdfBuffer, media);
            console.log(`アップロード完了: ${gcsPath}`);
            results.push({ mediaId: media.id, gcsPath, skipped: false });
        }
    }
    const uploaded = results.filter((r) => !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;
    console.log(`クローラー完了: アップロード=${uploaded} スキップ=${skipped} 合計=${results.length}`);
};
run().catch((err) => {
    console.error('クローラーエラー:', err);
    process.exit(1);
});
//# sourceMappingURL=main.js.map