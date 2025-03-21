const cacheName = "DefaultCompany-WhatQuizPlayer-1.0-" + Date.now();
const contentToCache = [
    "Build/WhatQuizShow.loader.js",
    "Build/WhatQuizShow.framework.js",
    "Build/WhatQuizShow.data",
    "Build/WhatQuizShow.wasm",
    "TemplateData/favicon.ico",
    "manifest.webmanifest"
];

// 기존 캐시 삭제 함수
async function deleteOldCaches() {
    const cacheNames = await caches.keys();
    const oldCacheNames = cacheNames.filter(name =>
        name.startsWith("DefaultCompany-WhatQuizPlayer") && name !== cacheName
    );

    console.log('[Service Worker] 이전 캐시 제거:', oldCacheNames);
    return Promise.all(oldCacheNames.map(name => caches.delete(name)));
}

self.addEventListener('install', function (e) {
    console.log('[Service Worker] 설치 중');

    // 즉시 활성화
    self.skipWaiting();

    e.waitUntil((async function () {
        try {
            // 이전 캐시 정리
            await deleteOldCaches();

            // 새 캐시 생성 및 리소스 저장
            const cache = await caches.open(cacheName);
            console.log('[Service Worker] 콘텐츠 캐싱 중');
            await cache.addAll(contentToCache);
            console.log('[Service Worker] 콘텐츠 캐싱 완료');
        } catch (error) {
            console.error('[Service Worker] 캐싱 중 오류 발생:', error);
        }
    })());
});

self.addEventListener('activate', function(e) {
    console.log('[Service Worker] 활성화 중');

    // 모든 클라이언트에 대한 제어권 즉시 확보
    e.waitUntil(clients.claim());

    // 이전 캐시 정리
    e.waitUntil(deleteOldCaches());
});

self.addEventListener('fetch', function (e) {
    // 네트워크 우선 전략: 항상 네트워크에서 먼저 가져오고 실패할 경우에만 캐시 사용
    e.respondWith((async function () {
        console.log(`[Service Worker] 리소스 요청: ${e.request.url}`);

        try {
            // 네트워크에서 리소스 가져오기 시도
            const response = await fetch(e.request, { cache: 'no-store' });

            // 성공하면 캐시 업데이트
            const cache = await caches.open(cacheName);
            console.log(`[Service Worker] 새 리소스 캐싱: ${e.request.url}`);
            cache.put(e.request, response.clone());

            return response;
        } catch (error) {
            // 네트워크 요청 실패 시 캐시에서 가져오기
            console.log(`[Service Worker] 네트워크 요청 실패, 캐시 사용: ${e.request.url}`);
            const cachedResponse = await caches.match(e.request);
            if (cachedResponse) {
                return cachedResponse;
            }

            // 캐시에도 없으면 오류 표시
            return new Response('네트워크 연결 실패 및 캐시 없음', {
                status: 408,
                headers: { 'Content-Type': 'text/plain' }
            });
        }
    })());
});