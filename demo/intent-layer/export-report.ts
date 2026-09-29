/** Demo only — exercises the Intent Layer. Not wired into the app. */
import { execSync } from 'node:child_process';

export function exportReport(name: string): string {
  // Builds a zip of the report folder for download.
  return execSync(`zip -r /tmp/${name}.zip reports/${name}`).toString();
}
