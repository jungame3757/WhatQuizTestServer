// 캐시 이름에 타임스탬프를 추가하여 항상 고유한 캐시명을 보장
const cacheName = "DefaultCompany-WhatQuizPlayer-1.0" + "-" + new Date().getTime();
// 캐싱할 콘텐츠 목록
const contentToCache = [
    "Build/WhatQuizShow.loader.js",
    "Build/WhatQuizShow.framework.js",
    "Build/WhatQuizShow.data",
    "Build/WhatQuizShow.wasm",
    "TemplateData/style.css"
];

// 이전 캐시를 제거하는 함수
// 이전 버전의 캐시를 모두 찾아 삭제함으로써 항상 최신 버전만 사용하도록 함
const clearOldCaches = async () => {
    const cacheList = await caches.keys();
    const oldCaches = cacheList.filter(cache =>
        cache.startsWith("DefaultCompany-WhatQuizPlayer") &&
    cache !== cacheName
);
    console.log('[Service Worker] 이전 캐시 제거 중:', oldCaches);
    return Promise.all(oldCaches.map(cache => caches.delete(cache)));
};

self.addEventListener('install', function (e) {
    console.log('[Service Worker] 설치 중');

    // skipWaiting을 사용하여 새 서비스 워커가 즉시 활성화되도록 함
    // 이를 통해 기존 서비스 워커의 대기 없이 새 서비스 워커가 즉시 제어권을 가져감
    self.skipWaiting();

    e.waitUntil((async function () {
        // 먼저 이전 캐시 삭제
        await clearOldCaches();

        // 새 캐시 생성 및 리소스 저장
        const cache = await caches.open(cacheName);
        console.log('[Service Worker] 모든 앱 셸과 콘텐츠 캐싱 중');
        await cache.addAll(contentToCache);
    })());
});

self.addEventListener('activate', function(e) {
    console.log('[Service Worker] 활성화 중');

    // clients.claim()을 사용하여 페이지에 대한 즉각적인 제어권 확보
    // 이를 통해 새로고침 없이도 새 서비스 워커가 즉시 작동함
    e.waitUntil(self.clients.claim());

    // 활성화 중에도 이전 캐시 다시 제거 (안전장치)
    e.waitUntil(clearOldCaches());
});

self.addEventListener('fetch', function (e) {
    // 요청 URL에 캐시 버스팅 매개변수 추가하는 함수
    // 매번 고유한 URL을 생성하여 브라우저가 캐시를 사용하지 않도록 함
    const bustCache = url => {
        const urlObj = new URL(url);
        urlObj.searchParams.set('cache-bust', Date.now().toString());
        return urlObj.toString();
    };

    e.respondWith((async function () {
        // 항상 네트워크를 먼저 시도하여 최신 콘텐츠 확보 (Network First 전략)
        try {
            console.log(`[Service Worker] 네트워크에서 가져오는 중: ${e.request.url}`);
            // 원본 요청의 모든 속성을 유지하면서 URL에 캐시 버스팅 매개변수 추가
            const networkRequest = new Request(bustCache(e.request.url), {
                method: e.request.method,
                headers: e.request.headers,
                mode: e.request.mode,
                credentials: e.request.credentials,
                redirect: e.request.redirect
            });

            // 'no-store' 옵션으로 브라우저 캐시 사용 안함
            const networkResponse = await fetch(networkRequest, {
                cache: 'no-store'
            });

            // 새 응답으로 캐시 업데이트 (다음 오프라인 사용을 위해)
            const cache = await caches.open(cacheName);
            cache.put(e.request, networkResponse.clone());

            return networkResponse;
        } catch (error) {
            // 네트워크 요청 실패 시 캐시로 폴백
            console.log(`[Service Worker] 네트워크 요청 실패, 캐시 사용 중: ${e.request.url}`);
            const cachedResponse = await caches.match(e.request);
            return cachedResponse || new Response('네트워크 오류가 발생했으며 캐시된 버전이 없습니다', {
                status: 408,
                headers: { 'Content-Type': 'text/plain' }
            });
        }
    })());
});
