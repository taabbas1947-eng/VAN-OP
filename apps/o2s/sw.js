/* O2S alerts: the part of O2S that receives an alert while O2S is closed (Tahir, 16 Oct 2026).
   It shows the alert and opens O2S when it is tapped. It keeps no copy of the app and answers no page requests,
   so O2S always loads fresh from the server and never runs an old build. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { t: 'O2S', b: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.t || 'O2S', {
    body: d.b || '', tag: d.tag || undefined, renotify: !!d.tag,
    icon: '/o2s/icons/icon-192.png', badge: '/o2s/icons/badge-96.png', data: { u: d.u || '/o2s' }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.u) || '/o2s';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { var c = list[i]; if (c.url.indexOf('/o2s') >= 0 && 'focus' in c) { try { c.postMessage({ o2s: 'today' }); } catch (x) {} return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
