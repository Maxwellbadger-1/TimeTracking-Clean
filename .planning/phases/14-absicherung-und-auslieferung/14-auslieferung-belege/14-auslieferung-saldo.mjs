/**
 * CLI: Leitet aus einem oder zwei mit `14-ist-stand-report.mjs` erhobenen Ist-Staenden die
 * je Nutzer geforderte Saldo-Doppelmessung ab und stellt zwei Staende gegenueber.
 *
 * ZWEI SALDEN JE NUTZER — bewusst getrennt (Auftrag Schritt 1):
 *   `angezeigt`  = SUM(overtime) ueber overtime_balance-Monatszeilen mit month <= --stichtag.
 *                  Das ist der Wert, den der Mitarbeiter sieht: die Anwendung blendet
 *                  Monatszeilen in der Zukunft nicht in den Saldo ein.
 *   `roh`        = SUM(overtime) ueber ALLE Monatszeilen, ohne Filter. Differiert vom
 *                  angezeigten Wert genau dann, wenn Zukunftsmonatszeilen bestehen.
 * Die Differenz beider Zahlen ist damit ein direkter Messwert fuer die Zukunftszeilen.
 *
 * AUSSCHLIESSLICH LESEND: Dieses Werkzeug oeffnet keine Datenbank. Es liest JSON-Dateien.
 *
 * Nutzung:
 *   node scripts/14-auslieferung-saldo.mjs --a=<vorher.json> [--b=<nachher.json>] \
 *     --stichtag=YYYY-MM --out=<bericht.md> --titel="<text>"
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';

function usage(m) {
  if (m) console.error('FEHLER: ' + m);
  console.error('Nutzung: node scripts/14-auslieferung-saldo.mjs --a=<a.json> [--b=<b.json>] --stichtag=YYYY-MM --out=<bericht.md> --titel="<text>"');
  process.exit(2);
}

let aPath, bPath, stichtag, outPath, titel;
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--a=')) aPath = arg.slice(4);
  else if (arg.startsWith('--b=')) bPath = arg.slice(4);
  else if (arg.startsWith('--stichtag=')) stichtag = arg.slice('--stichtag='.length);
  else if (arg.startsWith('--out=')) outPath = arg.slice('--out='.length);
  else if (arg.startsWith('--titel=')) titel = arg.slice('--titel='.length);
  else usage('unbekanntes Argument: "' + arg + '"');
}
if (!aPath) usage('--a fehlt.');
if (!stichtag || !/^\d{4}-\d{2}$/.test(stichtag)) usage('--stichtag=YYYY-MM fehlt oder ist fehlerhaft.');
if (!outPath) usage('--out fehlt.');
if (!titel) usage('--titel fehlt.');
if (!existsSync(aPath)) usage('Datei fehlt: ' + aPath);
if (bPath && !existsSync(bPath)) usage('Datei fehlt: ' + bPath);

const r6 = (v) => Math.round(v * 1e6) / 1e6;
const r2 = (v) => Math.round(v * 100) / 100;
const load = (p) => JSON.parse(readFileSync(p, 'utf-8'));

function derive(env) {
  const map = new Map();
  for (const u of env.users) {
    const months = u.overtimeBalance.months ?? [];
    const angezeigt = r6(months.filter((m) => m.month <= stichtag).reduce((s, m) => s + (m.overtime ?? 0), 0));
    const roh = r6(months.reduce((s, m) => s + (m.overtime ?? 0), 0));
    map.set(u.id, {
      id: u.id,
      name: u.firstName + ' ' + u.lastName,
      geloescht: !!u.deletedAt,
      weeklyHours: u.weeklyHours,
      monate: months.length,
      zukunftsmonate: months.filter((m) => m.month > stichtag).map((m) => m.month),
      angezeigt,
      roh,
      journalBuchungen: u.overtimeTransactions.count,
      journalSumme: u.overtimeTransactions.sumHours,
      zeiteintraege: u.timeEntries.count,
      urlaubsjahre: u.vacationYears.map((v) => v.year + ': A=' + v.entitlement + ' U=' + v.carryover + ' G=' + v.taken + ' R=' + v.remaining),
      urlaubKonten: u.vacationYears.length,
      urlaubSchluessig: u.vacationYears.every(
        (v) => v.entitlement === null || Math.abs(r6((v.entitlement ?? 0) + (v.carryover ?? 0) - (v.taken ?? 0)) - (v.remaining ?? 0)) < 0.005
      ),
    });
  }
  return map;
}

const A = load(aPath);
const a = derive(A);
const B = bPath ? load(bPath) : null;
const b = B ? derive(B) : null;

const L = [];
L.push('# ' + titel);
L.push('');
L.push('- Stand A: `' + A.label + '` (erhoben ' + A.generatedAt + ', SHA-256 Nutzdatenkern `' + (A.payloadSha256 ?? A.sha256 ?? '-') + '`)');
if (B) L.push('- Stand B: `' + B.label + '` (erhoben ' + B.generatedAt + ', SHA-256 Nutzdatenkern `' + (B.payloadSha256 ?? B.sha256 ?? '-') + '`)');
L.push('- Stichtag fuer den angezeigten Saldo: Monatszeilen mit `month <= ' + stichtag + '`');
L.push('');

L.push('## Saldo je Nutzer');
L.push('');
if (B) {
  L.push('| ID | Name | Wochenstd. | angezeigt A | angezeigt B | Bewegung | roh A | roh B | Bewegung roh | Zukunftsmonate B |');
  L.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---|');
} else {
  L.push('| ID | Name | Wochenstd. | Monatszeilen | angezeigt (`month <= ' + stichtag + '`) | Rohsumme | Differenz | Zukunftsmonate | Journalbuchungen | Zeiteintraege | Urlaubsjahre |');
  L.push('|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|');
}
let bewegt = 0;
const bewegungen = [];
for (const [id, ua] of a) {
  const ub = b ? b.get(id) : null;
  if (B) {
    if (!ub) { L.push('| ' + id + ' | ' + ua.name + ' | | | **FEHLT IN B** | | | | | |'); continue; }
    const dAng = r2(ub.angezeigt - ua.angezeigt);
    const dRoh = r2(ub.roh - ua.roh);
    if (Math.abs(dAng) >= 0.005 || Math.abs(dRoh) >= 0.005) { bewegt++; bewegungen.push({ id, name: ua.name, dAng, dRoh, vonA: ua.angezeigt, nachB: ub.angezeigt, rohA: ua.roh, rohB: ub.roh }); }
    L.push('| ' + id + ' | ' + ua.name + (ua.geloescht ? ' _(geloescht)_' : '') + ' | ' + (ua.weeklyHours ?? '-') + ' | ' + ua.angezeigt + ' | ' + ub.angezeigt + ' | ' + (dAng === 0 ? '-' : (dAng > 0 ? '+' : '') + dAng) + ' | ' + ua.roh + ' | ' + ub.roh + ' | ' + (dRoh === 0 ? '-' : (dRoh > 0 ? '+' : '') + dRoh) + ' | ' + (ub.zukunftsmonate.join(', ') || '-') + ' |');
  } else {
    L.push('| ' + id + ' | ' + ua.name + (ua.geloescht ? ' _(geloescht)_' : '') + ' | ' + (ua.weeklyHours ?? '-') + ' | ' + ua.monate + ' | ' + ua.angezeigt + ' | ' + ua.roh + ' | ' + r2(ua.roh - ua.angezeigt) + ' | ' + (ua.zukunftsmonate.join(', ') || '-') + ' | ' + ua.journalBuchungen + ' | ' + ua.zeiteintraege + ' | ' + ua.urlaubKonten + ' |');
  }
}
L.push('');

if (B) {
  L.push('## Bewegungen namentlich');
  L.push('');
  if (bewegungen.length === 0) {
    L.push('**Keine Bewegung.** Der Saldo ist bei jedem Nutzer in beiden Abgrenzungen unveraendert.');
  } else {
    L.push('| ID | Name | angezeigt vorher | angezeigt nachher | Betrag | roh vorher | roh nachher | Betrag roh |');
    L.push('|---|---|---:|---:|---:|---:|---:|---:|');
    for (const m of bewegungen) L.push('| ' + m.id + ' | ' + m.name + ' | ' + m.vonA + ' h | ' + m.nachB + ' h | ' + ((m.dAng > 0 ? '+' : '') + m.dAng) + ' h | ' + m.rohA + ' h | ' + m.rohB + ' h | ' + ((m.dRoh > 0 ? '+' : '') + m.dRoh) + ' h |');
    L.push('');
    L.push('**' + bewegt + ' von ' + a.size + ' Nutzern bewegt.**');
  }
  L.push('');
}

L.push('## Urlaub');
L.push('');
const quelle = b ?? a;
let konten = 0, schluessig = 0;
const unschluessig = [];
for (const [, u] of quelle) { konten += u.urlaubKonten; if (u.urlaubSchluessig) schluessig += u.urlaubKonten; else unschluessig.push(u.name); }
L.push('- Urlaubskonten gesamt: **' + konten + '**');
L.push('- davon schluessig (`Anspruch + Uebertrag - Genommen = Rest`): **' + schluessig + '**');
L.push(unschluessig.length === 0 ? '- Kein Konto unschluessig.' : '- **UNSCHLUESSIG:** ' + unschluessig.join(', '));
if (B) {
  const abw = [];
  for (const [id, ua] of a) {
    const ub = b.get(id);
    if (!ub) continue;
    const sa = JSON.stringify(ua.urlaubsjahre), sb = JSON.stringify(ub.urlaubsjahre);
    if (sa !== sb) abw.push(id + ' ' + ua.name + ': ' + sa + ' -> ' + sb);
  }
  L.push(abw.length === 0 ? '- **Urlaub unveraendert:** kein einziger Jahreswert hat sich zwischen A und B bewegt.' : '- **URLAUB VERAENDERT:** ' + abw.join(' | '));
}
L.push('');

L.push('## Tabellenumfang');
L.push('');
L.push('| Tabelle | A |' + (B ? ' B | Bewegung |' : ''));
L.push('|---|---:|' + (B ? '---:|---:|' : ''));
for (const t of Object.keys(A.tableCounts)) {
  const va = A.tableCounts[t];
  if (B) { const vb = B.tableCounts[t]; L.push('| `' + t + '` | ' + va + ' | ' + vb + ' | ' + (vb === va ? 'unveraendert' : '**' + (vb - va > 0 ? '+' : '') + (vb - va) + '**') + ' |'); }
  else L.push('| `' + t + '` | ' + va + ' |');
}
L.push('');

writeFileSync(outPath, L.join('\n') + '\n', 'utf-8');
console.log('Bericht geschrieben: ' + outPath);
if (B) console.log('Nutzer mit Saldobewegung: ' + bewegt + ' von ' + a.size);
console.log('Urlaubskonten: ' + konten + ', davon schluessig: ' + schluessig);
