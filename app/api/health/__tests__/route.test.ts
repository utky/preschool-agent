import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/health', () => {
  it('should return a status of ok', async () => {
    // APIルートはリクエストオブジェクトを必要としない場合でも、
    // モックのリクエストを渡すのが一般的です。
    const req = new NextRequest('http://localhost/api/health');
    const response = await GET();

    // ステータスコードが200であることを確認
    expect(response.status).toBe(200);

    // レスポンスボディが正しいことを確認
    const body = await response.json();
    expect(body).toEqual({ status: 'ok' });
  });
});
