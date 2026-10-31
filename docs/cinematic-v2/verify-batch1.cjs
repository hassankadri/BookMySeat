// Repeatable Batch 1 preservation and lint-rule checks. No application writes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { createRequire } = require('module');
const root = path.resolve(__dirname, '../..');
const frontend = path.join(root, 'frontend');
const dep = createRequire(path.join(frontend, 'package.json'));
const { ESLint } = dep('eslint');
const inventory = require('./SOURCE_INVENTORY.json');
async function main() {
  process.chdir(frontend); // Resolve React for the same lint environment as npm run lint.
  const changed = inventory.files.filter(file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file.file), 'utf8')).digest('hex') !== file.sha256).map(file => file.file);
  const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
  const protectedDiff = execFileSync('git', ['diff', '--name-only', 'HEAD', '--', 'backend', 'docker-compose.yml', '.github', 'monitoring', 'frontend/Dockerfile', 'frontend/nginx.conf', 'frontend/craco.config.js', 'frontend/package-lock.json'], { cwd: root, encoding: 'utf8' }).trim();
  const lint = new ESLint({ cwd: frontend });
  // Invalid sample exists only in memory, never in the application or fixtures.
  const [sample] = await lint.lintText('import { useState } from "react"; function Example({ready}) { const unused = 1; if (ready) useState(0); return missingName; } export default Example;', { filePath: path.join(frontend, 'src/lint-config-probe.jsx') });
  const rules = sample.messages.map(({ ruleId, severity }) => ({ ruleId, severity }));
  const rulesWork = ['react-hooks/rules-of-hooks', 'no-undef'].every(rule => rules.some(item => item.ruleId === rule && item.severity === 2)) && rules.some(item => item.ruleId === 'no-unused-vars');
  const artifacts = ['CONTRACT_INDEX.md', 'SOURCE_INVENTORY.json', 'RUNTIME_CHECKS.json'].map(file => ({ file, exists: fs.existsSync(path.join(__dirname, file)) }));
  const report = { branch, originalSourceFilesChecked: inventory.files.length, originalSourceFilesChanged: changed, protectedTrackedDiff: protectedDiff, lintRuleProbe: rules, artifacts, status: branch === 'feature/cinematic-ui-v2' && !changed.length && !protectedDiff && rulesWork && artifacts.every(a => a.exists) ? 'PASS' : 'FAIL' };
  fs.writeFileSync(path.join(__dirname, 'BATCH1_PROTECTION_CHECKS.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
