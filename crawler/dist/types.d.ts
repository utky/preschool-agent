export interface LetterPost {
    id: number;
    date: string;
    modified: string;
    title: {
        rendered: string;
    };
    _links: {
        'wp:attachment': [{
            href: string;
        }];
    };
}
export interface MediaFile {
    id: number;
    date: string;
    title: {
        rendered: string;
    };
    mime_type: string;
    source_url: string;
    post: number;
}
export interface CrawlerConfig {
    wordpressBaseUrl: string;
    gcsBucketName: string;
    gcsProjectId: string;
    sinceDateTime: string;
}
export interface UploadResult {
    mediaId: number;
    gcsPath: string;
    skipped: boolean;
}
//# sourceMappingURL=types.d.ts.map