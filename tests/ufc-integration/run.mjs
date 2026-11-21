import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = fileURLToPath(new URL('../../', import.meta.url));
const projectId = 'demo-ufc-integration';
const host = '127.0.0.1';
const ports = { next: 48311, api: 48312, database: 48313, firestore: 48314, storage: 48315, auth: 48316, tls: 48317, hub: 48318, logging: 48319, websocket: 48320 };
// Check before Firebase can encounter or reuse an existing emulator/hub.
const probes = [];
try {
  for (const port of Object.values(ports)) {
    const probe = createServer();
    await new Promise((resolve, reject) => probe.once('error', reject).listen(port, host, resolve));
    probes.push(probe);
  }
} finally {
  await Promise.all(probes.map(probe => new Promise(resolve => probe.close(resolve))));
}

const scratch = mkdtempSync(join(tmpdir(), 'raffles-ufc-e2e-'));
const env = {
  ...process.env,
  CI: '1', FIREBASE_CLI_DISABLE_MOTD: '1', NEXT_TELEMETRY_DISABLED: '1',
  GCLOUD_PROJECT: projectId, GOOGLE_CLOUD_PROJECT: projectId,
  FIREBASE_CONFIG: JSON.stringify({ projectId, databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`, storageBucket: `${projectId}.appspot.com` }),
  NEXT_PUBLIC_API_BASE_URL: `http://${host}:${ports.api}/api`,
  NEXT_PUBLIC_QUICK_TICKET_BASE_URL: `http://${host}:${ports.api}/quick-ticket`,
  NEXT_PUBLIC_BASE_URL: `http://${host}:${ports.next}`,
  NEXT_FONT_GOOGLE_MOCKED_RESPONSES: join(scratch, 'tests/ufc-integration/font.cjs'),
  UFC_FIXTURE_API: `http://${host}:${ports.api}`,
};
for (const key of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'NODE_OPTIONS', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'FIREBASE_DATABASE_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) delete env[key];
function run(file, args) {
  const result = spawnSync(file, args, { cwd: scratch, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${file} failed (${result.status ?? result.signal})`);
}
try {
  // Copy the current worktree, including uncommitted changes, but never env,
  // build output, Firebase login files, or a live project's CLI config.
  mkdirSync(join(scratch, 'functions'));
  for (const path of ['app', 'public', 'postcss.config.mjs', 'tailwind.config.ts', 'tsconfig.json', 'package.json', 'middleware.ts', 'storage.rules', 'functions/src', 'functions/tsconfig.json', 'tests/ufc-integration']) {
    cpSync(join(root, path), join(scratch, path), { recursive: true });
  }
  for (const path of ['node_modules', 'functions/node_modules']) symlinkSync(join(root, path), join(scratch, path), 'dir');
  cpSync(join(root, 'next.config.mjs'), join(scratch, 'next.original.mjs'));
  writeFileSync(join(scratch, 'next.config.mjs'), `import original from './next.original.mjs';
export default { ...original, webpack(config, { webpack }) {
  config.plugins.push(new webpack.NormalModuleReplacementPlugin(/(?:^|\\/)firebaseconfig(?:\\.js)?$/, ${JSON.stringify(join(scratch, 'tests/ufc-integration/firebase-client.js'))}));
  return config;
} };`);
  writeFileSync(join(scratch, 'firebase.json'), JSON.stringify({
    database: { rules: 'tests/ufc-integration/database.rules.json' },
    firestore: { rules: 'tests/ufc-integration/firestore.rules' },
    storage: { rules: 'storage.rules' },
    emulators: {
      ...Object.fromEntries(['database', 'firestore', 'storage', 'auth', 'hub', 'logging'].map(key => [key, { host, port: ports[key] }])),
      firestore: { host, port: ports.firestore, websocketPort: ports.websocket },
      ui: { enabled: false },
    },
  }));
  run('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=127.0.0.1', '-keyout', 'storage.key', '-out', 'storage.crt']);
  // The integration run is not a lint gate for unrelated in-progress exports.
  run(process.execPath, ['functions/node_modules/typescript/bin/tsc', '-p', 'functions/tsconfig.json', '--noUnusedLocals', 'false']);
  run('firebase', ['--non-interactive', 'emulators:exec', '--project', projectId, '--only', 'auth,database,firestore,storage', 'node node_modules/@playwright/test/cli.js test --config tests/ufc-integration/playwright.config.ts']);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (process.exitCode || process.env.KEEP_UFC_TEST_ARTIFACTS === '1') console.log(`Test logs and artifacts: ${scratch}`);
  else rmSync(scratch, { recursive: true, force: true });
}
