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

  // 옵션 그룹(Color, Size 등) 각각에서 첫 번째 값을 선택
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
  await addBtn.click();

  // ★ 담기 요청이 끝나 카트 카운트가 올라갈 때까지 기다린다.
  //   (이걸 안 하면 담기 완료 전에 페이지를 떠나 빈 카트가 된다)
  await expect(page.getByRole('button', { name: /Cart \(\d+\)/ }))
    .not.toHaveText(/Cart \(0\)/);
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