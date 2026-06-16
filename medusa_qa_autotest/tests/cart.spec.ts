// tests/cart.spec.ts
// TC-CART-02: 장바구니 수량 변경 시 합계 재계산 정확성
import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:8000/dk';

/**
 * 상품 상세로 가서 장바구니에 담는다.
 * - variant(사이즈) 옵션이 있으면 첫 번째 옵션을 먼저 선택해야 담기 버튼이 활성화된다.
 * - 담기 버튼은 데스크탑/모바일 2개가 존재하므로 .first()로 데스크탑 버튼을 집는다.
 */
async function addProductToCart(page: Page, handle: string) {
  await page.goto(`${BASE}/products/${handle}`);

  const optionGroups = page.locator('[data-testid="product-options"]');
  const groupCount = await optionGroups.count();
  for (let i = 0; i < groupCount; i++) {
    await optionGroups.nth(i).locator('[data-testid="option-button"]').first().click();
  }

  const addBtn = page.locator('[data-testid="add-product-button"]').first();
  const btnText = await addBtn.textContent();
  if (btnText?.includes('Out of stock')) {
    throw new Error(`[${handle}] 선택한 조합이 재고 없음 — 다른 옵션 조합 필요.`);
  }

  await expect(addBtn).toBeEnabled();

  // ★ 추가된 로직: 클릭 전의 장바구니 텍스트를 미리 읽어둡니다.
  const cartBtn = page.getByRole('button', { name: /Cart \(\d+\)/ });
  const beforeCartText = await cartBtn.textContent();

  await addBtn.click();

  // ★ 변경된 로직: 장바구니 텍스트가 '클릭 전 상태'와 달라질 때까지 기다립니다.
  await expect(cartBtn).not.toHaveText(beforeCartText!);
}

test('수량을 변경하면 라인 합계와 소계가 정확히 재계산된다', async ({ page }) => {
  // 1) 테스트가 스스로 상품을 담는다 (세션 분리 대응)
  await addProductToCart(page, 't-shirt');   // 재고 넉넉한 상품

  // 2) 장바구니로 이동
  await page.goto(`${BASE}/cart`);
  const firstRow = page.locator('[data-testid="product-row"]').first();
  await expect(firstRow).toBeVisible();

  // 3) 첫 행의 단가를 읽는다
  const unitPriceText = await firstRow
    .locator('[data-testid="product-unit-price"]')
    .textContent();
  const unitPrice = parseFloat(unitPriceText!.replace(/[^0-9.]/g, ''));

  // 4) 수량을 3으로 변경
  const select = firstRow.locator('[data-testid="product-select-button"]');
  await select.selectOption('3');

  // 5) 라인 합계가 단가×3 으로 갱신될 때까지 상태 기다림
  const expectedLineTotal = (unitPrice * 3).toFixed(2);
  await expect(
    firstRow.locator('[data-testid="product-price"]')
  ).toContainText(expectedLineTotal);

  // 6) 검증: 라인 합계 = 단가 × 수량
  const lineTotalText = await firstRow
    .locator('[data-testid="product-price"]')
    .textContent();
  const lineTotal = parseFloat(lineTotalText!.replace(/[^0-9.]/g, ''));
  expect(lineTotal).toBeCloseTo(unitPrice * 3, 2);

  // 7) 검증: 소계 = 모든 라인 합계의 합
  const allLineTotals = await page
    .locator('[data-testid="product-price"]')
    .allTextContents();
  const sumOfLines = allLineTotals.reduce(
    (sum, t) => sum + parseFloat(t.replace(/[^0-9.]/g, '')),
    0
  );
  const subtotalValue = await page
    .locator('[data-testid="cart-subtotal"]')
    .getAttribute('data-value');
  expect(parseFloat(subtotalValue!)).toBeCloseTo(sumOfLines, 2);
});

// tests/cart.spec.ts (기존 파일 하단에 추가)

test('TC-CART-04: 서로 다른 상품 2종을 장바구니에 담으면 각각의 라인과 소계가 정확히 합산된다', async ({ page }) => {
  // 1) 빈 장바구니 상태에서 첫 번째 상품 담기 (t-shirt, 단가 €10)
  await addProductToCart(page, 't-shirt');

  // 2) 두 번째 상품 추가 담기 (sweatshirt, 단가 €10)
  await addProductToCart(page, 'sweatshirt');

  // 3) 장바구니 페이지로 이동
  await page.goto(`${BASE}/cart`);

  // 4) 장바구니에 서로 다른 상품 라인이 정확히 2개 생성되었는지 확인
  const productRows = page.locator('[data-testid="product-row"]');
  await expect(productRows).toHaveCount(2);

  // 5) 각 라인의 금액 수집 및 파싱
  const allLineTotalsText = await page
    .locator('[data-testid="product-price"]')
    .allTextContents();
  
  const lineValues = allLineTotalsText.map(t => 
    parseFloat(t.replace(/[^0-9.]/g, ''))
  );

  // 검증: 라인별 금액이 기대한 데이터(10.00)와 일치하는가
  // (상품 순서가 보장되지 않을 수 있으므로 포함 여부로 단언)
  expect(lineValues).toContain(10);
  expect(lineValues).toContain(10);

  // 6) 소계(Subtotal) 검증: 두 라인의 합(20.00)과 일치하는가
  const expectedSubtotal = lineValues.reduce((sum, val) => sum + val, 0);
  const subtotalValueText = await page
    .locator('[data-testid="cart-subtotal"]')
    .getAttribute('data-value');
  const subtotalValue = parseFloat(subtotalValueText!);

  expect(subtotalValue).toBeCloseTo(expectedSubtotal, 2);
  expect(subtotalValue).toBeCloseTo(20, 2); // 10 + 10 = 20 하드코딩 교차 검증
});