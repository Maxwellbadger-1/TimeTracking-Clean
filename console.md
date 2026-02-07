client.ts:71 🚀🚀🚀 MAKING FETCH REQUEST 🚀🚀🚀
client.ts:72 🌐 URL: http://localhost:3000/api/notifications?page=1&limit=20&unreadOnly=true
client.ts:73 🔧 Method: GET
client.ts:74 📦 Body: undefined
client.ts:75 📋 Headers: undefined
client.ts:76 🍪 Credentials: include
client.ts:77 🌍 Current Origin: http://localhost:1420
client.ts:78 🎯 Target Origin: http://localhost:3000
client.ts:79 🔀 Cross-Origin? true
client.ts:100 📥📥📥 RESPONSE RECEIVED 📥📥📥
client.ts:101 📊 Status: 200
client.ts:102 📊 Status Text: OK
client.ts:103 📊 OK? true
client.ts:104 📋 Response Headers: Headers {}
client.ts:108 📄 RAW RESPONSE TEXT: {"success":true,"data":{"rows":[{"id":153,"userId":1,"type":"absence_requested","title":"Neuer Krankmeldung-Antrag","message":"Benedikt Jochem hat einen Krankmeldung vom 2026-02-04 bis 2026-02-04 (1 Tage) beantragt.","read":0,"createdAt":"2026-02-07 19:53:09","isRead":false},{"id":143,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Carmen Rothemund hat einen Urlaub vom 2026-02-17 bis 2026-02-17 (1 Tage) beantragt.","read":0,"createdAt":"2026-02-05 10:44:53","isRead":false},{"id":133,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Test Test hat einen Urlaub vom 2026-01-16 bis 2026-01-16 (1 Tage) beantragt.","read":0,"createdAt":"2026-01-15 16:45:48","isRead":false},{"id":129,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Carmen Rothemund hat einen Urlaub vom 2026-01-05 bis 2026-01-05 (1 Tage) beantragt.","read":0,"createdAt":"2026-01-15 08:00:53","isRead":false},{"id":110,"userId":1,"type":"absence_requested","title":"Neuer Überstundenausgleich-Antrag","message":"Silvia Lachner hat einen Überstundenausgleich vom 2026-01-02 bis 2026-01-02 (1 Tage) beantragt.","read":0,"createdAt":"2026-01-14 11:27:14","isRead":false}],"pagination":{"page":1,"limit":20,"total":5,"totalPages":1,"hasMore":false}}}
client.ts:109 📏 Response length: 1305
client.ts:114 ✅ JSON parsed successfully: {success: true, data: {…}}
client.ts:71 🚀🚀🚀 MAKING FETCH REQUEST 🚀🚀🚀
client.ts:72 🌐 URL: http://localhost:3000/api/notifications?page=1&limit=20
client.ts:73 🔧 Method: GET
client.ts:74 📦 Body: undefined
client.ts:75 📋 Headers: undefined
client.ts:76 🍪 Credentials: include
client.ts:77 🌍 Current Origin: http://localhost:1420
client.ts:78 🎯 Target Origin: http://localhost:3000
client.ts:79 🔀 Cross-Origin? true
client.ts:100 📥📥📥 RESPONSE RECEIVED 📥📥📥
client.ts:101 📊 Status: 200
client.ts:102 📊 Status Text: OK
client.ts:103 📊 OK? true
client.ts:104 📋 Response Headers: Headers {}
client.ts:108 📄 RAW RESPONSE TEXT: {"success":true,"data":{"rows":[{"id":153,"userId":1,"type":"absence_requested","title":"Neuer Krankmeldung-Antrag","message":"Benedikt Jochem hat einen Krankmeldung vom 2026-02-04 bis 2026-02-04 (1 Tage) beantragt.","read":0,"createdAt":"2026-02-07 19:53:09","isRead":false},{"id":143,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Carmen Rothemund hat einen Urlaub vom 2026-02-17 bis 2026-02-17 (1 Tage) beantragt.","read":0,"createdAt":"2026-02-05 10:44:53","isRead":false},{"id":133,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Test Test hat einen Urlaub vom 2026-01-16 bis 2026-01-16 (1 Tage) beantragt.","read":0,"createdAt":"2026-01-15 16:45:48","isRead":false},{"id":129,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Carmen Rothemund hat einen Urlaub vom 2026-01-05 bis 2026-01-05 (1 Tage) beantragt.","read":0,"createdAt":"2026-01-15 08:00:53","isRead":false},{"id":110,"userId":1,"type":"absence_requested","title":"Neuer Überstundenausgleich-Antrag","message":"Silvia Lachner hat einen Überstundenausgleich vom 2026-01-02 bis 2026-01-02 (1 Tage) beantragt.","read":0,"createdAt":"2026-01-14 11:27:14","isRead":false},{"id":83,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Silvia Lachner hat einen Urlaub vom 2026-01-19 bis 2026-01-31 (6 Tage) beantragt.","read":1,"createdAt":"2026-01-14 10:07:48","isRead":true},{"id":67,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"System Administrator hat einen Urlaub vom 2026-01-19 bis 2026-01-31 (6 Tage) beantragt.","read":1,"createdAt":"2026-01-13 11:04:07","isRead":true}],"pagination":{"page":1,"limit":20,"total":7,"totalPages":1,"hasMore":false}}}
client.ts:109 📏 Response length: 1769
client.ts:114 ✅ JSON parsed successfully: {success: true, data: {…}}
client.ts:71 🚀🚀🚀 MAKING FETCH REQUEST 🚀🚀🚀
client.ts:72 🌐 URL: http://localhost:3000/api/time-entries
client.ts:73 🔧 Method: POST
client.ts:74 📦 Body: {"userId":16,"date":"2026-02-04","startTime":"08:00","endTime":"17:00","breakMinutes":30,"location":"office"}
client.ts:75 📋 Headers: undefined
client.ts:76 🍪 Credentials: include
client.ts:77 🌍 Current Origin: http://localhost:1420
client.ts:78 🎯 Target Origin: http://localhost:3000
client.ts:79 🔀 Cross-Origin? true
tauriHttpClient.ts:56  POST http://localhost:3000/api/time-entries 500 (Internal Server Error)
universalFetch @ tauriHttpClient.ts:56
request @ client.ts:94
post @ client.ts:190
mutationFn @ useTimeEntries.ts:140
fn @ @tanstack_react-query.js?v=408b8097:1967
run @ @tanstack_react-query.js?v=408b8097:773
start @ @tanstack_react-query.js?v=408b8097:815
execute @ @tanstack_react-query.js?v=408b8097:2006
await in execute
mutate @ @tanstack_react-query.js?v=408b8097:2329
handleSubmit @ TimeEntryForm.tsx:100
executeDispatch @ react-dom_client.js?v=408b8097:13622
runWithFiberInDEV @ react-dom_client.js?v=408b8097:997
processDispatchQueue @ react-dom_client.js?v=408b8097:13658
(anonymous) @ react-dom_client.js?v=408b8097:14071
batchedUpdates$1 @ react-dom_client.js?v=408b8097:2626
dispatchEventForPluginEventSystem @ react-dom_client.js?v=408b8097:13763
dispatchEvent @ react-dom_client.js?v=408b8097:16784
dispatchDiscreteEvent @ react-dom_client.js?v=408b8097:16765
client.ts:100 📥📥📥 RESPONSE RECEIVED 📥📥📥
client.ts:101 📊 Status: 500
client.ts:102 📊 Status Text: Internal Server Error
client.ts:103 📊 OK? false
client.ts:104 📋 Response Headers: Headers {}
client.ts:108 📄 RAW RESPONSE TEXT: {"success":false,"error":"Failed to create time entry"}
client.ts:109 📏 Response length: 55
client.ts:114 ✅ JSON parsed successfully: {success: false, error: 'Failed to create time entry'}
TimeEntryForm.tsx:114 Failed to create time entry: Error: Failed to create time entry
    at Object.mutationFn (useTimeEntries.ts:143:15)
handleSubmit @ TimeEntryForm.tsx:114
await in handleSubmit
executeDispatch @ react-dom_client.js?v=408b8097:13622
runWithFiberInDEV @ react-dom_client.js?v=408b8097:997
processDispatchQueue @ react-dom_client.js?v=408b8097:13658
(anonymous) @ react-dom_client.js?v=408b8097:14071
batchedUpdates$1 @ react-dom_client.js?v=408b8097:2626
dispatchEventForPluginEventSystem @ react-dom_client.js?v=408b8097:13763
dispatchEvent @ react-dom_client.js?v=408b8097:16784
dispatchDiscreteEvent @ react-dom_client.js?v=408b8097:16765
client.ts:71 🚀🚀🚀 MAKING FETCH REQUEST 🚀🚀🚀
client.ts:72 🌐 URL: http://localhost:3000/api/notifications?page=1&limit=20&unreadOnly=true
client.ts:73 🔧 Method: GET
client.ts:74 📦 Body: undefined
client.ts:75 📋 Headers: undefined
client.ts:76 🍪 Credentials: include
client.ts:77 🌍 Current Origin: http://localhost:1420
client.ts:78 🎯 Target Origin: http://localhost:3000
client.ts:79 🔀 Cross-Origin? true
 📥📥📥 RESPONSE RECEIVED 📥📥📥
client.ts:101 📊 Status: 200
client.ts:102 📊 Status Text: OK
client.ts:103 📊 OK? true
client.ts:104 📋 Response Headers: Headers {}
client.ts:108 📄 RAW RESPONSE TEXT: {"success":true,"data":{"rows":[{"id":153,"userId":1,"type":"absence_requested","title":"Neuer Krankmeldung-Antrag","message":"Benedikt Jochem hat einen Krankmeldung vom 2026-02-04 bis 2026-02-04 (1 Tage) beantragt.","read":0,"createdAt":"2026-02-07 19:53:09","isRead":false},{"id":143,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Carmen Rothemund hat einen Urlaub vom 2026-02-17 bis 2026-02-17 (1 Tage) beantragt.","read":0,"createdAt":"2026-02-05 10:44:53","isRead":false},{"id":133,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Test Test hat einen Urlaub vom 2026-01-16 bis 2026-01-16 (1 Tage) beantragt.","read":0,"createdAt":"2026-01-15 16:45:48","isRead":false},{"id":129,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Carmen Rothemund hat einen Urlaub vom 2026-01-05 bis 2026-01-05 (1 Tage) beantragt.","read":0,"createdAt":"2026-01-15 08:00:53","isRead":false},{"id":110,"userId":1,"type":"absence_requested","title":"Neuer Überstundenausgleich-Antrag","message":"Silvia Lachner hat einen Überstundenausgleich vom 2026-01-02 bis 2026-01-02 (1 Tage) beantragt.","read":0,"createdAt":"2026-01-14 11:27:14","isRead":false}],"pagination":{"page":1,"limit":20,"total":5,"totalPages":1,"hasMore":false}}}
client.ts:109 📏 Response length: 1305
client.ts:114 ✅ JSON parsed successfully: {success: true, data: {…}}
client.ts:71 🚀🚀🚀 MAKING FETCH REQUEST 🚀🚀🚀
client.ts:72 🌐 URL: http://localhost:3000/api/notifications?page=1&limit=20
client.ts:73 🔧 Method: GET
client.ts:74 📦 Body: undefined
client.ts:75 📋 Headers: undefined
client.ts:76 🍪 Credentials: include
client.ts:77 🌍 Current Origin: http://localhost:1420
client.ts:78 🎯 Target Origin: http://localhost:3000
client.ts:79 🔀 Cross-Origin? true
client.ts:100 📥📥📥 RESPONSE RECEIVED 📥📥📥
client.ts:101 📊 Status: 200
client.ts:102 📊 Status Text: OK
client.ts:103 📊 OK? true
client.ts:104 📋 Response Headers: Headers {}
client.ts:108 📄 RAW RESPONSE TEXT: {"success":true,"data":{"rows":[{"id":153,"userId":1,"type":"absence_requested","title":"Neuer Krankmeldung-Antrag","message":"Benedikt Jochem hat einen Krankmeldung vom 2026-02-04 bis 2026-02-04 (1 Tage) beantragt.","read":0,"createdAt":"2026-02-07 19:53:09","isRead":false},{"id":143,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Carmen Rothemund hat einen Urlaub vom 2026-02-17 bis 2026-02-17 (1 Tage) beantragt.","read":0,"createdAt":"2026-02-05 10:44:53","isRead":false},{"id":133,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Test Test hat einen Urlaub vom 2026-01-16 bis 2026-01-16 (1 Tage) beantragt.","read":0,"createdAt":"2026-01-15 16:45:48","isRead":false},{"id":129,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Carmen Rothemund hat einen Urlaub vom 2026-01-05 bis 2026-01-05 (1 Tage) beantragt.","read":0,"createdAt":"2026-01-15 08:00:53","isRead":false},{"id":110,"userId":1,"type":"absence_requested","title":"Neuer Überstundenausgleich-Antrag","message":"Silvia Lachner hat einen Überstundenausgleich vom 2026-01-02 bis 2026-01-02 (1 Tage) beantragt.","read":0,"createdAt":"2026-01-14 11:27:14","isRead":false},{"id":83,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Silvia Lachner hat einen Urlaub vom 2026-01-19 bis 2026-01-31 (6 Tage) beantragt.","read":1,"createdAt":"2026-01-14 10:07:48","isRead":true},{"id":67,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"System Administrator hat einen Urlaub vom 2026-01-19 bis 2026-01-31 (6 Tage) beantragt.","read":1,"createdAt":"2026-01-13 11:04:07","isRead":true}],"pagination":{"page":1,"limit":20,"total":7,"totalPages":1,"hasMore":false}}}
client.ts:109 📏 Response length: 1769
client.ts:114 ✅ JSON parsed successfully: {success: true, data: {…}}
