// tests/auth.spec.ts
// TC-AUTH-01: 로그인 실패 시 에러 메시지 일관성 (계정 열거 방지)
import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:8000/dk';
const EXPECTED_ERROR = 'Invalid email or password';

/**
 * 로그인 폼에 입력하고 Sign in을 눌러, 에러 메시지 텍스트를 돌려준다.
 */
async function attemptLogin(page: Page, email: string, password: string): Promise<string> {
  await page.goto(`${BASE}/account`);

  await page.locator('[data-testid="email-input"]').fill(email);
  await page.locator('[data-testid="password-input"]').fill(password);
  await page.locator('[data-testid="sign-in-button"]').click();

  // 에러 메시지가 나타날 때까지 상태 대기 후 텍스트 반환
  const errorMsg = page.locator('[data-testid="login-error-message"]');
  await expect(errorMsg).toBeVisible();
  return (await errorMsg.textContent())!.trim();
}

test('로그인 실패 시 원인과 무관하게 동일한 에러 메시지가 표시된다', async ({ page }) => {
  // 케이스 2: 가입된 이메일 + 틀린 비밀번호
  const msgWrongPassword = await attemptLogin(page, 'bbang3u@naver.com', 'wrongpass123');

  // 케이스 3: 없는 이메일 + 임의 비밀번호
  const msgNoAccount = await attemptLogin(page, 'nobody@test.com', 'wrongpass123');

  // 케이스 4: 없는 이메일 + 다른 임의 비밀번호
  const msgNoAccount2 = await attemptLogin(page, 'ghost@test.com', 'anotherpass456');

  // 검증 1: 세 경우 모두 기대 메시지를 포함
  expect(msgWrongPassword).toContain(EXPECTED_ERROR);
  expect(msgNoAccount).toContain(EXPECTED_ERROR);
  expect(msgNoAccount2).toContain(EXPECTED_ERROR);

  // 검증 2 (핵심): 세 메시지가 서로 완전히 동일
  //   — "없는 계정"과 "비번 틀림"이 메시지로 구분되지 않아야 계정 열거가 막힌다
  expect(msgNoAccount).toBe(msgWrongPassword);
  expect(msgNoAccount2).toBe(msgWrongPassword);
});