const { readFileSync } = require('node:fs');
const { request } = require('node:http');
const https = require('node:https');

const project = 'demo-ufc-integration';
const host = '127.0.0.1';
// Refuse to load the real handler without its isolated Admin SDK targets.
const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
if (process.env.GCLOUD_PROJECT !== project || firebaseConfig.projectId !== project ||
    firebaseConfig.databaseURL !== `https://${project}-default-rtdb.firebaseio.com` ||
    process.env.FIREBASE_DATABASE_EMULATOR_HOST !== `${host}:48313` ||
    process.env.FIRESTORE_EMULATOR_HOST !== `${host}:48314`) {
  throw new Error('Start this server only via the demo emulator runner');
}
const express = require('../../functions/node_modules/express');
const { createTransferSale } = require('../../functions/lib/index.js');
const admin = require('../../functions/node_modules/firebase-admin');
const db = admin.firestore();
const rtdb = admin.database();

async function start() {
  const now = Date.now();
  const date = new Date(now + 86400000).toISOString();
  const cutoffMs = Date.parse(date);
  const market = {
    title: 'Alba Torres vs. Bea Rivera', description: 'Isolated fight fixture',
    date, pricePerTicket: 100,
    teams: { a: 'Alba Torres', b: 'Bea Rivera' }, oddsTeamA: '1.0', oddsTeamB: '1.0',
    betsTeamA: 3, betsTeamB: 5, tieBets: 0, totalBets: 8, initialPool: 0,
    isFinished: false, createdAt: now,
    // Frozen pilot terms (retained at market creation in production):
    frozenFeeBps: 1000, officialSourceUrl: 'https://www.ufc.com/event/fixture-fight',
  };
  const ufcRules = { version: 1, methodPriceCents: 2015 };
  const legacy = { ...market, title: 'Legacy three-way fight' };
  const pilotMarket = {
    ufcRules, teams: market.teams, cutoffMs, basePriceCents: 10000,
    frozenFeeBps: market.frozenFeeBps, officialSourceUrl: market.officialSourceUrl,
    orderCount: 0, reviewedCount: 0,
  };
  await Promise.all([
    rtdb.ref('bets/fixture-ufc').set({ ...market, ufcRules, firestoreId: 'mirror-ufc' }),
    rtdb.ref('bets/fixture-legacy').set({ ...legacy, firestoreId: 'mirror-legacy' }),
    db.doc('bets/mirror-ufc').set({ ...market, ufcRules }),
    db.doc('bets/mirror-legacy').set(legacy),
    db.doc('ufcPilotMarkets/fixture-ufc').set(pilotMarket),
    db.doc('appConfig/storefront').set({
      bankAccount: '0000000000000000', bankName: 'Fixture only — do not pay',
      contactEmail: 'fixture@example.test', contactPhones: ['0000000000'],
    }),
  ]);

  const tls = https.createServer({ key: readFileSync('storage.key'), cert: readFileSync('storage.crt') }, (req, res) => {
    const upstream = request({ hostname: host, port: 48315, path: req.url, method: req.method, headers: req.headers }, response => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
    upstream.on('error', () => { res.writeHead(502); res.end('Storage emulator unreachable'); });
    req.pipe(upstream);
  });
  await new Promise((resolve, reject) => tls.once('error', reject).listen(48317, host, resolve));

  const app = express();
  app.use(express.json());
  app.all('/api/createTransferSale', createTransferSale);
  app.get('/__test/ready', (_req, res) => res.sendStatus(200));
  app.get('/__test/salesBets/:id', async (req, res, next) => {
    try {
      if (!/^transfer_\d{16}$/.test(req.params.id)) return res.sendStatus(400);
      const snap = await db.doc(`salesBets/${req.params.id}`).get();
      if (!snap.exists) return res.sendStatus(404);
      res.json(snap.data());
    } catch (error) { next(error); }
  });
  app.listen(48312, host);
}
start().catch(error => { console.error(error); process.exit(1); });
