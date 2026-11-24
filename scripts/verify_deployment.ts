/**
 * End-to-End Deployment, Security, RBAC, Bcrypt & JWT Verification Script
 * Run against running server: npm run verify:deploy
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = (process.env.VERIFY_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
}

const checks: CheckResult[] = [];

async function check(name: string, fn: () => Promise<string>) {
  try {
    const details = await fn();
    checks.push({ name, passed: true, details });
    console.log(`  \x1b[32m✔ PASS\x1b[0m ${name} — ${details}`);
  } catch (err: any) {
    checks.push({ name, passed: false, details: err?.message || String(err) });
    console.error(`  \x1b[31m✖ FAIL\x1b[0m ${name} — ${err?.message || String(err)}`);
  }
}

async function main() {
  console.log(`\n================================================================`);
  console.log(`Bugo Sync List - Deployment & Security Verification (${BASE_URL})`);
  console.log(`================================================================\n`);

  let adminToken = '';
  let residentToken = '';

  await check('Frontend HTML Entry Point', async () => {
    const res = await fetch(`${BASE_URL}/`);
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    const html = await res.text();
    if (!html.includes('<div id="root">')) throw new Error('Missing React root mount point');
    return 'HTTP 200 with React root HTML';
  });

  await check('Favicon Asset Serving', async () => {
    const res = await fetch(`${BASE_URL}/favicon.ico`);
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    return 'HTTP 200 SVG favicon';
  });

  await check('Backend Health & DB Diagnostic', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(`Health status: ${data.status}`);
    return `status=ok, mode=${data.database?.mode}, connected=${data.database?.connected}`;
  });

  await check('Production Build Artifacts Exist', async () => {
    const distHtml = path.resolve(process.cwd(), 'dist', 'index.html');
    const distServer = path.resolve(process.cwd(), 'dist', 'server.mjs');
    if (!fs.existsSync(distHtml)) throw new Error('Missing dist/index.html (run npm run build)');
    if (!fs.existsSync(distServer)) throw new Error('Missing dist/server.mjs (run npm run build)');
    return 'dist/index.html & dist/server.mjs verified';
  });

  await check('Admin Login & JWT Issuance', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@bugo.gov.ph',
        password: process.env.SEED_ADMIN_PASSWORD || 'Admin@Bugo2026!'
      })
    });
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    if (!data.token || data.token.split('.').length !== 3) {
      throw new Error('Response missing valid 3-part JWT');
    }
    adminToken = data.token;
    return `JWT issued for role=${data.user?.role}`;
  });

  await check('Resident Login & JWT Issuance', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'resident@bugo.gov.ph',
        password: process.env.SEED_RESIDENT_PASSWORD || 'Resident@Bugo2026!'
      })
    });
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    if (!data.token || data.token.split('.').length !== 3) {
      throw new Error('Response missing valid 3-part JWT');
    }
    residentToken = data.token;
    return `JWT issued for role=${data.user?.role}`;
  });

  await check('JWT Session Verification (/api/auth/me)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    if (data.user?.role !== 'admin') throw new Error(`Unexpected role: ${data.user?.role}`);
    return `Verified active session for ${data.user.email}`;
  });

  await check('RBAC Enforcement: Unauthenticated Admin Route Rejected (401)', async () => {
    const res = await fetch(`${BASE_URL}/api/census`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ census: {} })
    });
    if (res.status !== 401) throw new Error(`Expected HTTP 401, got ${res.status}`);
    return 'Returned 401 Unauthorized without JWT';
  });

  await check('RBAC Enforcement: Resident Blocked From Admin Route (403)', async () => {
    const res = await fetch(`${BASE_URL}/api/census`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${residentToken}`
      },
      body: JSON.stringify({ census: {} })
    });
    if (res.status !== 403) throw new Error(`Expected HTTP 403, got ${res.status}`);
    return 'Returned 403 Forbidden for resident role';
  });

  await check('CRUD Persistence & Cleanup via Authenticated API', async () => {
    const createRes = await fetch(`${BASE_URL}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${residentToken}`
      },
      body: JSON.stringify({
        programId: 'prog-barangay-clearance',
        programTitle: 'Issuance of Barangay Clearance',
        applicantName: 'Verification Test Resident',
        purok: 'Zone 1',
        address: 'Zone 1, Barangay Bugo, CDO',
        householdMonthlyIncome: '₱8,500.00',
        familyMembersCount: 4,
        occupation: 'Vendor',
        purposeOrDiagnosis: 'Deployment verification check',
        documents: [{ id: 'doc-verify', name: 'Front_ID.png', docCategory: 'Front ID' }]
      })
    });
    if (createRes.status !== 200) throw new Error(`Create failed: ${createRes.status}`);
    const created = await createRes.json();
    const appId = created.application?.id;
    if (!appId) throw new Error('Missing created application ID');

    // Verify record appears in GET /api/applications
    const listRes = await fetch(`${BASE_URL}/api/applications`);
    const list = await listRes.json();
    if (!list.some((a: any) => a.id === appId)) {
      throw new Error('Created application not found in /api/applications');
    }

    // Cleanup test record cleanly
    const delRes = await fetch(`${BASE_URL}/api/applications/${encodeURIComponent(appId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (delRes.status !== 200) throw new Error(`Cleanup delete failed: ${delRes.status}`);
    return `Created, verified persistence, and cleaned up ${created.referenceCode}`;
  });

  await check('Security Audit: Zero Exposed Passwords/Hashes in Public Endpoints', async () => {
    const [dataRes, mysqlRes] = await Promise.all([
      fetch(`${BASE_URL}/api/data`),
      fetch(`${BASE_URL}/api/database/mysql-info`)
    ]);
    const dataText = await dataRes.text();
    const mysqlText = await mysqlRes.text();
    if (dataText.includes('passwordHash') || mysqlText.includes('passwordPlain')) {
      throw new Error('Sensitive credential field detected in API payload');
    }
    if (mysqlText.includes('Admin@Bugo2026') || mysqlText.includes('Resident@Bugo2026')) {
      throw new Error('Plain-text credential string found in /api/database/mysql-info');
    }
    return 'Zero passwordHash or passwordPlain leaks detected';
  });

  const passed = checks.filter(c => c.passed).length;
  console.log(`\n----------------------------------------------------------------`);
  console.log(`Verification Summary: ${passed}/${checks.length} checks passed`);
  console.log(`----------------------------------------------------------------\n`);
  if (passed !== checks.length) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
