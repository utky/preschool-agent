## 6. APIエンドポイント設計 (Hono)

### 6.1. 認証エンドポイント

- `GET /api/auth/google`: Google OAuthフローを開始する（認証不要）
- `GET /api/auth/google/callback`: Google OAuthコールバック（認証不要）
- `POST /api/auth/logout`: ログアウト（セッション削除）
- `GET /api/auth/me`: 現在のユーザー情報を取得

### 6.2. ドキュメント管理

- `GET /api/documents`: 処理済みドキュメント一覧を取得
  - **Query Parameters**:
    - `type: Optional[string]`: 文書種別フィルタ（journal, photo_album等）
    - `start_date: Optional[date]`: 掲載日の範囲指定（開始）
    - `end_date: Optional[date]`: 掲載日の範囲指定（終了）
    - `offset: int = 0`: ページネーションのオフセット
    - `limit: int = 20`: 1ページあたりの取得件数

- `GET /api/documents/{document_id}`: 特定ドキュメントの詳細を取得

### 6.3. ベクトル検索（チャット統合済み）

`POST /api/search` は廃止。ベクトル検索機能は `POST /api/chat` のMastraエージェント（`vectorSearch`ツール）に統合済み。

### 6.4. カレンダー連携

- `GET /api/calendar/events`: カレンダー登録候補のリストを取得
  - **Query Parameters**:
    - `status: Optional[string]`: ステータスフィルタ（pending, synced）
    - `start_date: Optional[date]`: イベント日の範囲指定（開始）
    - `end_date: Optional[date]`: イベント日の範囲指定（終了）

- `POST /api/calendar/sync`: 指定されたイベント候補を承認し、Google Calendarに登録
  - **Request Body**:
    ```json
    {
      "event_id": "uuid"
    }
    ```
  - **Response**:
    ```json
    {
      "success": true,
      "calendar_event_id": "google_calendar_id"
    }
    ```

### 6.5. 写真ギャラリー（未実装 / スコープ外）

- `GET /api/photos`: 未実装。現在のスコープ外のため実装予定なし。

### 6.6. ドキュメントダウンロード

- `GET /api/documents/download`: 署名付きURLを生成してCloud Storage上のPDFをダウンロード
  - **Query Parameters**:
    - `uri: string`: ダウンロード対象のCloud Storage URI（必須）
  - **Response**: 一時署名付きURL（リダイレクト）

### 6.7. RAGエージェント（チャット）

- `POST /api/chat`: 自然言語での問い合わせに応答するRAGエージェントのエンドポイント
  - **Request Body**:
    ```json
    {
      "message": "string",
      "session_id": "optional_uuid"
    }
    ```
  - **Response**:
    ```json
    {
      "response": "string",
      "session_id": "uuid",
      "sources": [
        {
          "chunk_id": "uuid",
          "document_id": "uuid",
          "text": "string"
        }
      ],
      "actions": [
        {
          "type": "calendar_sync",
          "event_id": "uuid"
        }
      ]
    }
    ```

### 6.8. エラーレスポンス

全てのエンドポイントは、エラー時に以下の形式で応答します：

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

**エラーコード一覧:**
- `UNAUTHORIZED`: 認証が必要
- `FORBIDDEN`: アクセス権限なし
- `NOT_FOUND`: リソースが見つからない
- `VALIDATION_ERROR`: リクエストパラメータが不正
- `INTERNAL_ERROR`: サーバー内部エラー
