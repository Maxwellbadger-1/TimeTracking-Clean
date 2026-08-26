// READONLY-Messung: Aggregat gegen Journal + Zukunftszeilen. Kein INSERT/UPDATE/DELETE.
import Database from '/home/ubuntu/TimeTracking-Clean/node_modules/better-sqlite3/lib/index.js';
const dbPath = process.argv[2];
const label = process.argv[3] ?? '';
const db = new Database(dbPath, { readonly: true });
db.pragma('query_only = ON');
const round2 = (v) => Math.round(v * 100) / 100;
const rows = db.prepare(`
  SELECT b.userId, b.month, ROUND(b.overtime,6) AS agg,
         ROUND(COALESCE((SELECT SUM(t.hours) FROM overtime_transactions t
            WHERE t.userId=b.userId AND substr(t.date,1,7)=b.month),0),6) AS jrn
  FROM overtime_balance b ORDER BY b.userId, b.month`).all();
let ok=0, ab=0; const users=new Set(); const abw=[];
for (const r of rows) {
  const d = round2(r.jrn - r.agg);
  if (Math.abs(d) < 0.005) ok++; else { ab++; users.add(r.userId); abw.push({...r, diff:d}); }
}
const names = new Map(db.prepare('SELECT id, firstName, lastName FROM users').all().map(u=>[u.id, u.firstName+' '+u.lastName]));
console.log('### '+label+' ('+dbPath+')');
console.log('Monatszeilen gesamt: '+rows.length+' | uebereinstimmend: '+ok+' | abweichend: '+ab+' | betroffene Nutzer: '+users.size);
console.log('Betroffene Nutzer: '+[...users].sort((a,b)=>a-b).map(id=>id+' '+(names.get(id)??'?')).join(' | '));
console.log('--- Abweichungen je Monatszeile ---');
for (const a of abw) console.log('  userId='+String(a.userId).padStart(3)+' '+(names.get(a.userId)??'?').padEnd(24)+' '+a.month+'  Aggregat='+String(a.agg).padStart(9)+'  Journal='+String(a.jrn).padStart(9)+'  Diff='+String(a.diff).padStart(9));
const heute = db.prepare("SELECT date('now','localtime') d").get().d;
const monat = heute.slice(0,7);
const zt = db.prepare('SELECT COUNT(*) c FROM overtime_transactions WHERE date > ?').get(heute).c;
const zb = db.prepare('SELECT userId, month FROM overtime_balance WHERE month > ? ORDER BY userId').all(monat);
console.log('--- Zukunftszeilen (Stichtag '+heute+') ---');
console.log('  overtime_transactions mit date > heute: '+zt);
console.log('  overtime_balance mit month > '+monat+': '+zb.length+'  ['+zb.map(r=>r.userId+'/'+r.month).join(', ')+']');
const t=db.prepare('SELECT COUNT(*) c FROM overtime_transactions').get().c;
const b=db.prepare('SELECT COUNT(*) c FROM overtime_balance').get().c;
console.log('--- Tabellenumfang ---');
console.log('  overtime_transactions gesamt: '+t+' | overtime_balance gesamt: '+b);
db.close();
