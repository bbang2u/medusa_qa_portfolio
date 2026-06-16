// tests/session.spec.ts
import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:8000/dk';

/** 매 실행 충돌 방지용 유니크 이메일 */
function uniqueEmail(): string {
  return `test+${Date.now()}@example.com`;
}

/**
 * 즉석 고유 계정을 가입시키고, 자동 로그인된 Overview 대시보드까지 진입시키는 헬퍼.
 *
 * 설계 이유:
 * - 세션 테스트의 본질은 "로그인 후 세션 동작"이지 가입 자체가 아니다.
 *   가입은 외부 계정에 의존하지 않고 로그인 가능한 계정을 확보하는 수단으로만 쓴다.
 * - 매 테스트가 Date.now() 기반 고유 이메일로 자기 계정을 새로 만들어 테스트 격리를 보장한다.
 * - 비밀번호는 즉석 생성 계정용 고정값이라 민감정보가 아니다.
 * - register.spec.ts의 fillRegister와 동일한 절차(진입은 register-button,
 *   제출은 register-button.last())를 따른다.
 */
async function registerAndLogin(page: Page): Promise<{ email: string; password: string }> {
  const email = uniqueEmail();
  const password = 'ValidPass123'; // register.spec.ts의 정상 비번 정책과 동일

  await page.goto(`${BASE}/account`);
  await page.getByTestId('register-button').click(); // "Join us" → 가입 폼 진입

  await page.getByTestId('first-name-input').fill('Test');
  await page.getByTestId('last-name-input').fill('User');
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);

  await page.getByTestId('register-button').last().click(); // 제출

  // ★ 가입 직후 자동 로그인이 비동기로 완료된다.
  //   네트워크 요청 완료를 기다린 뒤(레이스 방지),
  //   가입 폼 제목 소멸 + welcome-message 가시성으로 로그인 상태 진입을 확정한다.
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(/BECOME A MEDUSA/i)).not.toBeVisible();
  await expect(page.getByTestId('welcome-message')).toBeVisible();

  return { email, password };
}

test.describe('Session management', () => {
  /**
   * TC-SESSION-01: 로그인 세션의 페이지 이동 간 지속성
   * 로그인 후 홈·상품 페이지를 경유해 복귀해도 세션이 유지되는가.
   * 세션이 단일 화면에서만 유지되면 구매 플로우 중간에 끊겨 결제 불가.
   */
  test('TC-SESSION-01: 세션이 페이지 이동 간 유지된다', async ({ page }) => {
    const { email } = await registerAndLogin(page);

    // 다른 페이지 경유: 홈 → 상품 상세
    await page.goto(`${BASE}`);
    await page.goto(`${BASE}/products/t-shirt`);

    // /account 복귀
    await page.goto(`${BASE}/account`);
    await page.waitForLoadState('networkidle');

    // ★ 핵심 단언: 복귀 후에도 로그인 상태 유지
    await expect(page.getByTestId('welcome-message')).toBeVisible();
    // 가입에 쓴 이메일이 그대로 노출 → 동일 세션임을 확정
    await expect(page.getByTestId('customer-email')).toHaveText(email);
    // 로그인 폼은 보이지 않아야 함(비로그인으로 떨어지지 않음)
    await expect(page.getByTestId('sign-in-button')).toHaveCount(0);
  });

  /**
   * TC-SESSION-02: 로그아웃 시 세션의 실제 종료
   * "Log out" 클릭 후 로그인 폼으로 전환되고 welcome-message가 사라지는가.
   * UI만 바뀌고 세션이 살아있으면 공용 PC에서 계정 탈취로 직결.
   */
  test('TC-SESSION-02: 로그아웃이 세션을 실제로 종료한다', async ({ page }) => {
    await registerAndLogin(page);

    // 로그아웃 전: 로그인 상태 확인
    await expect(page.getByTestId('welcome-message')).toBeVisible();

    // ★ logout-button은 모바일 nav + 데스크탑 nav 2개 존재 → strict mode 회피 위해 .first()
    await page.getByTestId('logout-button').filter({ visible: true }).click();
    await page.waitForLoadState('networkidle');

    // 핵심 단언: 로그인 폼으로 전환
    await expect(page.getByTestId('email-input')).toBeVisible();
    await expect(page.getByTestId('password-input')).toBeVisible();
    await expect(page.getByTestId('sign-in-button')).toBeVisible();

    // welcome-message는 DOM에서 사라져야 함(세션 종료)
    await expect(page.getByTestId('welcome-message')).toHaveCount(0);
  });
});