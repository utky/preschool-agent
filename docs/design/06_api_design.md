## 6. APIエンドポイント設計 (Next.js API Routes)

- `POST /api/chat`: 自然言語での問い合わせに応答するRAGエージェントのエンドポイント。
- `GET /api/calendar/events`: カレンダー登録候補のリストを取得する。
- `POST /api/calendar/events/{event_id}/approve`: 指定されたイベント候補を承認し、Google Calendarに登録する。
- `GET /api/photos`: 抽出された写真の署名付きURLリストを返す。
    - **Query Parameters**:
        - `document_id: Optional[str]`: 掲載ドキュメントID
        - `start_date: Optional[date]`: 掲載日の範囲指定 (開始)
        - `end_date: Optional[date]`: 掲載日の範囲指定 (終了)
        - `offset: int = 0`: ページネーションのオフセット
        - `limit: int = 20`: 1ページあたりの取得件数
- `GET /api/auth/[...nextauth]`: Auth.jsによる認証処理（サインイン、コールバック、セッション管理など）。
