-- Step 1: gemini-2.5-flash-lite のリモートモデルを登録
-- データテーブルへの書き込みなし（モデル定義の登録のみ）
CREATE MODEL IF NOT EXISTS `lofilab.school_agent.gemini_flash_lite_model`
  REMOTE WITH CONNECTION `lofilab.asia-northeast1.school-agent-vertex-connection`
  OPTIONS (ENDPOINT = 'gemini-2.5-flash-lite');
