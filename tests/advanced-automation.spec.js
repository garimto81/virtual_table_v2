// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('고급 브라우저 자동화 테스트', () => {

  test('Google 검색 자동화', async ({ page }) => {
    // Google 페이지로 이동
    await page.goto('https://www.google.com');

    // 검색창 찾기 (여러 방법 시도)
    const searchBox = page.locator('input[name="q"], input[title="Search"], textarea[name="q"]').first();
    await searchBox.waitFor({ state: 'visible' });

    // 검색어 입력
    await searchBox.fill('Playwright testing framework');

    // Enter 키 누르기
    await searchBox.press('Enter');

    // 검색 결과 페이지 로딩 대기
    await page.waitForLoadState('domcontentloaded');

    // 검색 결과 확인
    await expect(page.locator('h3')).toHaveCount({ min: 1 });

    // 스크린샷 저장
    await page.screenshot({ path: 'google-search-results.png', fullPage: true });
  });

  test('폼 입력 및 제출 테스트', async ({ page }) => {
    await page.goto('https://httpbin.org/forms/post');

    // 폼 필드 입력
    await page.locator('input[name="custname"]').fill('테스트 사용자');
    await page.locator('input[name="custtel"]').fill('010-1234-5678');
    await page.locator('input[name="custemail"]').fill('test@example.com');

    // 드롭다운 선택
    await page.locator('select[name="size"]').selectOption('large');

    // 라디오 버튼 선택
    await page.locator('input[name="topping"][value="bacon"]').check();

    // 체크박스 선택
    await page.locator('input[name="delivery"]').check();

    // 텍스트에리어 입력
    await page.locator('textarea[name="comments"]').fill('Playwright로 자동화된 테스트입니다.');

    // 폼 제출
    await page.locator('input[type="submit"]').click();

    // 결과 페이지 확인
    await expect(page.locator('pre')).toContainText('테스트 사용자');

    await page.screenshot({ path: 'form-submission-result.png' });
  });

  test('스크롤 및 무한 로딩 테스트', async ({ page }) => {
    await page.goto('https://quotes.toscrape.com/');

    let quoteCount = 0;

    // 처음 페이지의 인용구 수 계산
    quoteCount = await page.locator('.quote').count();
    console.log(`초기 인용구 수: ${quoteCount}`);

    // 페이지 하단으로 스크롤
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Next 버튼 클릭 (있는 경우)
    const nextButton = page.locator('li.next a');
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForLoadState('domcontentloaded');

      const newQuoteCount = await page.locator('.quote').count();
      console.log(`다음 페이지 인용구 수: ${newQuoteCount}`);

      expect(newQuoteCount).toBeGreaterThan(0);
    }

    await page.screenshot({ path: 'quotes-page.png', fullPage: true });
  });

  test('파일 다운로드 테스트', async ({ page }) => {
    await page.goto('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf');

    // 다운로드 시작 대기
    const downloadPromise = page.waitForEvent('download');

    // 다운로드 시작 (PDF 링크 클릭 또는 자동 다운로드)
    const download = await downloadPromise;

    // 다운로드된 파일 정보 확인
    console.log(`다운로드된 파일명: ${download.suggestedFilename()}`);

    // 파일을 특정 경로에 저장
    await download.saveAs('./downloads/' + download.suggestedFilename());

    expect(download.suggestedFilename()).toBe('dummy.pdf');
  });

  test('모바일 뷰포트 테스트', async ({ page, context }) => {
    // 모바일 뷰포트 설정
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('https://example.com');

    // 모바일 뷰에서 스크린샷
    await page.screenshot({ path: 'mobile-viewport.png' });

    // 뷰포트 크기 확인
    const viewport = page.viewportSize();
    expect(viewport.width).toBe(375);
    expect(viewport.height).toBe(667);
  });

  test('쿠키 및 로컬 스토리지 테스트', async ({ page, context }) => {
    await page.goto('https://httpbin.org/cookies/set/test-cookie/test-value');

    // 쿠키 확인
    const cookies = await context.cookies();
    const testCookie = cookies.find(cookie => cookie.name === 'test-cookie');
    expect(testCookie?.value).toBe('test-value');

    // 로컬 스토리지에 데이터 저장
    await page.evaluate(() => {
      localStorage.setItem('playwright-test', 'automation-data');
    });

    // 로컬 스토리지 데이터 확인
    const localStorageValue = await page.evaluate(() => {
      return localStorage.getItem('playwright-test');
    });

    expect(localStorageValue).toBe('automation-data');
  });

  test('네트워크 요청 가로채기', async ({ page }) => {
    // API 요청 가로채기 설정
    await page.route('**/api/**', route => {
      console.log(`API 호출 감지: ${route.request().url()}`);
      route.continue();
    });

    // 특정 리소스 차단
    await page.route('**/*.png', route => route.abort());

    await page.goto('https://jsonplaceholder.typicode.com/');

    // API 호출이 있는 페이지로 이동
    await page.locator('a[href="/posts"]').click();

    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: 'network-intercept-test.png' });
  });

});