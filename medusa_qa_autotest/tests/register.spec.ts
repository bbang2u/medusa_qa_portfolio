// tests/register.spec.ts
import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:8000/dk';

/** 매 실행 충돌 방지용 유니크 이메일 */
function uniqueEmail(): string {
  return `test+${Date.now()}@example.com`;
}

/** 회원가입 폼에 값을 채우고 Join을 누른다. */
async function fillRegister(
  page: Page,
  { first, last, email, password }: { first: string; last: string; email: string; password: string }
) {
  await page.goto(`${BASE}/account`);
  await page.getByTestId('register-button').click();

  await page.getByTestId('first-name-input').fill(first);
  await page.getByTestId('last-name-input').fill(last);
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);

  await page.getByTestId('register-button').last().click();
}

test('정상 입력 시 회원가입에 성공한다 (baseline)', async ({ page }) => {
  await fillRegister(page, {
    first: 'Test',
    last: 'User',
    email: uniqueEmail(),
    password: 'ValidPass123',
  });
  await page.waitForLoadState('networkidle');
  // 성공 시: /account 페이지로 이동하고 회원가입 폼(MEDUSA 문구)이 완전히 사라져야 함
  await expect(page).toHaveURL(/\/account/, { timeout: 10000 });
  await expect(
    page.getByText(/BECOME A MEDUSA/i) // 'Store' 유무, 대소문자 상관없이 'BECOME A MEDUSA'만 포함되면 매칭
  ).not.toBeVisible();
});

test('1글자 비밀번호는 거부되어야 한다 (DEF-03)', async ({ page }) => {
  await fillRegister(page, {
    first: 'Test',
    last: 'User',
    email: uniqueEmail(),
    password: 'a', // 정책상 거부되어야 함
  });

  // 👍 핵심: 가입 버튼 클릭 후 발생하는 네트워크 요청이 완전히 끝날 때까지 대기합니다.
  // 의미 없는 타이머 대신, 서버 응답이 올 때까지만 최소한으로 기다리는 스마트한 방법입니다.
  await page.waitForLoadState('networkidle');

  // 검증: 시스템이 가입을 잘 막았다면 폼이 남아있어야(toBeVisible) 하고, 
  // 결함(DEF-03) 때문에 대시보드로 넘어가버렸다면 폼이 사라졌으므로 여기서 확실하게 FAILED가 뜹니다!
  await expect(
    page.getByText(/BECOME A MEDUSA/i)
  ).toBeVisible();
});

test('잘못된 이메일 형식은 거부되어야 한다', async ({ page }) => {
  await fillRegister(page, {
    first: 'Test',
    last: 'User',
    email: 'notanemail',
    password: 'ValidPass123',
  });

  await page.waitForLoadState('networkidle');

  // 정상적으로 가입이 거부되어 폼이 남아있어야 함 (정상 작동 시 PASS)
  await expect(
    page.getByText(/BECOME A MEDUSA/i)
  ).toBeVisible();
});

test('이메일 누락 시 거부되어야 한다 (필수값)', async ({ page }) => {
  await fillRegister(page, {
    first: 'Test',
    last: 'User',
    email: '',
    password: 'ValidPass123',
  });

  await page.waitForLoadState('networkidle');

  // 정상적으로 가입이 거부되어 폼이 남아있어야 함 (정상 작동 시 PASS)
  await expect(
    page.getByText(/BECOME A MEDUSA/i)
  ).toBeVisible();
});