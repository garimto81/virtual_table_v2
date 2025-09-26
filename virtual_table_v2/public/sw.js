/**
 * Service Worker - Virtual Data Poker Manager v2.1.1
 */

const CACHE_NAME = 'vdc-v2.1.1-optimized';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/modules/DataService.js',
  '/js/modules/HandLogger.js',
  '/js/modules/ChipCalculator.js',
  '/js/modules/UIManager.js',
  '/manifest.json'
];

// 설치 이벤트
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// 활성화 이벤트
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch 이벤트
self.addEventListener('fetch', event => {
  // API 요청은 캐시하지 않고 네트워크로
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // 오프라인일 때 기본 응답
          return new Response(JSON.stringify({
            success: false,
            offline: true,
            message: 'Offline mode'
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // 정적 자원은 캐시 우선, 네트워크 폴백
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request).then(response => {
          // 유효한 응답이 아니면 그대로 반환
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // 🔧 스마트 캐싱: 확장프로그램 리소스 필터링
          const url = event.request.url;
          const isCacheable = url.startsWith('http://') || url.startsWith('https://');
          const isExtensionResource = url.startsWith('chrome-extension://') ||
                                     url.startsWith('moz-extension://') ||
                                     url.startsWith('webkit-extension://') ||
                                     url.startsWith('ms-browser-extension://');

          // 캐시 가능한 리소스만 캐시에 저장
          if (isCacheable && !isExtensionResource) {
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              })
              .catch(error => {
                console.warn('캐시 저장 실패 (무시됨):', error.message);
              });
          }

          return response;
        });
      })
      .catch(() => {
        // 오프라인 폴백 페이지
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
  );
});

// 백그라운드 동기화
self.addEventListener('sync', event => {
  if (event.tag === 'sync-hands') {
    event.waitUntil(syncHandData());
  }
});

// 푸시 알림
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Virtual Data Poker 알림',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('Virtual Data Poker', options)
  );
});

// 알림 클릭
self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});

// 오프라인 데이터 동기화
async function syncHandData() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const offlineData = await cache.match('/offline-data');

    if (offlineData) {
      const data = await offlineData.json();

      // 서버로 데이터 전송
      const response = await fetch('/api/hands/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        // 동기화 성공 시 오프라인 데이터 삭제
        await cache.delete('/offline-data');
        console.log('Offline data synced successfully');
      }
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}