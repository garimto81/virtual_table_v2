// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('간단한 브라우저 자동화', () => {

  test('기본 페이지 접속 및 스크린샷', async ({ page }) => {
    await page.goto('https://example.com');

    // 페이지 제목 확인
    await expect(page).toHaveTitle('Example Domain');

    // 헤딩 텍스트 확인
    await expect(page.locator('h1')).toContainText('Example Domain');

    // 스크린샷 저장
    await page.screenshot({ path: 'example-basic.png' });

    console.log('✅ 기본 페이지 테스트 완료');
  });

  test('브라우저 정보 및 뷰포트 테스트', async ({ page, browserName }) => {
    await page.goto('https://httpbin.org/user-agent');

    // 브라우저 정보 확인
    console.log(`현재 브라우저: ${browserName}`);

    // 페이지 내용에서 User-Agent 정보 추출
    const userAgent = await page.locator('pre').textContent();
    console.log('User-Agent:', userAgent);

    // 현재 뷰포트 크기 확인
    const viewport = page.viewportSize();
    console.log(`뷰포트 크기: ${viewport.width}x${viewport.height}`);

    await page.screenshot({ path: 'browser-info.png' });
  });

  test('간단한 인터랙션 테스트', async ({ page }) => {
    await page.goto('https://httpbin.org/');

    // 페이지 제목 확인
    await expect(page).toHaveTitle(/httpbin/);

    // 페이지에서 특정 텍스트 찾기
    await expect(page.locator('body')).toContainText('HTTP Request');

    // 스크롤 테스트
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    await page.screenshot({ path: 'httpbin-scrolled.png', fullPage: true });

    console.log('✅ 인터랙션 테스트 완료');
  });

  test('모바일 뷰포트 시뮬레이션', async ({ page }) => {
    // 모바일 뷰포트로 설정
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12 Pro 크기

    await page.goto('https://example.com');

    // 뷰포트 설정 확인
    const viewport = page.viewportSize();
    expect(viewport.width).toBe(390);
    expect(viewport.height).toBe(844);

    await page.screenshot({ path: 'mobile-simulation.png' });

    console.log('✅ 모바일 뷰포트 테스트 완료');
  });

  test('페이지 로딩 성능 측정', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('https://example.com');

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    console.log(`페이지 로딩 시간: ${loadTime}ms`);

    // 성능 메트릭 수집
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        totalTime: navigation.loadEventEnd - navigation.fetchStart
      };
    });

    console.log('성능 메트릭:', metrics);

    // 로딩 시간이 합리적인 범위인지 확인 (5초 이내)
    expect(loadTime).toBeLessThan(5000);

    await page.screenshot({ path: 'performance-test.png' });
  });

  test('JavaScript 실행 테스트', async ({ page }) => {
    await page.goto('https://example.com');

    // JavaScript로 페이지 조작
    await page.evaluate(() => {
      // 새로운 요소 추가
      const newElement = document.createElement('div');
      newElement.id = 'playwright-test';
      newElement.textContent = 'Playwright로 추가된 요소입니다!';
      newElement.style.backgroundColor = 'yellow';
      newElement.style.padding = '10px';
      newElement.style.margin = '10px';
      document.body.appendChild(newElement);

      // 페이지 배경색 변경
      document.body.style.backgroundColor = '#f0f0f0';
    });

    // 추가된 요소 확인
    await expect(page.locator('#playwright-test')).toBeVisible();
    await expect(page.locator('#playwright-test')).toContainText('Playwright로 추가된 요소입니다!');

    await page.screenshot({ path: 'javascript-manipulation.png' });

    console.log('✅ JavaScript 실행 테스트 완료');
  });

});