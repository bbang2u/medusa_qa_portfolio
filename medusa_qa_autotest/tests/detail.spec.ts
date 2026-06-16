// tests/detail.spec.ts
import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:8000/dk';

/**
 * 상품 상세 페이지에서 옵션 그룹별로 첫 번째 옵션을 선택한다.
 * (cart.spec.ts의 옵션 선택 패턴과 동일: product-options 그룹마다 option-button.first())
 */
async function selectAllOptions(page: Page) {
  const groups = page.getByTestId('product-options');
  const count = await groups.count();
  for (let i = 0; i < count; i++) {
    await groups.nth(i).getByTestId('option-button').first().click();
  }
}

test.describe('Product detail', () => {
  /**
   * TC-DETAIL-01: 다중 옵션 상품의 미선택 상태 표시 (DEF-04 박제)
   *
   * 검증: 옵션 미선택 시 구매 버튼이 미선택 상태를 안내해야 하며,
   *       실제 재고 있는 상품을 "Out of stock"으로 표시하면 안 된다.
   * 현재: 결함(DEF-04)으로 미선택 시 "Out of stock" 표시.
   *       이 테스트는 올바른 동작을 단언하므로 의도적으로 FAIL하여 결함을 박제한다.
   *       (DEF-03 자동화와 동일한 "결함 박제" 패턴)
   */
  test('TC-DETAIL-01: 옵션 미선택 시 품절로 오표시되면 안 된다 (DEF-04)', async ({ page }) => {
    await page.goto(`${BASE}/products/t-shirt`);
    await page.waitForLoadState('networkidle');

    const addButton = page.getByTestId('add-product-button').first();

    // ★ 올바른 동작이라면: 미선택 상태에서 버튼이 "Out of stock"이 아니어야 한다.
    //   현재는 DEF-04 때문에 "Out of stock"이 떠서 이 단언이 FAIL → 결함 박제.
    await expect(addButton).not.toHaveText(/out of stock/i);
  });

/**
   * TC-DETAIL-02: 목록과 상세의 가격 일관성
   *
   * 검증: /dk/store 목록 가격 == 상세 페이지 가격 (숫자값).
   * 주의: 같은 "가격"이라도 testid가 문맥마다 다름.
   *       - 목록 카드: data-testid="price" (data-value 없음, 텍스트만)
   *       - 상세:      data-testid="product-price" (data-value 있음)
   *       그래서 양쪽 모두 "보이는 텍스트"에서 숫자를 파싱해 비교한다.
   *       (= 쇼퍼가 실제로 보는 가격이 두 화면에서 같은가)
   */
  test('TC-DETAIL-02: 목록과 상세의 가격 숫자값이 일치한다', async ({ page }) => {
    const parsePrice = (text: string | null): number =>
      parseFloat((text ?? '').replace(/[^0-9.]/g, '')); // "€10.00" → 10, "From €10.00" → 10

    // 1) 목록에서 t-shirt 카드의 가격 (testid="price")
    await page.goto(`${BASE}/store`);
    await page.waitForLoadState('networkidle');

    const listCard = page
      .getByTestId('product-wrapper')
      .filter({ hasText: 'Medusa T-Shirt' });
    const listPrice = parsePrice(await listCard.getByTestId('price').textContent());

    // 2) 상세에서 옵션 선택 후 가격 (testid="product-price")
    await page.goto(`${BASE}/products/t-shirt`);
    await page.waitForLoadState('networkidle');
    await selectAllOptions(page);
    await page.waitForLoadState('networkidle');

    const detailPrice = parsePrice(await page.getByTestId('product-price').textContent());

    // ★ 핵심 단언: 목록 가격 == 상세 가격 (숫자)
    expect(listPrice).toBeGreaterThan(0); // 파싱 실패(NaN/0) 가드
    expect(listPrice).toBe(detailPrice);  // 10 === 10
  });
});