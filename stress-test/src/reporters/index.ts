import fs from 'node:fs';
import path from 'node:path';
import type { StressRunReport } from '../config/types';
import { renderHtmlReport } from './html';
import { renderJsonReport, renderMarkdownReport } from './json-markdown';

export interface SavedReportPaths {
  htmlPath: string;
  jsonPath: string;
  markdownPath: string;
  archivedHtmlPath: string;
  archivedJsonPath: string;
  archivedMarkdownPath: string;
}

export function writeStressReports(
  report: StressRunReport,
  reportDir: string,
): SavedReportPaths {
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonContent = renderJsonReport(report);
  const mdContent = renderMarkdownReport(report);
  const htmlContent = renderHtmlReport(report);

  const htmlPath = path.join(reportDir, 'latest.html');
  const jsonPath = path.join(reportDir, 'latest.json');
  const markdownPath = path.join(reportDir, 'latest.md');

  const archivedHtmlPath = path.join(reportDir, `${report.runId}.html`);
  const archivedJsonPath = path.join(reportDir, `${report.runId}.json`);
  const archivedMarkdownPath = path.join(reportDir, `${report.runId}.md`);

  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  fs.writeFileSync(jsonPath, jsonContent, 'utf8');
  fs.writeFileSync(markdownPath, mdContent, 'utf8');

  fs.writeFileSync(archivedHtmlPath, htmlContent, 'utf8');
  fs.writeFileSync(archivedJsonPath, jsonContent, 'utf8');
  fs.writeFileSync(archivedMarkdownPath, mdContent, 'utf8');

  return {
    htmlPath,
    jsonPath,
    markdownPath,
    archivedHtmlPath,
    archivedJsonPath,
    archivedMarkdownPath,
  };
}

export { renderHtmlReport } from './html';
export { renderJsonReport, renderMarkdownReport } from './json-markdown';
