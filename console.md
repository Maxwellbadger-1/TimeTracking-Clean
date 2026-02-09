(index):1 Access to fetch at 'http://129.159.8.19:3000/api/auth/me' from origin 'http://localhost:1420' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
129.159.8.19:3000/api/auth/me:1  Failed to load resource: net::ERR_FAILED
client.ts:168 API Request Error: TypeError: Failed to fetch
    at universalFetch (tauriHttpClient.ts:56:28)
    at ApiClient.request (client.ts:99:30)
    at ApiClient.get (client.ts:189:17)
    at checkSession (authStore.ts:145:40)
    at App.tsx:68:5
    at Object.react_stack_bottom_frame (react-dom_client.js?v=2c79d791:18567:20)
    at runWithFiberInDEV (react-dom_client.js?v=2c79d791:997:72)
    at commitHookEffectListMount (react-dom_client.js?v=2c79d791:9411:163)
    at commitHookPassiveMountEffects (react-dom_client.js?v=2c79d791:9465:60)
    at commitPassiveMountOnFiber (react-dom_client.js?v=2c79d791:11040:29)
request @ client.ts:168
(index):1 Access to fetch at 'http://129.159.8.19:3000/api/auth/me' from origin 'http://localhost:1420' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
129.159.8.19:3000/api/auth/me:1  Failed to load resource: net::ERR_FAILED
client.ts:168 API Request Error: TypeError: Failed to fetch
    at universalFetch (tauriHttpClient.ts:56:28)
    at ApiClient.request (client.ts:99:30)
    at ApiClient.get (client.ts:189:17)
    at checkSession (authStore.ts:145:40)
    at App.tsx:68:5
    at Object.react_stack_bottom_frame (react-dom_client.js?v=2c79d791:18567:20)
    at runWithFiberInDEV (react-dom_client.js?v=2c79d791:997:72)
    at commitHookEffectListMount (react-dom_client.js?v=2c79d791:9411:163)
    at commitHookPassiveMountEffects (react-dom_client.js?v=2c79d791:9465:60)
    at reconnectPassiveEffects (react-dom_client.js?v=2c79d791:11273:13)
request @ client.ts:168
(index):1 Access to fetch at 'http://129.159.8.19:3000/api/auth/login' from origin 'http://localhost:1420' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
129.159.8.19:3000/api/auth/login:1  Failed to load resource: net::ERR_FAILED
client.ts:168 API Request Error: TypeError: Failed to fetch
    at universalFetch (tauriHttpClient.ts:56:28)
    at ApiClient.request (client.ts:99:30)
    at ApiClient.post (client.ts:195:17)
    at login (authStore.ts:33:40)
    at handleSubmit (Login.tsx:51:27)
    at executeDispatch (react-dom_client.js?v=2c79d791:13622:11)
    at runWithFiberInDEV (react-dom_client.js?v=2c79d791:997:72)
    at processDispatchQueue (react-dom_client.js?v=2c79d791:13658:37)
    at react-dom_client.js?v=2c79d791:14071:11
    at batchedUpdates$1 (react-dom_client.js?v=2c79d791:2626:42)
request @ client.ts:168
authStore.ts:65 ❌ Login failed: Failed to fetch
login @ authStore.ts:65
Login.tsx:55 Login failed
handleSubmit @ Login.tsx:55
