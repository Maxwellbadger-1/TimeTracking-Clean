import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Shield, Check } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../api/client';
import type { User } from '../../types';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

export function PrivacyPolicyModal({ isOpen, onAccept }: PrivacyPolicyModalProps) {
  const [accepting, setAccepting] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  // DEBUG: Log when isOpen changes
  useEffect(() => {
    console.log('🚪🚪🚪 PRIVACY MODAL isOpen CHANGED 🚪🚪🚪');
    console.log('📊 isOpen:', isOpen);
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      console.log('🔒 Locking body scroll (modal open)');
      document.body.style.overflow = 'hidden';
    }
    return () => {
      console.log('🔓 Unlocking body scroll (modal closing)');
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrolledToBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    if (scrolledToBottom && !hasScrolled) {
      setHasScrolled(true);
    }
  };

  const handleAccept = async () => {
    try {
      setAccepting(true);
      toast.info('📝 Speichere Einwilligung...');

      console.log('🔍 DEBUG: Sending privacy consent request via apiClient');

      // Use apiClient instead of raw fetch - it handles credentials and headers correctly
      const response = await apiClient.post<User>('/users/me/privacy-consent');

      console.log('🔍 DEBUG: apiClient response:', response);

      if (!response.success) {
        console.error('❌ DEBUG: API error:', response.error);
        throw new Error(response.error || 'Failed to accept privacy policy');
      }

      console.log('✅ DEBUG: Privacy consent accepted successfully!', response.data);

      toast.success('✅ Datenschutzerklärung akzeptiert!');

      console.log('🎯🎯🎯 CALLING onAccept() 🎯🎯🎯');
      onAccept();
      console.log('🎯🎯🎯 onAccept() COMPLETED 🎯🎯🎯');
    } catch (error) {
      console.error('❌ Privacy consent error:', error);
      toast.error('Fehler beim Akzeptieren der Datenschutzerklärung');
    } finally {
      setAccepting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop - Cannot click to close! */}
      <div
        className="fixed inset-0 bg-black bg-opacity-75"
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-xl transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg">
                <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Datenschutzerklärung (DSGVO)
              </h2>
            </div>
          </div>

          {/* Content */}
          <div
            className="overflow-y-auto px-6 py-4 space-y-6 max-h-[60vh]"
            onScroll={handleScroll}
          >
            {/* Introduction */}
            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                1. Einleitung
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Diese Datenschutzerklärung informiert Sie über die Art, den Umfang und den Zweck
                der Verarbeitung personenbezogener Daten im Rahmen unseres
                Zeiterfassungssystems. Wir nehmen den Schutz Ihrer persönlichen Daten sehr ernst
                und behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der
                gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.
              </p>
            </section>

            {/* Data Collection */}
            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                2. Welche Daten werden erfasst?
              </h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                <li>
                  <strong>Benutzerdaten:</strong> Name, E-Mail, Benutzername, Abteilung,
                  Wochenstunden, Urlaubsanspruch
                </li>
                <li>
                  <strong>Zeiterfassungsdaten:</strong> Arbeitszeiteinträge (Datum, Start-/Endzeit,
                  Pausen, Standort)
                </li>
                <li>
                  <strong>Abwesenheiten:</strong> Urlaubsanträge, Krankmeldungen, unbezahlter Urlaub
                </li>
                <li>
                  <strong>Überstunden:</strong> Berechnung und Saldo der Überstunden
                </li>
                <li>
                  <strong>Audit-Logs:</strong> Systemprotokolle über Datenänderungen
                  (wer, wann, was)
                </li>
              </ul>
            </section>

            {/* Purpose */}
            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                3. Zweck der Datenverarbeitung
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
                Ihre Daten werden ausschließlich für folgende Zwecke verarbeitet:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                <li>Arbeitszeiterfassung gemäß gesetzlicher Vorgaben (ArbZG)</li>
                <li>Urlaubsverwaltung und Abwesenheitsplanung</li>
                <li>Überstundenberechnung und -verwaltung</li>
                <li>Erstellung von Berichten und Statistiken</li>
                <li>Nachvollziehbarkeit von Systemänderungen (Audit-Logs)</li>
              </ul>
            </section>

            {/* Legal Basis */}
            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                4. Rechtsgrundlage
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Die Verarbeitung Ihrer Daten erfolgt auf Grundlage von:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 mt-2">
                <li>
                  <strong>Art. 6 Abs. 1 lit. b DSGVO:</strong> Erfüllung des Arbeitsvertrags
                </li>
                <li>
                  <strong>Art. 6 Abs. 1 lit. c DSGVO:</strong> Erfüllung gesetzlicher Pflichten
                  (Arbeitszeitgesetz)
                </li>
                <li>
                  <strong>Art. 6 Abs. 1 lit. f DSGVO:</strong> Berechtigtes Interesse an
                  ordnungsgemäßer Arbeitszeiterfassung
                </li>
              </ul>
            </section>

            {/* Data Storage */}
            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                5. Speicherdauer
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Ihre Daten werden für die Dauer Ihres Arbeitsverhältnisses plus 4 Jahre nach Ende
                des Kalenderjahres gespeichert (gemäß § 257 HGB). Nach Ablauf dieser Frist werden
                Ihre Daten automatisch gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten
                entgegenstehen.
              </p>
            </section>

            {/* Your Rights */}
            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                6. Ihre Rechte (DSGVO)
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
                Sie haben jederzeit das Recht auf:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                <li>
                  <strong>Auskunft (Art. 15 DSGVO):</strong> Sie können jederzeit Ihre Daten
                  exportieren (Button im Dashboard)
                </li>
                <li>
                  <strong>Berichtigung (Art. 16 DSGVO):</strong> Korrektur falscher Daten
                </li>
                <li>
                  <strong>Löschung (Art. 17 DSGVO):</strong> Löschung Ihrer Daten nach Ende des
                  Arbeitsverhältnisses
                </li>
                <li>
                  <strong>Einschränkung (Art. 18 DSGVO):</strong> Einschränkung der Verarbeitung
                </li>
                <li>
                  <strong>Datenübertragbarkeit (Art. 20 DSGVO):</strong> Export Ihrer Daten in
                  maschinenlesbarem Format (JSON)
                </li>
                <li>
                  <strong>Widerspruch (Art. 21 DSGVO):</strong> Widerspruch gegen die Verarbeitung
                  aus besonderen Gründen
                </li>
              </ul>
            </section>

            {/* Security */}
            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                7. Datensicherheit
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Wir treffen technische und organisatorische Sicherheitsmaßnahmen zum Schutz Ihrer
                Daten:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 mt-2">
                <li>Passwort-Hashing (bcrypt)</li>
                <li>Session-basierte Authentifizierung</li>
                <li>Audit-Logs für alle Datenänderungen</li>
                <li>Tägliche Backups</li>
                <li>Zugriffsbeschränkungen (Rollen: Admin / Mitarbeiter)</li>
              </ul>
            </section>

            {/* Contact */}
            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                8. Kontakt & Beschwerden
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Bei Fragen oder Beschwerden zum Datenschutz wenden Sie sich bitte an Ihren
                Vorgesetzten oder den Datenschutzbeauftragten. Sie haben auch das Recht, eine
                Beschwerde bei der zuständigen Datenschutz-Aufsichtsbehörde einzureichen.
              </p>
            </section>

            {/* Scroll Indicator */}
            {!hasScrolled && (
              <div className="flex items-center justify-center py-4 text-sm text-gray-500 dark:text-gray-400">
                ↓ Bitte scrollen Sie bis zum Ende ↓
              </div>
            )}
          </div>

          {/* Footer with Accept Button */}
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              {hasScrolled ? (
                <div className="flex items-center text-green-600 dark:text-green-400">
                  <Check className="w-4 h-4 mr-1" />
                  Gelesen
                </div>
              ) : (
                <span>Bitte lesen Sie die Datenschutzerklärung vollständig</span>
              )}
            </div>
            <Button
              variant="primary"
              onClick={handleAccept}
              disabled={!hasScrolled || accepting}
            >
              {accepting ? 'Speichere...' : 'Ich stimme zu'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
