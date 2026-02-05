AbsencesBreakdown.tsx:37 📊 AbsencesBreakdown - Loaded absences: 1
AbsencesBreakdown.tsx:38 📊 First absence: {id: 15, userId: 6, type: 'vacation', startDate: '2026-02-04', endDate: '2026-02-04', …}
AbsencesBreakdown.tsx:40 📊 Has calculatedHours? true
AbsencesBreakdown.tsx:41 📊 calculatedHours value: 2
AbsencesBreakdown.tsx:42 📊 days value: 1
AbsencesBreakdown.tsx:37 📊 AbsencesBreakdown - Loaded absences: 1
AbsencesBreakdown.tsx:38 📊 First absence: {id: 15, userId: 6, type: 'vacation', startDate: '2026-02-04', endDate: '2026-02-04', …}
AbsencesBreakdown.tsx:40 📊 Has calculatedHours? true
AbsencesBreakdown.tsx:41 📊 calculatedHours value: 2
AbsencesBreakdown.tsx:42 📊 days value: 1
client.ts:71 🚀🚀🚀 MAKING FETCH REQUEST 🚀🚀🚀
client.ts:72 🌐 URL: http://localhost:3000/api/overtime/transactions/live?userId=6&limit=100&fromDate=2026-01-01&toDate=2026-02-05
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
client.ts:108 📄 RAW RESPONSE TEXT: {"success":true,"data":{"transactions":[{"date":"2026-02-05","type":"earned","hours":-2,"description":"Keine Zeiterfassung (Soll: 2h)","source":"time_entries"},{"date":"2026-02-05","type":"correction","hours":2,"description":"Korrektur: Teeeesttttt","source":"overtime_corrections","referenceId":6},{"date":"2026-02-04","type":"vacation_credit","hours":2,"description":"Urlaub (genehmigt #15)","source":"absence_requests","referenceId":15},{"date":"2026-02-03","type":"earned","hours":-2,"description":"Keine Zeiterfassung (Soll: 2h)","source":"time_entries"},{"date":"2026-02-03","type":"correction","hours":2,"description":"Korrektur: Testbuchung","source":"overtime_corrections","referenceId":5}],"currentBalance":0,"userId":6}}
client.ts:109 📏 Response length: 731
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
client.ts:108 📄 RAW RESPONSE TEXT: {"success":true,"data":{"rows":[{"id":43,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Maximilian Fegg5 hat einen Urlaub vom 2026-02-04 bis 2026-02-04 (1 Tage) beantragt.","read":1,"createdAt":"2026-02-05 14:33:58","isRead":true},{"id":41,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Maximilian Fegg5 hat einen Urlaub vom 2026-02-05 bis 2026-02-05 (1 Tage) beantragt.","read":1,"createdAt":"2026-02-05 14:31:41","isRead":true},{"id":35,"userId":1,"type":"absence_requested","title":"Neuer Abwesenheit-Antrag","message":"Maximilian Fegg4 hat einen Abwesenheit vom 2026-01-07 bis 2026-01-07 (1 Tage) beantragt.","read":1,"createdAt":"2026-02-02 12:19:23","isRead":true},{"id":34,"userId":1,"type":"absence_requested","title":"Neuer Krankmeldung-Antrag","message":"Maximilian Fegg4 hat einen Krankmeldung vom 2026-02-02 bis 2026-02-02 (1 Tage) beantragt.","read":1,"createdAt":"2026-02-02 12:17:23","isRead":true},{"id":28,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Maximilian Fegg3 hat einen Urlaub vom 2026-01-01 bis 2026-01-31 (20 Tage) beantragt.","read":1,"createdAt":"2026-02-01 21:01:01","isRead":true},{"id":26,"userId":1,"type":"absence_requested","title":"Neuer Krankmeldung-Antrag","message":"Maximilian Fegg3 hat einen Krankmeldung vom 2026-02-01 bis 2026-02-08 (5 Tage) beantragt.","read":1,"createdAt":"2026-02-01 20:59:24","isRead":true},{"id":21,"userId":1,"type":"absence_requested","title":"Neuer Abwesenheit-Antrag","message":"Maximilian Fegg2 hat einen Abwesenheit vom 2026-01-19 bis 2026-01-25 (5 Tage) beantragt.","read":1,"createdAt":"2026-01-30 02:50:06","isRead":true},{"id":20,"userId":1,"type":"absence_requested","title":"Neuer Krankmeldung-Antrag","message":"Maximilian Fegg2 hat einen Krankmeldung vom 2026-01-12 bis 2026-01-18 (5 Tage) beantragt.","read":0,"createdAt":"2026-01-30 02:48:57","isRead":false},{"id":18,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Maximilian Fegg2 hat einen Urlaub vom 2026-01-05 bis 2026-01-11 (4 Tage) beantragt.","read":0,"createdAt":"2026-01-30 02:48:29","isRead":false},{"id":15,"userId":1,"type":"absence_requested","title":"Neuer Krankmeldung-Antrag","message":"Maximilian Fegg2 hat einen Krankmeldung vom 2026-01-12 bis 2026-01-18 (5 Tage) beantragt.","read":0,"createdAt":"2026-01-30 02:28:52","isRead":false},{"id":13,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Maximilian Fegg2 hat einen Urlaub vom 2026-01-19 bis 2026-01-25 (5 Tage) beantragt.","read":0,"createdAt":"2026-01-30 02:28:14","isRead":false},{"id":9,"userId":1,"type":"absence_requested","title":"Neuer Krankmeldung-Antrag","message":"Maximilian Fegg hat einen Krankmeldung vom 2026-01-19 bis 2026-01-25 (5 Tage) beantragt.","read":0,"createdAt":"2026-01-29 22:33:52","isRead":false},{"id":5,"userId":1,"type":"absence_rejected","title":"Urlaub abgelehnt","message":"Ihr Urlaub vom 2026-01-29 bis 2026-01-29 wurde abgelehnt.","read":0,"createdAt":"2026-01-29 21:40:16","isRead":false},{"id":4,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Maximilian Fegg hat einen Urlaub vom 2026-01-05 bis 2026-01-11 (4 Tage) beantragt.","read":0,"createdAt":"2026-01-29 21:39:43","isRead":false},{"id":3,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Maximilian Fegg hat einen Urlaub vom 2026-01-29 bis 2026-01-29 (1 Tage) beantragt.","read":0,"createdAt":"2026-01-29 21:39:30","isRead":false}],"pagination":{"page":1,"limit":20,"total":15,"totalPages":1,"hasMore":false}}}
client.ts:109 📏 Response length: 3628
client.ts:114 ✅ JSON parsed successfully: {success: true, data: {…}}
client.ts:100 📥📥📥 RESPONSE RECEIVED 📥📥📥
client.ts:101 📊 Status: 200
client.ts:102 📊 Status Text: OK
client.ts:103 📊 OK? true
client.ts:104 📋 Response Headers: Headers {}
client.ts:108 📄 RAW RESPONSE TEXT: {"success":true,"data":{"rows":[{"id":20,"userId":1,"type":"absence_requested","title":"Neuer Krankmeldung-Antrag","message":"Maximilian Fegg2 hat einen Krankmeldung vom 2026-01-12 bis 2026-01-18 (5 Tage) beantragt.","read":0,"createdAt":"2026-01-30 02:48:57","isRead":false},{"id":18,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Maximilian Fegg2 hat einen Urlaub vom 2026-01-05 bis 2026-01-11 (4 Tage) beantragt.","read":0,"createdAt":"2026-01-30 02:48:29","isRead":false},{"id":15,"userId":1,"type":"absence_requested","title":"Neuer Krankmeldung-Antrag","message":"Maximilian Fegg2 hat einen Krankmeldung vom 2026-01-12 bis 2026-01-18 (5 Tage) beantragt.","read":0,"createdAt":"2026-01-30 02:28:52","isRead":false},{"id":13,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Maximilian Fegg2 hat einen Urlaub vom 2026-01-19 bis 2026-01-25 (5 Tage) beantragt.","read":0,"createdAt":"2026-01-30 02:28:14","isRead":false},{"id":9,"userId":1,"type":"absence_requested","title":"Neuer Krankmeldung-Antrag","message":"Maximilian Fegg hat einen Krankmeldung vom 2026-01-19 bis 2026-01-25 (5 Tage) beantragt.","read":0,"createdAt":"2026-01-29 22:33:52","isRead":false},{"id":5,"userId":1,"type":"absence_rejected","title":"Urlaub abgelehnt","message":"Ihr Urlaub vom 2026-01-29 bis 2026-01-29 wurde abgelehnt.","read":0,"createdAt":"2026-01-29 21:40:16","isRead":false},{"id":4,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Maximilian Fegg hat einen Urlaub vom 2026-01-05 bis 2026-01-11 (4 Tage) beantragt.","read":0,"createdAt":"2026-01-29 21:39:43","isRead":false},{"id":3,"userId":1,"type":"absence_requested","title":"Neuer Urlaub-Antrag","message":"Maximilian Fegg hat einen Urlaub vom 2026-01-29 bis 2026-01-29 (1 Tage) beantragt.","read":0,"createdAt":"2026-01-29 21:39:30","isRead":false}],"pagination":{"page":1,"limit":20,"total":8,"totalPages":1,"hasMore":false}}}
client.ts:109 📏 Response length: 1965
client.ts:114 ✅ JSON parsed successfully: {success: true, data: {…}}
client.ts:71 🚀🚀🚀 MAKING FETCH REQUEST 🚀🚀🚀
 🌐 URL: http://localhost:3000/api/users
 🔧 Method: GET
 📦 Body: undefined
 📋 Headers: undefined
 🍪 Credentials: include
 🌍 Current Origin: http://localhost:1420
 🎯 Target Origin: http://localhost:3000
 🔀 Cross-Origin? true
 📥📥📥 RESPONSE RECEIVED 📥📥📥
 📊 Status: 200
 📊 Status Text: OK
 📊 OK? true
 📋 Response Headers: Headers {}
 📄 RAW RESPONSE TEXT: {"success":true,"data":[{"id":6,"username":"MaximilianFegg5","email":null,"firstName":"Maximilian","lastName":"Fegg5","role":"employee","department":null,"position":null,"weeklyHours":10,"workSchedule":{"monday":2,"tuesday":2,"wednesday":2,"thursday":2,"friday":2,"saturday":0,"sunday":0},"vacationDaysPerYear":30,"hireDate":"2026-02-01","endDate":null,"status":"active","privacyConsentAt":null,"createdAt":"2026-02-04 22:27:37","deletedAt":null,"isActive":1},{"id":5,"username":"MaximilianFegg4","email":null,"firstName":"Maximilian","lastName":"Fegg4","role":"employee","department":null,"position":null,"weeklyHours":10,"workSchedule":{"monday":2,"tuesday":2,"wednesday":2,"thursday":2,"friday":2,"saturday":0,"sunday":0},"vacationDaysPerYear":0,"hireDate":"2026-01-01","endDate":null,"status":"active","privacyConsentAt":null,"createdAt":"2026-02-01 21:25:01","deletedAt":null,"isActive":1},{"id":4,"username":"MaximilianFegg3","email":null,"firstName":"Maximilian","lastName":"Fegg3","role":"employee","department":null,"position":null,"weeklyHours":40,"workSchedule":{"monday":10,"tuesday":8,"wednesday":6,"thursday":6,"friday":10,"saturday":0,"sunday":0},"vacationDaysPerYear":30,"hireDate":"2026-01-01","endDate":null,"status":"active","privacyConsentAt":"2026-02-01 21:02:18","createdAt":"2026-02-01 20:57:53","deletedAt":null,"isActive":1},{"id":3,"username":"MaximilianFegg2","email":null,"firstName":"Maximilian","lastName":"Fegg2","role":"employee","department":null,"position":null,"weeklyHours":40,"workSchedule":{"monday":8,"tuesday":8,"wednesday":6,"thursday":6,"friday":12,"saturday":0,"sunday":0},"vacationDaysPerYear":30,"hireDate":"2026-01-01","endDate":null,"status":"active","privacyConsentAt":"2026-01-30 03:11:51","createdAt":"2026-01-30 02:24:59","deletedAt":null,"isActive":1},{"id":2,"username":"MaximilianFegg","email":null,"firstName":"Maximilian","lastName":"Fegg","role":"employee","department":null,"position":null,"weeklyHours":40,"workSchedule":{"monday":8,"tuesday":8,"wednesday":6,"thursday":6,"friday":12,"saturday":0,"sunday":0},"vacationDaysPerYear":30,"hireDate":"2026-01-01","endDate":null,"status":"active","privacyConsentAt":null,"createdAt":"2026-01-29 21:23:13","deletedAt":null,"isActive":1},{"id":1,"username":"admin","email":"admin@timetracking.local","firstName":"System","lastName":"Administrator","role":"admin","department":"IT","position":null,"weeklyHours":40,"workSchedule":null,"vacationDaysPerYear":30,"hireDate":"2026-01-29","endDate":null,"status":"active","privacyConsentAt":"2026-01-29 21:17:39","createdAt":"2026-01-29 21:13:39","deletedAt":null,"isActive":1}]}
 📏 Response length: 2624
 ✅ JSON parsed successfully: {success: true, data: Array(6)}
 🚀🚀🚀 MAKING FETCH REQUEST 🚀🚀🚀
 🌐 URL: http://localhost:3000/api/overtime/balance/6/year/2026
 🔧 Method: GET
 📦 Body: undefined
 📋 Headers: undefined
 🍪 Credentials: include
 🌍 Current Origin: http://localhost:1420
 🎯 Target Origin: http://localhost:3000
 🔀 Cross-Origin? true
 🚀🚀🚀 MAKING FETCH REQUEST 🚀🚀🚀
 🌐 URL: http://localhost:3000/api/overtime/balance/5/year/2026
 🔧 Method: GET
 📦 Body: undefined
 📋 Headers: undefined
 🍪 Credentials: include
 🌍 Current Origin: http://localhost:1420
 🎯 Target Origin: http://localhost:3000
 🔀 Cross-Origin? true
 🚀🚀🚀 MAKING FETCH REQUEST 🚀🚀🚀
 🌐 URL: http://localhost:3000/api/overtime/balance/4/year/2026
 🔧 Method: GET
 📦 Body: undefined
 📋 Headers: undefined
 🍪 Credentials: include
 🌍 Current Origin: http://localhost:1420
 🎯 Target Origin: http://localhost:3000
 🔀 Cross-Origin? true
 🚀🚀🚀 MAKING FETCH REQUEST 🚀🚀🚀
 🌐 URL: http://localhost:3000/api/overtime/balance/3/year/2026
 🔧 Method: GET
client.ts:74 📦 Body: undefined
client.ts:75 📋 Headers: undefined
client.ts:76 🍪 Credentials: include
client.ts:77 🌍 Current Origin: http://localhost:1420
client.ts:78 🎯 Target Origin: http://localhost:3000
client.ts:79 🔀 Cross-Origin? true
client.ts:71 🚀🚀🚀 MAKING FETCH REQUEST 🚀🚀🚀
client.ts:72 🌐 URL: http://localhost:3000/api/overtime/balance/2/year/2026
client.ts:73 🔧 Method: GET
client.ts:74 📦 Body: undefined
client.ts:75 📋 Headers: undefined
client.ts:76 🍪 Credentials: include
client.ts:77 🌍 Current Origin: http://localhost:1420
client.ts:78 🎯 Target Origin: http://localhost:3000
client.ts:79 🔀 Cross-Origin? true
client.ts:71 🚀🚀🚀 MAKING FETCH REQUEST 🚀🚀🚀
client.ts:72 🌐 URL: http://localhost:3000/api/overtime/balance/1/year/2026
client.ts:73 🔧 Method: GET
client.ts:74 📦 Body: undefined
client.ts:75 📋 Headers: undefined
client.ts:76 🍪 Credentials: include
client.ts:77 🌍 Current Origin: http://localhost:1420
client.ts:78 🎯 Target Origin: http://localhost:3000
client.ts:79 🔀 Cross-Origin? true
 📥📥📥 RESPONSE RECEIVED 📥📥📥
 📊 Status: 200
 📊 Status Text: OK
 📊 OK? true
 📋 Response Headers: Headers {}
 📥📥📥 RESPONSE RECEIVED 📥📥📥
 📊 Status: 200
 📊 Status Text: OK
 📊 OK? true
 📋 Response Headers: Headers {}
 📥📥📥 RESPONSE RECEIVED 📥📥📥
 📊 Status: 200
 📊 Status Text: OK
 📊 OK? true
 📋 Response Headers: Headers {}
 📄 RAW RESPONSE TEXT: {"success":true,"data":{"userId":6,"year":2026,"monthsIncluded":1,"targetHours":8,"actualHours":4,"overtime":-4,"carryoverFromPreviousYear":0}}
 📏 Response length: 143
 📄 RAW RESPONSE TEXT: {"success":true,"data":{"userId":5,"year":2026,"monthsIncluded":2,"targetHours":46,"actualHours":38,"overtime":-8,"carryoverFromPreviousYear":0}}
 📏 Response length: 145
 📄 RAW RESPONSE TEXT: {"success":true,"data":{"userId":4,"year":2026,"monthsIncluded":2,"targetHours":192,"actualHours":162,"overtime":-30,"carryoverFromPreviousYear":0}}
 📏 Response length: 148
 ✅ JSON parsed successfully: {success: true, data: {…}}
 ✅ JSON parsed successfully: {success: true, data: {…}}
 ✅ JSON parsed successfully: {success: true, data: {…}}
client.ts:100 📥📥📥 RESPONSE RECEIVED 📥📥📥
client.ts:101 📊 Status: 200
client.ts:102 📊 Status Text: OK
client.ts:103 📊 OK? true
client.ts:104 📋 Response Headers: Headers {}
client.ts:100 📥📥📥 RESPONSE RECEIVED 📥📥📥
client.ts:101 📊 Status: 200
client.ts:102 📊 Status Text: OK
client.ts:103 📊 OK? true
client.ts:104 📋 Response Headers: Headers {}
client.ts:108 📄 RAW RESPONSE TEXT: {"success":true,"data":{"userId":3,"year":2026,"monthsIncluded":2,"targetHours":152,"actualHours":92.5,"overtime":-59.5,"carryoverFromPreviousYear":0}}
client.ts:109 📏 Response length: 151
client.ts:108 📄 RAW RESPONSE TEXT: {"success":true,"data":{"userId":2,"year":2026,"monthsIncluded":2,"targetHours":192,"actualHours":40,"overtime":-152,"carryoverFromPreviousYear":0}}
client.ts:109 📏 Response length: 148
client.ts:114 ✅ JSON parsed successfully: {success: true, data: {…}}
client.ts:114 ✅ JSON parsed successfully: {success: true, data: {…}}
client.ts:100 📥📥📥 RESPONSE RECEIVED 📥📥📥
client.ts:101 📊 Status: 200
client.ts:102 📊 Status Text: OK
client.ts:103 📊 OK? true
client.ts:104 📋 Response Headers: Headers {}
client.ts:108 📄 RAW RESPONSE TEXT: {"success":true,"data":{"userId":1,"year":2026,"monthsIncluded":2,"targetHours":48,"actualHours":8.5,"overtime":-39.5,"carryoverFromPreviousYear":0}}
client.ts:109 📏 Response length: 149
client.ts:114 ✅ JSON parsed successfully: {success: true, data: {…}}
