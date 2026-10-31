/* Read-only application audit; writes reports only under docs/cinematic-v2. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createRequire } = require('module');
const root = path.resolve(__dirname, '../..');
const dep = createRequire(path.join(root, 'frontend/package.json'));
const parser = dep('@babel/parser');
const traverse = dep('@babel/traverse').default;
const slash = p => p.replace(/\\/g, '/');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  if (['node_modules', '.git', 'build', 'dist'].includes(e.name)) return [];
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : [p];
});
const files = [...walk(path.join(root, 'frontend/src')), ...walk(path.join(root, 'backend'))]
  .filter(p => /\.(js|jsx)$/.test(p)).sort();
const report = { scope: 'Local working copy; static inventory, not runtime proof. Backups excluded. Source references retain original line numbers.', files: [], routes: [], endpoints: [], mounts: [], requests: [], socketEvents: [], storage: [], states: [], effects: [], actions: [], navigation: [], providers: [], environmentNames: [], parseErrors: [] };
const raw = (src, n) => n ? src.slice(n.start, n.end) : '';
const compact = s => s.replace(/\s+/g, ' ').trim();
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const rel = slash(path.relative(root, file));
  let ast;
  try { ast = parser.parse(source, { sourceType: 'unambiguous', plugins: ['jsx'] }); }
  catch (e) { report.parseErrors.push({ file: rel, error: e.message }); continue; }
  const at = n => ({ file: rel, line: n.loc.start.line });
  const code = n => compact(raw(source, n));
  const imports = [];
  traverse(ast, {
    ImportDeclaration(p) { imports.push({ source: p.node.source.value, names: p.node.specifiers.map(s => s.local.name) }); },
    JSXOpeningElement(p) {
      const n = p.node;
      const name = code(n.name);
      const attrs = Object.fromEntries(n.attributes.filter(a => a.type === 'JSXAttribute').map(a => [a.name.name, a.value?.value ?? code(a.value)]));
      if (name === 'Route') {
        const parents = p.getAncestry().filter(a => a.node.type === 'JSXElement' && a.node.openingElement !== n && code(a.node.openingElement.name) === 'Route');
        const prefix = parents.map(a => a.node.openingElement.attributes.find(b => b.name?.name === 'path')?.value?.value).filter(Boolean).reverse().join('/');
        report.routes.push({ ...at(n), path: (prefix + '/' + (attrs.path || '')).replace(/\/+/g, '/'), element: attrs.element });
      }
      if (/Provider$/.test(name) || name === 'Elements' || name === 'BrowserRouter') report.providers.push({ ...at(n), name, attributes: attrs });
      for (const [key, value] of Object.entries(attrs)) {
        if (/^on[A-Z]/.test(key)) report.actions.push({ ...at(n), element: name, event: key, handler: value });
        if (['to', 'href', 'action'].includes(key)) report.navigation.push({ ...at(n), element: name, attribute: key, target: value });
      }
    },
    VariableDeclarator(p) {
      const n = p.node;
      if (n.init?.type === 'CallExpression' && /(?:^|\.)(useState|useReducer|useRef|useMemo|useContext|useAuth|useBooking|useLocation|useParams|useSearchParams)$/.test(code(n.init.callee))) {
        report.states.push({ ...at(n), binding: code(n.id), hook: code(n.init.callee), initialOrDependencies: n.init.arguments.map(code) });
      }
    },
    MemberExpression(p) {
      const s = code(p.node);
      if (/^process\.env\.[A-Z_]+$/.test(s)) report.environmentNames.push({ ...at(p.node), name: s });
    },
    CallExpression(p) {
      const n = p.node;
      const callee = code(n.callee).replace(/\s+/g, '');
      const args = n.arguments.map(code);
      const base = { ...at(n), callee, arguments: args };
      if (/^(app|router)\.(get|post|put|patch|delete|use)$/.test(callee)) {
        const method = callee.split('.')[1];
        const route = n.arguments[0]?.type === 'StringLiteral' ? n.arguments[0].value : '';
        if (method === 'use') report.mounts.push({ ...at(n), path: route, middleware: args.map(a => a.length > 240 ? a.slice(0, 240) + '…' : a) });
        else {
          const handler = n.arguments[n.arguments.length - 1];
          const handlerSource = raw(source, handler);
          const inlineHandler = /FunctionExpression$/.test(handler?.type || '');
          report.endpoints.push({ ...at(n), method: method.toUpperCase(), path: route, middleware: n.arguments.slice(1, inlineHandler ? -1 : undefined).map(code), requestFields: [...new Set(handlerSource.match(/req\.(?:body|params|query|headers)(?:\??\.[A-Za-z_$][\w$]*)*/g) || [])], statusCodes: [...new Set([...handlerSource.matchAll(/\.status\((\d+)\)/g)].map(m => Number(m[1])))] });
        }
      }
      if (/^axios\.(get|post|put|patch|delete|request)$/.test(callee) || callee === 'fetch' || /^stripe\.(confirm|redirect|retrieve)/.test(callee)) report.requests.push(base);
      if (/\.(emit|on|off)$/.test(callee) || callee === 'emitToShow' || callee === 'emitWithAck') {
        if (/socket|io\.|emitToShow|emitWithAck/i.test(callee)) report.socketEvents.push({ ...base, arguments: args.map(a => a.length > 500 ? a.slice(0, 500) + '…' : a) });
      }
      if (/(localStorage|sessionStorage)\.(getItem|setItem|removeItem)/.test(callee)) report.storage.push(base);
      if (/(?:^|\.)useEffect$/.test(callee)) report.effects.push({ ...at(n), dependencies: args[1] || '(every render)', body: args[0] });
      if (/^(navigate|apiGet|requestApi|getJson|postJson|updateBooking|resetBooking)$/.test(callee) || /\.(assign|replace)$/.test(callee) && /location/.test(callee)) report.navigation.push(base);
    },
  });
  report.files.push({ file: rel, lines: source.split('\n').length, sha256: crypto.createHash('sha256').update(source).digest('hex'), imports });
}
fs.writeFileSync(path.join(__dirname, 'SOURCE_INVENTORY.json'), JSON.stringify(report, null, 2) + '\n');
const esc = value => String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
let md = '# Source contract index\n\nGenerated with `node docs/cinematic-v2/audit-source.cjs`. This is a static index of the local source, not proof that integrations work. Mounted route prefixes must be read with router middleware below. Every entry has a source location. Full state initializers, effect dependencies, action handlers, imports, HTTP arguments and storage operations are in SOURCE_INVENTORY.json.\n\n';
md += `Parsed ${report.files.length} application/backend JavaScript files; ${report.parseErrors.length} parse errors.\n\n`;
md += '## Browser routes\n\n| Route | Element | Source |\n|---|---|---|\n';
for (const r of report.routes) md += `| ${esc(r.path)} | ${esc(r.element)} | ${r.file}:${r.line} |\n`;
md += '\n## Server route declarations\n\nLocal paths below include all handlers, including compatibility and preflight handlers. They are not all unique public endpoints. See mount table for prefixes and inherited guards.\n\n| Method | Local path | Middleware | Source |\n|---|---|---|---|\n';
for (const e of report.endpoints) md += `| ${e.method} | ${esc(e.path)} | ${esc(e.middleware.join(', '))} | ${e.file}:${e.line} |\n`;
md += '\n## Router mounts and middleware\n\n| Path | Middleware / child router | Source |\n|---|---|---|\n';
for (const e of report.mounts) md += `| ${esc(e.path || '(same prefix)')} | ${esc(e.middleware.join(', '))} | ${e.file}:${e.line} |\n`;
md += '\n## Frontend requests\n\n| Call | URL / argument | Source |\n|---|---|---|\n';
for (const e of report.requests.filter(e => e.file.startsWith('frontend/'))) md += `| ${esc(e.callee)} | ${esc(e.arguments[0])} | ${e.file}:${e.line} |\n`;
md += '\n## Persistent storage operations\n\n| Operation | Key | Source |\n|---|---|---|\n';
for (const e of report.storage) md += `| ${esc(e.callee)} | ${esc(e.arguments[0])} | ${e.file}:${e.line} |\n`;
fs.writeFileSync(path.join(__dirname, 'CONTRACT_INDEX.md'), md);
console.log(JSON.stringify(Object.fromEntries(Object.entries(report).filter(([,v]) => Array.isArray(v)).map(([k,v]) => [k,v.length])), null, 2));
