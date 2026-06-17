import fs from 'fs';
import path from 'path';
import { checkRegexSafety } from '../regex-safety';
import { scanCodeForSecrets } from '../secrets-scanner';

export interface AuditResult {
  filepath: string;
  sstiIssues: string[];
  redosIssues: string[];
  longPasswordDosIssues: string[];
  secretExposureIssues: string[];
  pastejackingIssues: string[];
}

export function auditFile(filepath: string, content: string): AuditResult {
  const result: AuditResult = {
    filepath,
    sstiIssues: [],
    redosIssues: [],
    longPasswordDosIssues: [],
    secretExposureIssues: [],
    pastejackingIssues: []
  };

  // 1. SSTI Checks
  if (content.includes('eval(') && !filepath.includes('test-suite')) {
    result.sstiIssues.push('Found eval() invocation');
  }
  if (content.includes('new Function(')) {
    result.sstiIssues.push('Found new Function() instantiation');
  }
  if (content.includes('vm.runInContext') || content.includes('vm.runInNewContext')) {
    result.sstiIssues.push('Found Node VM execution context invocation');
  }

  // 2. ReDoS Checks: find all regex literals
  const unsafePatterns = [
    /\([a-zA-Z0-9\-_|.]+\+\)\+/,
    /\(\.\*\)\+/,
    /\([a-zA-Z0-9\-_]+|[a-zA-Z0-9\-_]+\)\+/,
    /(\w+\|\w+)\+/
  ];
  const regexMatches = content.match(/\/((?![*+?])(?:[^\r\n\[\/\\]|\\.|\[(?:[^\r\n\]\\]|\\.)*\])+)\/[gimy]*/g);
  if (regexMatches) {
    for (const match of regexMatches) {
      const isUnsafePattern = unsafePatterns.some((pattern) => pattern.test(match));
      if (isUnsafePattern && !checkRegexSafety(match)) {
        result.redosIssues.push(`Potential unsafe regex pattern detected: ${match}`);
      }
    }
  }

  // 3. Long Password DoS: check if there's password validation without max constraint
  if (content.includes('password') && (content.includes('z.string()') || content.includes('zod'))) {
    if (content.includes('password') && !content.includes('max(') && !content.includes('maxLength')) {
      result.longPasswordDosIssues.push('Zod schema validation for password lacks .max() or maxLength check, risking Long Password DoS');
    }
  }

  // 4. Secret Exposure
  const secretsResult = scanCodeForSecrets(content, filepath);
  if (secretsResult.hasSecrets) {
    result.secretExposureIssues.push(...secretsResult.findings);
  }

  // 5. Pastejacking: verify clipboard actions use navigator.clipboard.writeText
  if (content.includes('execCommand') && content.includes('copy')) {
    result.pastejackingIssues.push("Unsafe pastejacking vector: uses deprecated document.execCommand('copy') instead of navigator.clipboard.writeText()");
  }

  return result;
}

export function runFullCodeAudit(dirPath: string): AuditResult[] {
  const results: AuditResult[] = [];

  function walk(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;
    const files = fs.readdirSync(currentDir);
    for (const file of files) {
      const fullPath = path.join(currentDir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!file.includes('node_modules') && !file.includes('.next') && !file.includes('.git') && !file.includes('sent_emails')) {
          walk(fullPath);
        }
      } else if (stat.isFile() && /\.(tsx|ts|js|jsx)$/.test(file)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const audit = auditFile(fullPath, content);
        if (
          audit.sstiIssues.length > 0 ||
          audit.redosIssues.length > 0 ||
          audit.longPasswordDosIssues.length > 0 ||
          audit.secretExposureIssues.length > 0 ||
          audit.pastejackingIssues.length > 0
        ) {
          results.push(audit);
        }
      }
    }
  }

  walk(dirPath);
  return results;
}

export function generateMarkdownReport(results: AuditResult[], outputPath: string) {
  const lines: string[] = [
    '# AI-Generated Code Security Audit Report',
    '',
    `Audit executed at: ${new Date().toISOString()}`,
    `Total vulnerable files audited: ${results.length}`,
    '',
    '## Vulnerability Breakdown by File',
    ''
  ];

  if (results.length === 0) {
    lines.push('✓ No LLM-generated code vulnerabilities identified in the active codebase.');
  } else {
    for (const r of results) {
      lines.push(`### File: [${path.basename(r.filepath)}](file:///${r.filepath.replace(/\\/g, '/')})`);
      lines.push('');
      if (r.sstiIssues.length > 0) {
        lines.push('#### SSTI Warnings');
        r.sstiIssues.forEach(i => lines.push(`- [ ] ${i}`));
      }
      if (r.redosIssues.length > 0) {
        lines.push('#### ReDoS / Unsafe Regex Warnings');
        r.redosIssues.forEach(i => lines.push(`- [ ] ${i}`));
      }
      if (r.longPasswordDosIssues.length > 0) {
        lines.push('#### Long Password DoS Warnings');
        r.longPasswordDosIssues.forEach(i => lines.push(`- [ ] ${i}`));
      }
      if (r.secretExposureIssues.length > 0) {
        lines.push('#### Secret Exposure Warnings');
        r.secretExposureIssues.forEach(i => lines.push(`- [ ] ${i}`));
      }
      if (r.pastejackingIssues.length > 0) {
        lines.push('#### Pastejacking / Clipboard Warnings');
        r.pastejackingIssues.forEach(i => lines.push(`- [ ] ${i}`));
      }
      lines.push('');
    }
  }

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
}
