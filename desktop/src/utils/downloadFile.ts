/**
 * File Download Utilities
 *
 * Helper functions for downloading files (Blobs) in the browser
 */

/**
 * Download a Blob as a file
 *
 * Creates a temporary download link, triggers the download,
 * and cleans up resources.
 *
 * @param blob The Blob to download
 * @param filename The filename for the downloaded file
 *
 * @example
 * const csvBlob = new Blob(['data'], { type: 'text/csv' });
 * downloadBlob(csvBlob, 'export.csv');
 */
export function downloadBlob(blob: Blob, filename: string): void {
  // Create temporary object URL
  const url = URL.createObjectURL(blob);

  // Create hidden anchor element
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';

  // Trigger download
  document.body.appendChild(a);
  a.click();

  // Cleanup
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
