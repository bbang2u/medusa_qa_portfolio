// tests/browse-sort.spec.ts
// TC-BROWSE-01: 상점 페이지 가격 정렬 정확성 검증
import { test, expect, Page } from '@playwright/test';

const STORE_URL = 'http://localhost:8000/dk/store';

/**
 * 화면의 모든 가격을 읽어 숫자 배열로 변환하는 헬퍼.
 * data-testid="price" 요소들의 텍스트(€10.00)에서 숫자만 추출.
 */
async function getPrices(page: Page): Promise<number[]> {
  // 가격 요소가 최소 1개 나타날 때까지 대기 (로딩 안정성)
  await page.locator('[data-testid="price"]').first().waitFor();

  // 모든 가격 텍스트를 배열로 수집
  const priceTexts = await page.locator('[data-testid="price"]').allTextContents();

  // "€10.00" → 10.00 : 숫자·소수점 외 문자 제거 후 float 변환
  return priceTexts.map((t: string) => parseFloat(t.replace(/[^0-9.]/g, '')));
}

test('가격 오름차순 정렬이 정확히 적용된다', async ({ page }) => {
  await page.goto(`${STORE_URL}?sortBy=price_asc`);

  const prices = await getPrices(page);

  // 최소 2개는 있어야 정렬을 검증할 수 있음 (전제조건 확인)
  expect(prices.length).toBeGreaterThanOrEqual(2);

  // 핵심 단언: 읽어온 배열이, 같은 배열을 오름차순 정렬한 것과 동일한가
  const expectedAsc = [...prices].sort((a, b) => a - b);
  expect(prices).toEqual(expectedAsc);
});

test('가격 내림차순 정렬이 정확히 적용된다', async ({ page }) => {
  await page.goto(`${STORE_URL}?sortBy=price_desc`);

  const prices = await getPrices(page);
  expect(prices.length).toBeGreaterThanOrEqual(2);

  // 핵심 단언: 내림차순 정렬한 것과 동일한가
  const expectedDesc = [...prices].sort((a, b) => b - a);
  expect(prices).toEqual(expectedDesc);
});