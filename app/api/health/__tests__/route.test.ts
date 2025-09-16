import { GET } from '@/app/api/health/route';
import { NextRequest } from 'next/server';

describe('GET /api/health', () => {
  it('should return status 200 with an "ok" message', async () => {
    // APIルートハンドラはNextRequestオブジェクトを受け取ります。
    // このテストでは単純なリクエストで十分です。
    const request = new NextRequest('http://localhost/api/health');

    // GETハンドラを実行します。
    const response = await GET(request);

    // レスポンスを検証します。
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: 'ok' });
  });
});
