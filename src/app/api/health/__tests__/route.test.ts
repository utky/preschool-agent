/**
 * @jest-environment node
 */
import { GET } from '../route';

describe('Health Check API', () => {
  it('should return status "ok"', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: 'ok' });
  });
});
