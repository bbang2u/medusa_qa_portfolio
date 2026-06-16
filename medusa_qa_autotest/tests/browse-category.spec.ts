// tests/browse-category.spec.ts
// TC-BROWSE-02: 카테고리 필터의 상품 격리 검증
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8000/dk';

test('특정 카테고리 진입 시 해당 상품만 노출되고 미분류/타 카테고리 상품은 격리된다', async ({ page }) => {
  // 1) 'shirts' 카테고리 진입
  await page.goto(`${BASE}/categories/shirts`);
  await page.waitForLoadState('networkidle');

  // 상품 카드 제목을 모두 가져옴 (Medusa 기본 스타터 기준)
  const shirtTitles = await page.getByTestId('product-title').allTextContents();
  const lowerShirtTitles = shirtTitles.map(title => title.toLowerCase());

  // 검증: t-shirt는 포함되어야 하고, 타 카테고리나 미분류(ssss) 상품은 없어야 함
  expect(lowerShirtTitles.some(title => title.includes('t-shirt'))).toBeTruthy();
  expect(lowerShirtTitles.some(title => title.includes('sweatshirt'))).toBeFalsy();
  expect(lowerShirtTitles.some(title => title.includes('ssss'))).toBeFalsy();

  // 2) 교차 확인을 위해 'sweatshirts' 카테고리 진입
  await page.goto(`${BASE}/categories/sweatshirts`);
  await page.waitForLoadState('networkidle');

  const sweatTitles = await page.getByTestId('product-title').allTextContents();
  const lowerSweatTitles = sweatTitles.map(title => title.toLowerCase());

  // 검증: sweatshirt만 존재해야 하며, shirts 상품은 없어야 함
  expect(lowerSweatTitles.some(title => title.includes('sweatshirt'))).toBeTruthy();
  expect(lowerSweatTitles.some(title => title.includes('t-shirt'))).toBeFalsy();
});