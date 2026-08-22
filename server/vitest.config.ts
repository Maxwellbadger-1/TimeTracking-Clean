import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // WR-14 (Code-Review Phase 11): Produktionsschutz vor JEDER Testdatei. Die Tests
    // schreiben und löschen echte Zeilen in der Datenbank aus `getDatabasePath()`; ohne
    // diesen Riegel würde `DATABASE_PATH=<produktion> npm test` genau dort löschen.
    // Begründung im Kopf von `vitest.setup.ts`.
    setupFiles: ['./vitest.setup.ts'],
    // Testdateien laufen nacheinander, nicht parallel.
    //
    // `getDatabasePath()` kennt kein `NODE_ENV=test` — alle Tests arbeiten deshalb auf
    // derselben `database/development.db` wie die lokale Entwicklung. Parallel laufende
    // Dateien treten sich dabei gegenseitig auf die Füße: Das Fehlerbild wechselte von
    // Lauf zu Lauf (gemessen 2026-08-21: mal 3, mal 6 Fehlschläge, jedes Mal andere),
    // womit die Suite als Regressionsnetz unbrauchbar war. Sequentiell liefert sie
    // reproduzierbar 179/182 — die drei verbleibenden Fehlschläge sind bekannt und in
    // `.planning/phases/08-.../deferred-items.md` begründet.
    //
    // Das ist die Behandlung des Symptoms. Die Ursache — eine eigene Testdatenbank pro
    // Lauf statt der Arbeitsdatenbank — steht als aufgeschobener Punkt offen.
    fileParallelism: false,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.ts',
        '**/*.d.ts',
        'src/database/migrations/',
        'src/scripts/',
      ],
    },
  },
});
