react-dom_client.js?v=8b2110a3:20103 Download the React DevTools for a better development experience: https://react.dev/link/react-devtools
client.ts:18 🌐 API Base URL: http://129.159.8.19:3000/api
client.ts:19 🌐 Server Base URL: http://129.159.8.19:3000
useWebSocket.ts:5 🚀 useWebSocket.ts LOADED - VERSION 3.0 (Post-Connection Auth) - 2026-02-08T20:00:35.212Z
notificationService.ts:46 Failed to check notification permission: TypeError: Cannot read properties of undefined (reading 'invoke')
    at invoke (chunk-3GOR44ID.js?v=8b2110a3:101:37)
    at isPermissionGranted (@tauri-apps_plugin-notification.js?v=8b2110a3:60:16)
    at NotificationService.checkPermission (notificationService.ts:36:30)
    at new NotificationService (notificationService.ts:28:10)
    at notificationService.ts:188:36
checkPermission @ notificationService.ts:46
await in checkPermission
NotificationService @ notificationService.ts:28
(anonymous) @ notificationService.ts:188
useWebSocket.ts:158 [WebSocket] Connection disabled or no userId
useAutoUpdater.ts:42 ⏭️ Skipping update check (not in Tauri environment)
client.ts:76 🚀🚀🚀 MAKING FETCH REQUEST 🚀🚀🚀
client.ts:77 🌐 URL: http://129.159.8.19:3000/api/auth/me
client.ts:78 🔧 Method: GET
client.ts:79 📦 Body: undefined
client.ts:80 📋 Headers: undefined
client.ts:81 🍪 Credentials: include
client.ts:82 🌍 Current Origin: http://localhost:1420
client.ts:83 🎯 Target Origin: http://129.159.8.19:3000
client.ts:84 🔀 Cross-Origin? true
useWebSocket.ts:158 [WebSocket] Connection disabled or no userId
useAutoUpdater.ts:42 ⏭️ Skipping update check (not in Tauri environment)
client.ts:76 🚀🚀🚀 MAKING FETCH REQUEST 🚀🚀🚀
client.ts:77 🌐 URL: http://129.159.8.19:3000/api/auth/me
client.ts:78 🔧 Method: GET
client.ts:79 📦 Body: undefined
client.ts:80 📋 Headers: undefined
client.ts:81 🍪 Credentials: include
client.ts:82 🌍 Current Origin: http://localhost:1420
client.ts:83 🎯 Target Origin: http://129.159.8.19:3000
client.ts:84 🔀 Cross-Origin? true
tauriHttpClient.ts:56  GET http://129.159.8.19:3000/api/auth/me 500 (Internal Server Error)
universalFetch @ tauriHttpClient.ts:56
request @ client.ts:99
get @ client.ts:189
checkSession @ authStore.ts:145
(anonymous) @ App.tsx:68
react_stack_bottom_frame @ react-dom_client.js?v=8b2110a3:18567
runWithFiberInDEV @ react-dom_client.js?v=8b2110a3:997
commitHookEffectListMount @ react-dom_client.js?v=8b2110a3:9411
commitHookPassiveMountEffects @ react-dom_client.js?v=8b2110a3:9465
commitPassiveMountOnFiber @ react-dom_client.js?v=8b2110a3:11040
recursivelyTraversePassiveMountEffects @ react-dom_client.js?v=8b2110a3:11010
commitPassiveMountOnFiber @ react-dom_client.js?v=8b2110a3:11201
recursivelyTraversePassiveMountEffects @ react-dom_client.js?v=8b2110a3:11010
commitPassiveMountOnFiber @ react-dom_client.js?v=8b2110a3:11033
recursivelyTraversePassiveMountEffects @ react-dom_client.js?v=8b2110a3:11010
commitPassiveMountOnFiber @ react-dom_client.js?v=8b2110a3:11201
recursivelyTraversePassiveMountEffects @ react-dom_client.js?v=8b2110a3:11010
commitPassiveMountOnFiber @ react-dom_client.js?v=8b2110a3:11066
flushPassiveEffects @ react-dom_client.js?v=8b2110a3:13150
(anonymous) @ react-dom_client.js?v=8b2110a3:12776
performWorkUntilDeadline @ react-dom_client.js?v=8b2110a3:36
<App>
exports.jsxDEV @ react_jsx-dev-runtime.js?v=8b2110a3:247
(anonymous) @ main.tsx:22
client.ts:105 📥📥📥 RESPONSE RECEIVED 📥📥📥
client.ts:106 📊 Status: 500
client.ts:107 📊 Status Text: Internal Server Error
client.ts:108 📊 OK? false
client.ts:109 📋 Response Headers: Headers {}
client.ts:113 📄 RAW RESPONSE TEXT: {"success":false,"error":"no such column: position"}
client.ts:114 📏 Response length: 52
tauriHttpClient.ts:56  GET http://129.159.8.19:3000/api/auth/me 500 (Internal Server Error)
universalFetch @ tauriHttpClient.ts:56
request @ client.ts:99
get @ client.ts:189
checkSession @ authStore.ts:145
(anonymous) @ App.tsx:68
react_stack_bottom_frame @ react-dom_client.js?v=8b2110a3:18567
runWithFiberInDEV @ react-dom_client.js?v=8b2110a3:997
commitHookEffectListMount @ react-dom_client.js?v=8b2110a3:9411
commitHookPassiveMountEffects @ react-dom_client.js?v=8b2110a3:9465
reconnectPassiveEffects @ react-dom_client.js?v=8b2110a3:11273
recursivelyTraverseReconnectPassiveEffects @ react-dom_client.js?v=8b2110a3:11240
reconnectPassiveEffects @ react-dom_client.js?v=8b2110a3:11317
recursivelyTraverseReconnectPassiveEffects @ react-dom_client.js?v=8b2110a3:11240
reconnectPassiveEffects @ react-dom_client.js?v=8b2110a3:11265
recursivelyTraverseReconnectPassiveEffects @ react-dom_client.js?v=8b2110a3:11240
reconnectPassiveEffects @ react-dom_client.js?v=8b2110a3:11317
doubleInvokeEffectsOnFiber @ react-dom_client.js?v=8b2110a3:13339
runWithFiberInDEV @ react-dom_client.js?v=8b2110a3:997
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom_client.js?v=8b2110a3:13312
commitDoubleInvokeEffectsInDEV @ react-dom_client.js?v=8b2110a3:13347
flushPassiveEffects @ react-dom_client.js?v=8b2110a3:13157
(anonymous) @ react-dom_client.js?v=8b2110a3:12776
performWorkUntilDeadline @ react-dom_client.js?v=8b2110a3:36
<App>
exports.jsxDEV @ react_jsx-dev-runtime.js?v=8b2110a3:247
(anonymous) @ main.tsx:22
client.ts:105 📥📥📥 RESPONSE RECEIVED 📥📥📥
client.ts:106 📊 Status: 500
client.ts:107 📊 Status Text: Internal Server Error
client.ts:108 📊 OK? false
client.ts:109 📋 Response Headers: Headers {}
client.ts:119 ✅ JSON parsed successfully: {success: false, error: 'no such column: position'}
client.ts:113 📄 RAW RESPONSE TEXT: {"success":false,"error":"no such column: position"}
client.ts:114 📏 Response length: 52
client.ts:119 ✅ JSON parsed successfully: {success: false, error: 'no such column: position'}
