import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import crypto from 'crypto';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import helmet from 'helmet';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { evaluateApplicantEligibility, evaluateCertificateQualification, evaluateResidentForProgram, findExistingProgramApplication, getQualifiedProgramsForResident, hasVerifiedStudentDocument, isBarangayServiceApplicationItem, isCertificateProgram, isDisasterProgram, isWalkInOrOnDemandService } from './src/utils/eligibilityEngine';
import { resolveProgramFromAnnouncementText } from './src/utils/announcementTargetMatcher';
import {
  canonicalizeIdCategory,
  matchApplicantNameWithId,
  matchApplicantBirthdateWithId,
  matchApplicantIdNumberWithId,
  matchApplicantIdNumberAcrossSides,
  isIdNumberPrefixMatch,
  matchApplicantGenderWithId,
  matchApplicantCivilStatusWithId,
  matchApplicantAddressWithId,
  matchFrontAndBackIdConsistency,
  matchIdTypeWithProfile,
  isNonIdDocumentFilename,
} from './src/utils/idNameMatcher';
import { normalizePhMobileNumber, detectPhTelco } from './src/utils/phoneValidation';
import { sortProgramsAlphabetically, sortApplicationsFCFS } from './src/utils/sortUtils';
import { ALL_BARANGAY_SERVICES } from './src/data/servicesCatalog';
import { DEFAULT_BUGO_HAZARD_ZONES, createDefaultHazardSummaries } from './src/data/hazardDefaults';
import { isAllowedAccountEmail, normalizeAccountEmail, ALLOWED_EMAIL_DOMAIN_MESSAGE } from './src/utils/emailValidation';
import { generateValidIdPackageForResident } from './src/utils/residentValidIdGenerator';
import {
  extractKeywordsForRequirement,
  extractTextFromInlineDataUrl,
  getRequirementHintLabel,
  matchRequirementKeywords,
} from './src/utils/requirementKeywordMatcher';
import { matchProgramRequirementsWithAccount } from './src/utils/requirementMatcher';
import { isRealDocumentUrl } from './src/utils/realDocumentPdf';
import { checkDatabaseHealth, disconnectPrisma, isMySqlConfigured } from './src/lib/prisma';
import {
  deleteAnnouncementFromMySQL,
  deleteApplicationFromMySQL,
  deleteArchiveFromMySQL,
  deleteNotificationFromMySQL,
  deleteProgramFromMySQL,
  deleteUserFromMySQL,
  loadDatabaseFromMySQL,
  syncActivityLogToMySQL,
  syncAnnouncementToMySQL,
  syncApplicationToMySQL,
  syncArchiveToMySQL,
  syncCensusToMySQL,
  syncNotificationReadInMySQL,
  syncNotificationToMySQL,
  syncProgramToMySQL,
  syncUserToMySQL,
} from './src/lib/mysqlRepository';

// Ensure HMR is disabled in dev server per runtime environment constraints
process.env.DISABLE_HMR = 'true';

// Prevent process crashes on benign background errors
process.on('uncaughtException', (err: any) => {
  if (err?.code === 'EADDRINUSE' && (err?.port === 24678 || err?.message?.includes('24678'))) {
    return;
  }
  logServerError('uncaughtException', err);
});

process.on('unhandledRejection', (reason: any) => {
  logServerError('unhandledRejection', reason);
});

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

function getEffectivePort(): number {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  if (portIndex !== -1 && args[portIndex + 1]) {
    const parsed = parseInt(args[portIndex + 1], 10);
    if (!isNaN(parsed)) return parsed;
  }
  const portArg = args.find(a => a.startsWith('--port='));
  if (portArg) {
    const parsed = parseInt(portArg.split('=')[1], 10);
    if (!isNaN(parsed)) return parsed;
  }
  // In AI Studio dev environment, port 8080 is reserved for the nginx proxy; in production honor PORT directly
  if (process.env.PORT && (IS_PROD || process.env.PORT !== '8080')) {
    const parsed = parseInt(process.env.PORT, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return 3000;
}

function sanitizeEnvValue(raw?: string): string {
  const val = String(raw || '').trim();
  if (!val) return '';
  if (/^(bugo_sync_|MY_APP_URL$|your[_-]|replace_with_|placeholder|changeme|example[_-]|null$|undefined$)/i.test(val)) {
    return '';
  }
  return val;
}

const PORT = getEffectivePort();
const BCRYPT_ROUNDS = Math.min(14, Math.max(10, Number(sanitizeEnvValue(process.env.BCRYPT_ROUNDS)) || 12));
const rawJwtExpires = sanitizeEnvValue(process.env.JWT_EXPIRES_IN);
const JWT_EXPIRES_IN: jwt.SignOptions['expiresIn'] = rawJwtExpires
  ? (/^\d+$/.test(rawJwtExpires) ? Number(rawJwtExpires) : (rawJwtExpires as jwt.SignOptions['expiresIn']))
  : 7200;
const DEV_FALLBACK_JWT_SECRET = 'bugo-dev-only-jwt-secret-change-in-production';
const DEV_FALLBACK_HMAC_SECRET = 'bugo-sec-key-2026-cdo-secret';

const envJwtSecret = sanitizeEnvValue(process.env.JWT_SECRET);
const envHmacSecret = sanitizeEnvValue(process.env.HMAC_SECRET);

const JWT_SECRET =
  envJwtSecret && envJwtSecret !== DEV_FALLBACK_JWT_SECRET
    ? envJwtSecret
    : IS_PROD
    ? crypto.randomBytes(32).toString('hex')
    : DEV_FALLBACK_JWT_SECRET;

const HMAC_SECRET =
  envHmacSecret && envHmacSecret !== DEV_FALLBACK_HMAC_SECRET
    ? envHmacSecret
    : IS_PROD
    ? crypto.randomBytes(32).toString('hex')
    : DEV_FALLBACK_HMAC_SECRET;

if (IS_PROD && (!envJwtSecret || envJwtSecret === DEV_FALLBACK_JWT_SECRET)) {
  console.warn('WARNING: JWT_SECRET not set in production; generated an ephemeral runtime secret. Set JWT_SECRET in env for persistent sessions across restarts.');
}

if (IS_PROD && (!envHmacSecret || envHmacSecret === DEV_FALLBACK_HMAC_SECRET)) {
  console.warn('WARNING: HMAC_SECRET not set in production; generated an ephemeral runtime secret. Set HMAC_SECRET in env for persistent voucher signatures across restarts.');
}

const DB_FILE = path.resolve(process.cwd(), 'data', 'db.json');
const LOG_DIR = path.resolve(process.cwd(), 'logs');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'error.log');

function logServerError(context: string, error: any, meta?: Record<string, any>) {
  const entry = {
    level: 'error',
    timestamp: new Date().toISOString(),
    context,
    message: error?.message || String(error),
    ...(meta ? { meta } : {}),
  };
  console.error(JSON.stringify(entry));
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    fs.appendFileSync(ERROR_LOG_FILE, `${JSON.stringify({ ...entry, stack: error?.stack })}\n`, 'utf-8');
  } catch {
    // Ignore file logging errors on read-only containers
  }
}

function logInfo(event: string, meta?: Record<string, any>) {
  console.log(JSON.stringify({
    level: 'info',
    timestamp: new Date().toISOString(),
    event,
    ...(meta || {}),
  }));
}

// Initialize Gemini SDK with User-Agent telemetry
let aiClient: GoogleGenAI | null = null;
let cachedAiKey = '';

function getAiClient(): GoogleGenAI | null {
  const apiKey = sanitizeEnvValue(process.env.GEMINI_API_KEY);
  if (!apiKey) return null;
  if (!aiClient || cachedAiKey !== apiKey) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
    cachedAiKey = apiKey;
  }
  return aiClient;
}

getAiClient();

const modelCooldownUntil = new Map<string, number>();

const MAX_CONCURRENT_GEMINI_CALLS = 2;
let activeGeminiCalls = 0;
const geminiConcurrencyQueue: Array<() => void> = [];

async function withGeminiConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (activeGeminiCalls >= MAX_CONCURRENT_GEMINI_CALLS) {
    await new Promise<void>((resolve) => {
      geminiConcurrencyQueue.push(resolve);
    });
  }
  activeGeminiCalls += 1;
  try {
    return await fn();
  } finally {
    activeGeminiCalls = Math.max(0, activeGeminiCalls - 1);
    const next = geminiConcurrencyQueue.shift();
    if (next) next();
  }
}

function parseRetryDelayMs(rawText: string): number {
  const secJson = rawText.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i);
  if (secJson) {
    return Math.ceil(Number(secJson[1]) * 1000);
  }
  const minSecMatch = rawText.match(/retry in\s*(?:(\d+)m)?\s*(\d+(?:\.\d+)?)s/i);
  if (minSecMatch) {
    const mins = Number(minSecMatch[1] || 0);
    const secs = Number(minSecMatch[2] || 0);
    return Math.ceil((mins * 60 + secs) * 1000);
  }
  return 0;
}

function parseGeminiApiError(err: any): {
  statusCode: number;
  message: string;
  retryable: boolean;
  isQuotaExhausted: boolean;
  cooldownMs: number;
} {
  const rawMsg = String(err?.message || err || 'AI verification failed');
  let parsedCode = Number(err?.status || err?.code || 0);
  let parsedStatusText = '';
  let cleanMessage = rawMsg;

  try {
    const jsonStart = rawMsg.indexOf('{');
    if (jsonStart !== -1) {
      const parsed = JSON.parse(rawMsg.slice(jsonStart));
      if (parsed?.error) {
        parsedCode = Number(parsed.error.code || parsedCode);
        parsedStatusText = String(parsed.error.status || '');
        if (parsed.error.message) {
          cleanMessage = String(parsed.error.message);
        }
      }
    }
  } catch {
    // Use raw message fallback
  }

  const lower = `${rawMsg} ${parsedStatusText} ${cleanMessage}`.toLowerCase();
  const isInvalidApiKey =
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('api_key') ||
    lower.includes('invalid api key') ||
    lower.includes('missing api key');

  if (isInvalidApiKey) {
    return {
      statusCode: 500,
      message: 'Gemini API key is invalid or missing. Please verify GEMINI_API_KEY in Settings > Secrets.',
      retryable: false,
      isQuotaExhausted: false,
      cooldownMs: 0,
    };
  }
  if (parsedCode === 400 || lower.includes('invalid_argument')) {
    return {
      statusCode: 400,
      message: 'Invalid or corrupted image file. Please upload a valid JPG, PNG, or WEBP photo.',
      retryable: false,
      isQuotaExhausted: false,
      cooldownMs: 0,
    };
  }
  if (parsedCode === 403 || lower.includes('permission_denied')) {
    return {
      statusCode: 403,
      message: 'Gemini API access was denied. Please check your API key permissions in Settings > Secrets.',
      retryable: false,
      isQuotaExhausted: false,
      cooldownMs: 0,
    };
  }
  if (parsedCode === 404 || lower.includes('not_found') || lower.includes('not found for api version')) {
    return {
      statusCode: 503,
      message: 'Selected AI verification model is temporarily unavailable. Retrying with an alternate model.',
      retryable: true,
      isQuotaExhausted: false,
      cooldownMs: 30 * 60_000,
    };
  }
  if (parsedCode === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
    const parsedDelay = parseRetryDelayMs(rawMsg);
    const isPerDay = lower.includes('perday') || lower.includes('per day');
    const cooldownMs = parsedDelay > 0
      ? Math.min(Math.max(parsedDelay, 30_000), 6 * 60 * 60_000)
      : isPerDay
        ? 15 * 60_000
        : 60_000;
    return {
      statusCode: 429,
      message: 'AI verification quota limit reached temporarily. Please wait a moment and try again, or check your Gemini API plan/key in Settings > Secrets.',
      retryable: true,
      isQuotaExhausted: true,
      cooldownMs,
    };
  }
  const isLocalTimeoutOrAbort =
    err?.name === 'AbortError' ||
    err?.name === 'TimeoutError' ||
    lower.includes('this operation was aborted') ||
    lower.includes('timed out') ||
    lower.includes('etimedout');

  if (isLocalTimeoutOrAbort) {
    return {
      statusCode: 503,
      message: 'ID verification AI service timed out under load. Please try again in a few seconds.',
      retryable: true,
      isQuotaExhausted: false,
      cooldownMs: 4_000,
    };
  }
  if (
    parsedCode === 503 ||
    parsedCode === 502 ||
    parsedCode === 504 ||
    parsedCode === 500 ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('fetch failed') ||
    lower.includes('econnreset')
  ) {
    return {
      statusCode: 503,
      message: 'ID verification AI service is temporarily experiencing high demand. Please try again in a few seconds.',
      retryable: true,
      isQuotaExhausted: false,
      cooldownMs: 8_000,
    };
  }

  return {
    statusCode: 502,
    message: cleanMessage || 'Unable to verify image right now. Please try again.',
    retryable: true,
    isQuotaExhausted: false,
    cooldownMs: 15_000,
  };
}

async function generateGeminiVisionJson<T = any>(params: {
  client: GoogleGenAI;
  parts: any[];
  responseSchema: any;
  context: string;
}): Promise<{ data: T | null; errorInfo: { statusCode: number; message: string; retryable: boolean } | null }> {
  const candidates: Array<{ model: string; thinkingLevel?: ThinkingLevel; timeoutMs: number }> = [
    { model: 'gemini-3.1-flash-lite', timeoutMs: 12000 },
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW, timeoutMs: 14000 },
  ];

  const MAX_TOTAL_MS = 38000;
  const startedAt = Date.now();
  const orderedCandidates = [...candidates].sort((a, b) => {
    const aCooling = (modelCooldownUntil.get(a.model) || 0) > startedAt ? 1 : 0;
    const bCooling = (modelCooldownUntil.get(b.model) || 0) > startedAt ? 1 : 0;
    if (aCooling !== bCooling) return aCooling - bCooling;
    return (modelCooldownUntil.get(a.model) || 0) - (modelCooldownUntil.get(b.model) || 0);
  });

  // Multi-round exponential backoff with jitter across available models within bounded wall-clock SLA
  const roundBackoffMs = [0, 700, 1400];
  let lastErrInfo: { statusCode: number; message: string; retryable: boolean; isQuotaExhausted?: boolean } | null = null;
  let lastRawErr: any = null;
  const skippedModels = new Set<string>();

  for (let round = 0; round < roundBackoffMs.length; round += 1) {
    const activeModels = orderedCandidates.filter((c) => !skippedModels.has(c.model));
    if (activeModels.length === 0) break;
    if (Date.now() - startedAt >= MAX_TOTAL_MS - 1500) break;

    if (round > 0) {
      const baseWait = roundBackoffMs[round];
      const jitter = Math.floor(Math.random() * 300);
      const remainingBeforeWait = MAX_TOTAL_MS - (Date.now() - startedAt);
      if (remainingBeforeWait <= 2000) break;
      await new Promise((r) => setTimeout(r, Math.min(baseWait + jitter, remainingBeforeWait - 1500)));
    }

    for (let idx = 0; idx < activeModels.length; idx += 1) {
      const plan = activeModels[idx];
      if (skippedModels.has(plan.model)) continue;

      const remainingBeforeCall = MAX_TOTAL_MS - (Date.now() - startedAt);
      if (remainingBeforeCall <= 1500) break;

      if (idx > 0) {
        const switchDelay = 200 + Math.floor(Math.random() * 150);
        await new Promise((r) => setTimeout(r, Math.min(switchDelay, remainingBeforeCall - 1000)));
      }

      const attemptTimeoutMs = Math.max(1500, Math.min(plan.timeoutMs, MAX_TOTAL_MS - (Date.now() - startedAt)));
      try {
        const config: Record<string, any> = {
          responseMimeType: 'application/json',
          responseSchema: params.responseSchema,
          abortSignal: AbortSignal.timeout(attemptTimeoutMs),
        };
        if (plan.thinkingLevel !== undefined) {
          config.thinkingConfig = { thinkingLevel: plan.thinkingLevel };
        }

        const response = await withGeminiConcurrencyLimit(() =>
          params.client.models.generateContent({
            model: plan.model,
            contents: { parts: params.parts },
            config,
          })
        );

        const responseText = (response.text || '{}').trim();
        const parsed = JSON.parse(responseText) as T;
        modelCooldownUntil.delete(plan.model);
        return { data: parsed, errorInfo: null };
      } catch (err: any) {
        lastRawErr = err;
        const errInfo = parseGeminiApiError(err);
        lastErrInfo = errInfo;

        if (errInfo.isQuotaExhausted || errInfo.cooldownMs >= 30 * 60_000) {
          skippedModels.add(plan.model);
        }
        if (errInfo.cooldownMs > 0) {
          modelCooldownUntil.set(plan.model, Date.now() + errInfo.cooldownMs);
        }

        if (!errInfo.retryable) {
          break;
        }
      }
    }

    if (lastErrInfo && !lastErrInfo.retryable) {
      break;
    }
  }

  if (lastRawErr) {
    logServerError(`${params.context}_failed`, lastRawErr, {
      statusCode: lastErrInfo?.statusCode,
      cleanMessage: lastErrInfo?.message,
    });
  }
  return {
    data: null,
    errorInfo: lastErrInfo
      ? { statusCode: lastErrInfo.statusCode, message: lastErrInfo.message, retryable: lastErrInfo.retryable }
      : null,
  };
}

const idVisionCache = new Map<
  string,
  { parsed: any; expectedTypeStr: string; expectedNameStr: string; expiresAt: number }
>();

const inFlightIdVisionRequests = new Map<
  string,
  Promise<{ data: any | null; errorInfo: { statusCode: number; message: string; retryable: boolean } | null }>
>();

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DB_FILE))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}

// ----------------------------------------------------
// 1. Password Hashing Utility (Bcrypt + Legacy PBKDF2 compatibility)
// ----------------------------------------------------
function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

function verifyPassword(password: string, stored: string): boolean {
  if (!stored || !password) return false;

  // Primary: Bcrypt ($2a$, $2b$, $2y$)
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    try {
      return bcrypt.compareSync(password, stored);
    } catch {
      return false;
    }
  }

  // Backward compatibility for seeded PBKDF2-SHA512 hashes (salt:hash)
  if (!stored.includes(':')) return false;
  const [salt, originalHash] = stored.split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
  } catch {
    return false;
  }
}

function validatePasswordStrengthServer(password: string): { isValid: boolean; message?: string } {
  if (!password || typeof password !== 'string') {
    return { isValid: false, message: 'Password is required.' };
  }
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must include at least one uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must include at least one lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must include at least one number (0-9).' };
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password)) {
    return { isValid: false, message: 'Password must include at least one special symbol (!@#$%^&* etc.).' };
  }
  return { isValid: true };
}

function matchesUserAccountEmail(user: { email?: string; username?: string } | null | undefined, normalizedEmail: string): boolean {
  if (!user || !normalizedEmail) return false;
  const emailMatch = String(user.email || '').trim().toLowerCase() === normalizedEmail;
  const usernameMatch = String((user as any).username || '').trim().toLowerCase() === normalizedEmail;
  return emailMatch || usernameMatch;
}

// ----------------------------------------------------
// 2. JWT Signing & RBAC Authorization Middleware
// ----------------------------------------------------
export interface AuthTokenPayload {
  sub: string;
  role: 'admin' | 'resident';
  email: string;
  residentIdNumber: string;
}

interface AuthenticatedRequest extends Request {
  authUser?: AuthTokenPayload;
}

function signAuthToken(user: {
  id: string;
  role: 'admin' | 'resident';
  email: string;
  residentIdNumber: string;
}): string {
  const payload: AuthTokenPayload = {
    sub: user.id,
    role: user.role,
    email: user.email,
    residentIdNumber: user.residentIdNumber,
  };
  try {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'bugo-sync-list',
    });
  } catch {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: 7200,
      issuer: 'bugo-sync-list',
    });
  }
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please sign in to obtain a valid JWT token.',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'bugo-sync-list' }) as AuthTokenPayload;
    const matchedUser = db.users.find(u => u.id === decoded.sub);
    if (!matchedUser) {
      return res.status(401).json({
        success: false,
        message: 'Authenticated account no longer exists.',
      });
    }
    if (matchedUser.isBanned || matchedUser.registrationStatus === 'Banned') {
      return res.status(403).json({
        success: false,
        message: `Account is banned: ${matchedUser.banReason || 'Administrative policy violation.'}`,
      });
    }
    req.authUser = {
      sub: matchedUser.id,
      role: matchedUser.role,
      email: matchedUser.email,
      residentIdNumber: matchedUser.residentIdNumber,
    };
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token. Please sign in again.',
    });
  }
}

function resolveOptionalResidentId(req: Request): string | null {
  const token = extractBearerToken(req);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'bugo-sync-list' }) as AuthTokenPayload;
    const matchedUser = db.users.find(u => u.id === decoded.sub);
    if (!matchedUser || matchedUser.role !== 'resident') return null;
    if (matchedUser.isBanned || matchedUser.registrationStatus === 'Banned') return null;
    return matchedUser.id;
  } catch {
    return null;
  }
}

function requireRole(...allowedRoles: Array<'admin' | 'resident'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Requires ${allowedRoles.join(' or ')} role privilege.`,
      });
    }
    return next();
  };
}

function requireSelfOrAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
  }
  const targetId = req.params.id;
  if (req.authUser.role === 'admin' || req.authUser.sub === targetId) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Forbidden: You may only modify your own resident record.',
  });
}

// ----------------------------------------------------
// 3. Cryptographic HMAC Token for QR Codes
// ----------------------------------------------------
function generateVoucherToken(refCode: string = '', applicantId: string = '', amount: string = ''): string {
  const safeRef = (refCode || '').trim().toUpperCase();
  const safeApplicant = (applicantId || 'resident').trim();
  const safeAmount = (amount || '0').trim();
  const payload = `${safeRef}:${safeApplicant}:${safeAmount}`;
  return crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
}

function verifyVoucherToken(refCode: string = '', applicantId: string = '', amount: string = '', token: string = ''): boolean {
  if (!token) return false;
  const expected = generateVoucherToken(refCode, applicantId, amount);
  try {
    return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// ----------------------------------------------------
// 4. Persistent Database Initialization (MySQL/Prisma + JSON fallback)
// ----------------------------------------------------
interface DatabaseSchema {
  users: Array<{
    id: string;
    email: string;
    username?: string;
    name: string;
    passwordHash: string;
    role: 'admin' | 'resident';
    contactNumber: string;
    purok: string;
    address: string;
    residentIdNumber: string;
    isVerified: boolean;
    registrationStatus: 'Verified' | 'Pending Approval' | 'Rejected' | 'Banned';
    isBanned?: boolean;
    banReason?: string;
    registeredDate: string;
    householdIncome?: string;
    familyMembersCount?: number;
    voterStatus?: 'Registered' | 'Unregistered';
    occupation?: string;
    employmentStatus?: string;
    nationality?: string;
    age?: number;
    gender?: string;
    birthdate?: string;
    civilStatus?: string;
    idType?: string;
    idNumber?: string;
    frontIdUrl?: string;
    backIdUrl?: string;
    idPhotoAnalysis?: any;
    backIdPhotoAnalysis?: any;
    isPwd?: boolean;
    pwdIdNumber?: string;
    isSenior?: boolean;
    seniorIdNumber?: string;
    isSoloParent?: boolean;
    soloParentIdNumber?: string;
    isStudent?: boolean;
    avatarUrl?: string;
    accountSource?: 'create_account' | 'admin_add_resident';
    pendingProfileUpdate?: any;
  }>;
  programs: any[];
  applications: any[];
  announcements: any[];
  activityLogs: any[];
  archivedItems: any[];
  notifications: any[];
  disasterVictims: any[];
  hazardZones: any[];
  hazardSummaries?: {
    flood: any[];
    landslide: any[];
    earthquake: any[];
    fire: any[];
    other: any[];
  };
  rankingClassifications?: any[];
  census?: any;
  deletedDefaultIds?: string[];
  secretariatDetails?: {
    lguUnit: string;
    punongBarangay: string;
    updatedAt?: string;
    updatedBy?: string;
  };
}

function getDeletedOrArchivedIds(database: DatabaseSchema): Set<string> {
  const ids = new Set<string>();
  if (Array.isArray(database.deletedDefaultIds)) {
    for (const id of database.deletedDefaultIds) {
      if (typeof id === 'string' && id.trim()) ids.add(id.trim());
    }
  }
  if (Array.isArray(database.archivedItems)) {
    for (const arch of database.archivedItems) {
      if (typeof arch?.referenceCode === 'string' && arch.referenceCode.trim()) {
        ids.add(arch.referenceCode.trim());
      }
      if (typeof arch?.originalData?.id === 'string' && arch.originalData.id.trim()) {
        ids.add(arch.originalData.id.trim());
      }
    }
  }
  return ids;
}

function markDeletedDefaultIds(database: DatabaseSchema, ids: Array<string | undefined | null>) {
  if (!Array.isArray(database.deletedDefaultIds)) {
    database.deletedDefaultIds = [];
  }
  const existing = new Set(database.deletedDefaultIds);
  for (const id of ids) {
    if (typeof id === 'string' && id.trim() && !existing.has(id.trim())) {
      existing.add(id.trim());
      database.deletedDefaultIds.push(id.trim());
    }
  }
}

function unmarkDeletedDefaultId(database: DatabaseSchema, id?: string | null) {
  if (!id || !Array.isArray(database.deletedDefaultIds)) return;
  const clean = id.trim();
  database.deletedDefaultIds = database.deletedDefaultIds.filter(item => item !== clean);
}

const DEFAULT_SECRETARIAT_DETAILS = {
  lguUnit: 'Barangay Bugo, Cagayan de Oro City',
  punongBarangay: 'Hon. Juan Dela Cruz',
};

function getEffectiveSecretariatDetails(database: DatabaseSchema) {
  return {
    lguUnit: String(database.secretariatDetails?.lguUnit || '').trim() || DEFAULT_SECRETARIAT_DETAILS.lguUnit,
    punongBarangay: String(database.secretariatDetails?.punongBarangay || '').trim() || DEFAULT_SECRETARIAT_DETAILS.punongBarangay,
    ...(database.secretariatDetails?.updatedAt ? { updatedAt: database.secretariatDetails.updatedAt } : {}),
    ...(database.secretariatDetails?.updatedBy ? { updatedBy: database.secretariatDetails.updatedBy } : {}),
  };
}

const stripZoneName = (val?: unknown): string =>
  String(val || '').replace(/(Zone\s+\d+)\s*-\s*[A-Za-z0-9\s]+(?=$|[,\.)"'])/gi, '$1').trim();

function initDefaultDatabase(): DatabaseSchema {
  const adminPassword = sanitizeEnvValue(process.env.SEED_ADMIN_PASSWORD) || (!IS_PROD ? 'Admin@Bugo2026!' : crypto.randomBytes(24).toString('hex'));
  const residentPassword = sanitizeEnvValue(process.env.SEED_RESIDENT_PASSWORD) || (!IS_PROD ? 'Resident@Bugo2026!' : crypto.randomBytes(24).toString('hex'));

  return {
    users: [
      {
        id: 'admin-juan-delacruz',
        name: 'Brgy. Bugo Admin',
        email: 'admin@bugo.gov.ph',
        username: 'admin@bugo.gov.ph',
        passwordHash: hashPassword(adminPassword),
        role: 'admin',
        contactNumber: '09922998218',
        purok: 'Zone 1',
        address: 'Barangay Bugo Administrative Complex, Cagayan de Oro City',
        residentIdNumber: 'BG-ADMIN-001',
        isVerified: true,
        registrationStatus: 'Verified',
        registeredDate: '2020-01-01',
        nationality: 'Filipino',
        occupation: 'Barangay Administrator & Secretary',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AdminCapitan&top=shortRound&facialHair=moustacheMagnum&clothing=blazerAndShirt&backgroundColor=d1d4f9'
      },
      {
        id: 'user-maria-santos',
        name: 'Joshua Abella Laurio',
        email: 'resident@bugo.gov.ph',
        username: 'resident@bugo.gov.ph',
        passwordHash: hashPassword(residentPassword),
        role: 'resident',
        contactNumber: '+639944772143',
        purok: 'Zone 3',
        address: 'Block 4 Lot 12, Zone 3, Barangay Bugo, Cagayan de Oro City',
        residentIdNumber: 'BG-2026-04829',
        isVerified: true,
        registrationStatus: 'Verified',
        registeredDate: '2025-03-14',
        householdIncome: '₱8,500.00 (Informal / Low Income)',
        familyMembersCount: 4,
        nationality: 'Filipino',
        voterStatus: 'Registered',
        occupation: 'Self-Employed / Market Vendor',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Joshua&top=shortFlat&facialHair=beardLight&clothing=collarAndSweater&backgroundColor=b6e3f4'
      }
    ],
    census: {
      totalPopulation: 36840,
      totalHouseholds: 9210,
      registeredVoters: 22450,
      seniorCitizens: 3140,
      workingAge: 22120,
      minors: 11580,
      purokBreakdown: [
        { purok: 'Zone 1', population: 4820, households: 1205 },
        { purok: 'Zone 2', population: 4150, households: 1038 },
        { purok: 'Zone 3', population: 3920, households: 980 },
        { purok: 'Zone 4', population: 3450, households: 863 },
        { purok: 'Zone 5', population: 3810, households: 953 },
        { purok: 'Zone 6', population: 3650, households: 912 },
        { purok: 'Zone 7', population: 2980, households: 745 },
        { purok: 'Zone 8', population: 3240, households: 810 },
        { purok: 'Zone 9', population: 3110, households: 778 },
        { purok: 'Zone 10', population: 3710, households: 926 }
      ],
      lastUpdated: '2026-11-01'
    },
    programs: ALL_BARANGAY_SERVICES,
    applications: [],
    announcements: [],
    activityLogs: [],
    archivedItems: [],
    notifications: [],
    disasterVictims: [],
    hazardZones: [...DEFAULT_BUGO_HAZARD_ZONES],
    hazardSummaries: createDefaultHazardSummaries(),
    rankingClassifications: [],
    deletedDefaultIds: [],
    secretariatDetails: { ...DEFAULT_SECRETARIAT_DETAILS }
  };
}

function loadDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      let modified = false;
      if ('complaints' in parsed) {
        delete parsed.complaints;
        modified = true;
      }
      const DEPRECATED_PROGRAM_IDS = new Set([
        'prog-health-consultation',
        'prog-health-checkup',
        'prog-health-free-medicines',
        'prog-health-immunization',
        'prog-health-maternal',
        'prog-health-family-planning',
        'prog-health-nutrition',
        'prog-health-tb-dots',
        'prog-health-dental',
        'prog-health-circumcision',
        'prog-social-seniors',
        'prog-social-pwd',
        'prog-social-solo-parent',
        'prog-medical-aid',
        'prog-medical-subsidy',
        'prog-social-wheelchair',
        'prog-educational-assistance',
        'prog-youth-scholarship',
        'prog-social-low-income',
        'prog-live-job-assistance',
        'prog-live-employment-referral',
        'prog-live-agricultural-assistance',
        'prog-live-seed-distribution',
        'prog-live-farming-support',
        'prog-legal-notarization',
        'prog-legal-consultation',
        'prog-legal-doc-assistance',
        'prog-emergency-disaster-prep',
        'prog-emergency-evacuation',
        'prog-emergency-safety-tanod',
        'prog-emergency-community-activities'
      ]);
      if (!Array.isArray(parsed.programs)) {
        parsed.programs = [...ALL_BARANGAY_SERVICES];
        modified = true;
      } else {
        const filteredPrograms = parsed.programs.filter((p: any) => !DEPRECATED_PROGRAM_IDS.has(p.id));
        if (filteredPrograms.length !== parsed.programs.length) {
          parsed.programs = filteredPrograms;
          modified = true;
        }
        const defaultById = new Map(ALL_BARANGAY_SERVICES.map(svc => [svc.id, svc]));
        parsed.programs = parsed.programs.map((p: any) => {
          const def = defaultById.get(p.id);
          if (p.id === 'prog-disaster-relief' && p.programType !== 'disaster') {
            modified = true;
            const { applicationMode: _dropMode, ...rest } = p;
            return {
              ...rest,
              programType: 'disaster',
              badgeText: 'Disaster Program',
              ...(def?.eligibilityCriteria ? { eligibilityCriteria: def.eligibilityCriteria } : {}),
            };
          }
          if (def && def.applicationMode && !p.applicationMode) {
            modified = true;
            return { ...p, applicationMode: def.applicationMode };
          }
          return p;
        });
        const existingProgramIds = new Set(parsed.programs.map((p: any) => p.id));
        const deletedOrArchived = getDeletedOrArchivedIds(parsed);
        const missingDefaults = ALL_BARANGAY_SERVICES.filter(
          svc => !existingProgramIds.has(svc.id) && !deletedOrArchived.has(svc.id)
        );
        if (missingDefaults.length > 0) {
          parsed.programs = [...parsed.programs, ...missingDefaults];
          modified = true;
        }
      }
      if (!Array.isArray(parsed.disasterVictims)) {
        parsed.disasterVictims = [];
        modified = true;
      }
      if (!Array.isArray(parsed.hazardZones)) {
        parsed.hazardZones = [...DEFAULT_BUGO_HAZARD_ZONES];
        modified = true;
      }
      const defaultSummaries = createDefaultHazardSummaries();
      if (!parsed.hazardSummaries || typeof parsed.hazardSummaries !== 'object') {
        parsed.hazardSummaries = defaultSummaries;
        modified = true;
      } else {
        for (const key of ['flood', 'landslide', 'earthquake', 'fire', 'other'] as const) {
          if (!Array.isArray(parsed.hazardSummaries[key]) || parsed.hazardSummaries[key].length === 0) {
            parsed.hazardSummaries[key] = defaultSummaries[key];
            modified = true;
          }
        }
      }
      if (!Array.isArray(parsed.rankingClassifications)) {
        parsed.rankingClassifications = [];
        modified = true;
      }
      if ('smsLogs' in parsed) {
        delete parsed.smsLogs;
        modified = true;
      }
      if (Array.isArray(parsed.announcements)) {
        const validResidentIds = new Set(
          (parsed.users || []).filter((u: any) => u?.role === 'resident').map((u: any) => String(u.id))
        );
        for (const ann of parsed.announcements) {
          if (ann && ('smsDispatch' in ann || 'deliveryChannels' in ann)) {
            delete ann.smsDispatch;
            delete ann.deliveryChannels;
            modified = true;
          }
          if (ann) {
            const rawViewedBy = Array.isArray(ann.viewedBy) ? ann.viewedBy.map(String) : [];
            const cleanViewedBy = Array.from(new Set(rawViewedBy.filter((uid: string) => validResidentIds.has(uid))));
            if (
              !Array.isArray(ann.viewedBy) ||
              ann.viewedBy.length !== cleanViewedBy.length ||
              ann.viewsCount !== cleanViewedBy.length
            ) {
              ann.viewedBy = cleanViewedBy;
              ann.viewsCount = cleanViewedBy.length;
              modified = true;
            }
          }
        }
      }
      if (!parsed.census) {
        parsed.census = initDefaultDatabase().census;
        modified = true;
      }
      if (!parsed.secretariatDetails || !parsed.secretariatDetails.lguUnit || !parsed.secretariatDetails.punongBarangay) {
        parsed.secretariatDetails = getEffectiveSecretariatDetails(parsed);
        modified = true;
      }
      if (ensureRecoveredAccounts(parsed)) {
        modified = true;
      }
      if (ensureResidentValidIds(parsed)) {
        modified = true;
      }
      const PLACEHOLDER_PHONE_MAP: Record<string, string> = {
        '09171110000': '09922998218',
        '09175554321': '+639944772143',
        '09648865491': '+639944772143',
        '09170000001': '09274819362',
        '09170000000': '09183947261',
      };
      const JOSHUA_LEGACY_PHONES = new Set(['09175554321', '09648865491', '09944772143', '639944772143']);
      if (Array.isArray(parsed.users)) {
        for (const u of parsed.users) {
          if (u.email) {
            const normEmail = normalizeAccountEmail(u.email);
            if (u.email !== normEmail) {
              u.email = normEmail;
              modified = true;
            }
            if (!u.username || String(u.username).trim().toLowerCase() !== normEmail) {
              u.username = normEmail;
              modified = true;
            }
          }
          const digits = String(u.contactNumber || '').replace(/\D/g, '');
          if (u.id === 'user-maria-santos' && JOSHUA_LEGACY_PHONES.has(digits) && u.contactNumber !== '+639944772143') {
            u.contactNumber = '+639944772143';
            modified = true;
          } else if (PLACEHOLDER_PHONE_MAP[digits]) {
            u.contactNumber = PLACEHOLDER_PHONE_MAP[digits];
            modified = true;
          }
        }
      }
      if (Array.isArray(parsed.applications)) {
        for (const a of parsed.applications) {
          const digits = String(a.contactNumber || '').replace(/\D/g, '');
          if (a.applicantId === 'user-maria-santos' && JOSHUA_LEGACY_PHONES.has(digits) && a.contactNumber !== '+639944772143') {
            a.contactNumber = '+639944772143';
            modified = true;
          } else if (PLACEHOLDER_PHONE_MAP[digits]) {
            a.contactNumber = PLACEHOLDER_PHONE_MAP[digits];
            modified = true;
          }
        }
      }
      if (Array.isArray(parsed.disasterVictims)) {
        for (const v of parsed.disasterVictims) {
          const digits = String(v.contactNumber || '').replace(/\D/g, '');
          if (v.residentId === 'user-maria-santos' && JOSHUA_LEGACY_PHONES.has(digits) && v.contactNumber !== '+639944772143') {
            v.contactNumber = '+639944772143';
            modified = true;
          } else if (PLACEHOLDER_PHONE_MAP[digits]) {
            v.contactNumber = PLACEHOLDER_PHONE_MAP[digits];
            modified = true;
          }
        }
      }
      if (Array.isArray(parsed.archivedItems)) {
        for (const arch of parsed.archivedItems) {
          if (arch?.originalData && typeof arch.originalData === 'object') {
            const origDigits = String(arch.originalData.contactNumber || '').replace(/\D/g, '');
            if (PLACEHOLDER_PHONE_MAP[origDigits]) {
              arch.originalData.contactNumber = PLACEHOLDER_PHONE_MAP[origDigits];
              modified = true;
            }
            if (typeof arch.originalData.purok === 'string') {
              const stripped = stripZoneName(arch.originalData.purok);
              if (stripped && stripped !== arch.originalData.purok) {
                arch.originalData.purok = stripped;
                modified = true;
              }
            }
          }
        }
      }
      // Strip zone area suffixes ("Zone N - <Name>" -> "Zone N") across loaded collections
      const normalizePurokField = (obj: any) => {
        if (obj && typeof obj.purok === 'string') {
          const stripped = stripZoneName(obj.purok);
          if (stripped && stripped !== obj.purok) {
            obj.purok = stripped;
            modified = true;
          }
        }
      };
      if (Array.isArray(parsed.users)) parsed.users.forEach(normalizePurokField);
      if (Array.isArray(parsed.applications)) parsed.applications.forEach(normalizePurokField);
      if (Array.isArray(parsed.disasterVictims)) parsed.disasterVictims.forEach(normalizePurokField);
      if (Array.isArray(parsed.hazardZones)) parsed.hazardZones.forEach(normalizePurokField);
      if (Array.isArray(parsed.rankingClassifications)) parsed.rankingClassifications.forEach(normalizePurokField);
      if (Array.isArray(parsed.activityLogs)) parsed.activityLogs.forEach(normalizePurokField);
      if (Array.isArray(parsed.census?.purokBreakdown)) parsed.census.purokBreakdown.forEach(normalizePurokField);

      if (Array.isArray(parsed.notifications)) {
        const beforeCount = parsed.notifications.length;
        parsed.notifications = parsed.notifications.filter((n: any) => {
          if (!n) return false;
          const title = String(n.title || '');
          const msg = String(n.message || '');
          const docType = String(n.documentData?.docType || '');
          if (title.startsWith('Qualified Programs Segregated')) return false;
          if (title.startsWith('Qualified:')) return false;
          if (docType === 'Barangay Auto-Qualification Notice') return false;
          if (title === 'Registration Auto-Validated via Application') return false;
          if (title === 'Resident Profile Updated by Administrator') return false;
          if (title === 'Account Verified' && msg.startsWith('Account verified automatically via ')) return false;
          if (msg.includes('automatically qualified for') || msg.includes('you automatically qualify for:') || msg.includes('Your resident profile qualifies for')) return false;
          if (title.includes('Temp Flood Isolation Test') || title.includes('Temp Custom Pet')) return false;
          return true;
        });
        if (parsed.notifications.length !== beforeCount) {
          modified = true;
        }
      }

      if (modified) saveDatabase(parsed);
      return parsed;
    }
  } catch (err) {
    logServerError('loadDatabase', err);
  }
  const defaults = initDefaultDatabase();
  ensureRecoveredAccounts(defaults);
  ensureResidentValidIds(defaults);
  saveDatabase(defaults);
  return defaults;
}

function ensureRecoveredAccounts(database: DatabaseSchema): boolean {
  if (!Array.isArray(database.users)) {
    database.users = [];
  }
  const deletedOrArchived = getDeletedOrArchivedIds(database);
  if (deletedOrArchived.has('user-kylene-polinar')) {
    return false;
  }
  const targetEmail = 'polinar.kylenekae@gmail.com';
  const existing = database.users.find(u => String(u.email || '').trim().toLowerCase() === targetEmail);
  if (existing) {
    return false;
  }

  database.users.push({
    id: 'user-kylene-polinar',
    name: 'Kylene Kae Polinar',
    email: targetEmail,
    username: targetEmail,
    passwordHash: hashPassword('Kylene1234!'),
    role: 'resident',
    contactNumber: '09274819362',
    purok: 'Zone 1',
    address: 'Barangay Bugo, Cagayan de Oro City',
    residentIdNumber: 'BG-2026-04901',
    isVerified: true,
    registrationStatus: 'Verified',
    registeredDate: '2026-11-16',
    householdIncome: '₱8,500.00 (Informal / Low Income)',
    familyMembersCount: 4,
    nationality: 'Filipino',
    voterStatus: 'Registered',
    occupation: 'Resident',
    employmentStatus: 'Self-Employed',
    civilStatus: 'Single',
    age: 24,
    gender: 'Female',
    accountSource: 'create_account',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=KylenePolinar&top=straight02&facialHairProbability=0&clothing=shirtVNeck&backgroundColor=ffd5dc',
  } as any);
  return true;
}

function ensureResidentValidIds(database: DatabaseSchema): boolean {
  if (!Array.isArray(database.users)) return false;
  let updated = false;
  for (const user of database.users) {
    if (!user || user.role !== 'resident') continue;
    const missingValidId =
      !user.idType ||
      !user.idNumber ||
      !user.frontIdUrl ||
      !user.backIdUrl;
    if (!missingValidId) continue;

    const generated = generateValidIdPackageForResident({
      ...user,
      civilStatus: user.civilStatus as any,
      gender: user.gender as any,
      employmentStatus: user.employmentStatus as any,
    });
    user.idType = generated.idType;
    user.idNumber = generated.idNumber;
    if (!user.birthdate) {
      user.birthdate = generated.birthdate;
    }
    user.frontIdUrl = generated.frontIdUrl;
    user.backIdUrl = generated.backIdUrl;
    user.idPhotoAnalysis = generated.idPhotoAnalysis;
    user.backIdPhotoAnalysis = generated.backIdPhotoAnalysis;
    updated = true;
  }
  return updated;
}

function createArchiveEntry(
  database: DatabaseSchema,
  params: {
    title: string;
    originalCategory: 'Resident Record' | 'Service Application' | 'Program / Service' | 'Notice' | 'Document' | 'Disaster Victim' | 'Hazard Zone';
    referenceCode?: string;
    deletedBy: string;
    reasonForArchive: string;
    originalData: any;
  }
) {
  if (!Array.isArray(database.archivedItems)) {
    database.archivedItems = [];
  }
  const entry = {
    id: `arch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: params.title,
    originalCategory: params.originalCategory,
    referenceCode: params.referenceCode,
    deletedBy: params.deletedBy,
    deletedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    reasonForArchive: params.reasonForArchive,
    originalData: params.originalData,
    status: 'Archived' as const,
  };
  database.archivedItems.unshift(entry);
  persistAsync(syncArchiveToMySQL(entry), 'archive.autoCreate');
  return entry;
}

function sanitizeArchiveItem(item: any) {
  if (item?.originalData && typeof item.originalData === 'object' && ('passwordHash' in item.originalData || 'fcmToken' in item.originalData)) {
    const { passwordHash: _ph, fcmToken: _ft, ...safeOriginalData } = item.originalData;
    return { ...item, originalData: safeOriginalData };
  }
  return item;
}

function saveDatabase(database: DatabaseSchema): boolean {
  if (isMySqlConfigured()) {
    // Primary persistence is handled through Prisma MySQL repositories; avoid overwriting db.json unnecessarily in production MySQL mode
    if (IS_PROD) return true;
  }
  const tmpFile = `${DB_FILE}.tmp`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(database, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
    return true;
  } catch (err) {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {}
    logServerError('saveDatabase', err);
    return false;
  }
}

let db = loadDatabase();
let activePersistenceMode: 'mysql-prisma' | 'json-local' = 'json-local';

function persistAsync(task: Promise<void>, operationName: string) {
  task.catch(err => logServerError(`mysql-sync:${operationName}`, err));
}

// Real-time Server-Sent Events (SSE) hub for pushing live Admin edits/deletes to Resident sessions
const sseClients = new Set<Response>();

function broadcastSystemUpdate(entity: string, action: string, meta?: Record<string, any>) {
  if (sseClients.size === 0) return;
  const payload = JSON.stringify({
    entity,
    action,
    timestamp: new Date().toISOString(),
    ...(meta || {})
  });
  const frame = `event: system_update\ndata: ${payload}\n\n`;
  for (const client of Array.from(sseClients)) {
    try {
      client.write(frame);
    } catch {
      sseClients.delete(client);
    }
  }
}

function cascadeResidentUpdates(database: DatabaseSchema, updatedUser: any) {
  if (!updatedUser?.id) return;

  // 1. Cascade profile updates into linked resident service applications
  if (Array.isArray(database.applications)) {
    database.applications = database.applications.map((appItem: any) => {
      if (appItem.applicantId !== updatedUser.id) return appItem;
      const syncedApp = {
        ...appItem,
        applicantName: updatedUser.name || appItem.applicantName,
        contactNumber: updatedUser.contactNumber || appItem.contactNumber,
        email: updatedUser.email || appItem.email,
        purok: updatedUser.purok || appItem.purok,
        address: updatedUser.address || appItem.address,
        householdMonthlyIncome: updatedUser.householdIncome || appItem.householdMonthlyIncome,
        familyMembersCount: updatedUser.familyMembersCount ?? appItem.familyMembersCount,
        occupation: updatedUser.occupation || appItem.occupation
      };
      persistAsync(syncApplicationToMySQL(syncedApp), 'application.cascadeUser');
      return syncedApp;
    });
  }

  // 2. Cascade demographic & sector vulnerability updates into linked disaster victim records
  if (Array.isArray(database.disasterVictims)) {
    const derivedTags: string[] = [];
    if (updatedUser.isSenior || (updatedUser.age && Number(updatedUser.age) >= 60)) derivedTags.push('Senior');
    if (updatedUser.isPwd) derivedTags.push('PWD');
    if (updatedUser.isSoloParent) derivedTags.push('Solo Parent');
    if (updatedUser.age !== undefined && Number(updatedUser.age) < 18) derivedTags.push('Minor');

    database.disasterVictims = database.disasterVictims.map((victim: any) => {
      if (victim.residentId !== updatedUser.id) return victim;
      return {
        ...victim,
        fullName: updatedUser.name || victim.fullName,
        age: updatedUser.age ?? victim.age,
        contactNumber: updatedUser.contactNumber || victim.contactNumber,
        purok: updatedUser.purok || victim.purok,
        address: updatedUser.address || victim.address,
        householdSize: Math.max(1, Number(updatedUser.familyMembersCount ?? victim.householdSize) || 1),
        householdIncome: updatedUser.householdIncome || victim.householdIncome,
        vulnerabilityTags: derivedTags
      };
    });
  }
}

// Exact date & time formatter: e.g. "Nov 8, 2026 • 9:15 PM"
function getExactFormattedDate(d = new Date()): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${month} ${day}, ${year} • ${hours}:${minutes} ${ampm}`;
}

// Push notification safely with duplicate prevention
function addNotificationSafely(database: DatabaseSchema, notif: {
  userId?: string;
  title: string;
  message: string;
  type?: 'status_update' | 'announcement' | 'system' | 'registration_submitted' | 'registration_approved' | 'document_issued' | 'system_alert';
  applicationRef?: string;
  targetArea?: string;
  targetProgramId?: string;
  targetProgramTitle?: string;
  announcementId?: string;
  documentData?: any;
}) {
  if (!database.notifications) database.notifications = [];
  const isDuplicate = database.notifications.some((n: any) =>
    n.userId === notif.userId &&
    n.title === notif.title &&
    n.message === notif.message
  );
  if (isDuplicate) return null;

  const exactTime = getExactFormattedDate();
  const newNotif: any = {
    id: `notif-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    userId: notif.userId,
    title: notif.title,
    message: notif.message,
    timestamp: exactTime,
    createdAt: new Date().toISOString(),
    read: false,
    type: notif.type || 'status_update',
    applicationRef: notif.applicationRef,
    targetArea: notif.targetArea,
    ...(notif.targetProgramId ? { targetProgramId: notif.targetProgramId } : {}),
    ...(notif.targetProgramTitle ? { targetProgramTitle: notif.targetProgramTitle } : {}),
    ...(notif.announcementId ? { announcementId: notif.announcementId } : {}),
    documentData: notif.documentData
  };
  database.notifications.unshift(newNotif);
  persistAsync(syncNotificationToMySQL(newNotif), 'notification.create');
  return newNotif;
}

// ----------------------------------------------------
// 4B. PH Mobile Normalization & Targeted Notifications
// ----------------------------------------------------
function normalizePhMobile(raw?: string): {
  valid: boolean;
  isRealNumber: boolean;
  local09: string;
  e164: string;
  telco: string;
  cleanRaw: string;
  reason?: string;
} {
  const res = normalizePhMobileNumber(raw);
  return {
    valid: res.valid,
    isRealNumber: res.isRealNumber,
    local09: res.local09,
    e164: res.e164,
    telco: res.telco || (res.valid ? detectPhTelco(res.local09) : ''),
    cleanRaw: res.cleanRaw,
    reason: res.reason,
  };
}

async function dispatchTargetedScheduleNotifications(
  database: DatabaseSchema,
  announcement: any
) {
  const isTargeted = announcement?.targetAudienceType === 'Qualified Beneficiaries Only' && Boolean(announcement?.targetProgramId);
  if (announcement?.targetAudienceType === 'Qualified Beneficiaries Only' && !announcement?.targetProgramId) {
    return { createdNotifications: [] };
  }

  const targetProgram = announcement?.targetProgramId
    ? (database.programs || []).find((p: any) => p.id === announcement.targetProgramId)
    : undefined;
  const programTitle = targetProgram?.title || announcement.targetProgramTitle || announcement.title;
  const isServiceTarget = targetProgram ? isBarangayServiceApplicationItem(targetProgram) : false;

  interface QualifiedRecipient {
    id: string;
    name: string;
    contactNumber: string;
  }

  const recipientMap = new Map<string, QualifiedRecipient>();

  if (isTargeted && announcement?.targetProgramId) {
    for (const user of database.users || []) {
      if (user.role !== 'resident' || user.isBanned) continue;
      const evalRes = isServiceTarget
        ? evaluateCertificateQualification(user as any, announcement.targetProgramId, targetProgram as any)
        : evaluateResidentForProgram(
            user as any,
            announcement.targetProgramId,
            programTitle,
            targetProgram as any,
            { disasterVictims: database.disasterVictims || [] }
          );
      if (evalRes.isQualified) {
        recipientMap.set(user.id, {
          id: user.id,
          name: user.name,
          contactNumber: user.contactNumber || '',
        });
      }
    }

    for (const victim of database.disasterVictims || []) {
      const enrolledIds: string[] = Array.isArray(victim.enrolledProgramIds) ? victim.enrolledProgramIds : [];
      if (!enrolledIds.includes(announcement.targetProgramId)) continue;
      if (victim.selectionStatus !== 'Selected' && victim.selectionStatus !== 'Distributed') continue;
      const key = victim.residentId || `victim-${victim.id}`;
      const matchedUser = victim.residentId ? (database.users || []).find((u: any) => u.id === victim.residentId) : undefined;
      if (!recipientMap.has(key)) {
        recipientMap.set(key, {
          id: key,
          name: victim.fullName || 'Qualified Beneficiary',
          contactNumber: victim.contactNumber || matchedUser?.contactNumber || '',
        });
      } else if (!recipientMap.get(key)!.contactNumber && victim.contactNumber) {
        recipientMap.get(key)!.contactNumber = victim.contactNumber;
      }
    }

    if (isDisasterProgram((targetProgram as any) || { id: announcement.targetProgramId, title: announcement.targetProgramTitle })) {
      for (const app of database.applications || []) {
        if (app.programId !== announcement.targetProgramId) continue;
        if (!['Valid', 'Approved', 'Ready for Release', 'Disbursed'].includes(app.status)) continue;
        const matchedUser = (database.users || []).find(
          (u: any) =>
            (app.applicantId && u.id === app.applicantId) ||
            (app.email && u.email && u.email.toLowerCase() === String(app.email).toLowerCase())
        );
        const key = matchedUser?.id || app.applicantId || `app-${app.id}`;
        if (!recipientMap.has(key)) {
          recipientMap.set(key, {
            id: key,
            name: matchedUser?.name || app.applicantName || 'Qualified Beneficiary',
            contactNumber: matchedUser?.contactNumber || app.contactNumber || '',
          });
        }
      }
    }
  } else {
    for (const user of database.users || []) {
      if (user.role !== 'resident' || user.isBanned) continue;
      recipientMap.set(user.id, {
        id: user.id,
        name: user.name,
        contactNumber: user.contactNumber || '',
      });
    }
  }

  const recipients = Array.from(recipientMap.values());
  const createdNotifications: any[] = [];
  const notifTitle = announcement?.targetProgramId
    ? `Release Schedule: ${announcement.title}`
    : `Announcement: ${announcement.title}`;
  const notifMessage = announcement?.targetProgramId
    ? `Schedule for ${programTitle}: ${announcement.releaseDate || 'TBA'} · ${announcement.meetingTime || 'TBA'} at ${announcement.meetingVenue || 'Barangay Bugo Hall'}. ${announcement.instructions || ''}`.trim()
    : announcement.description || 'Barangay Bugo official advisory update.';

  if (announcement?.targetProgramId) {
    for (const recipient of recipients) {
      if (!recipient.id.startsWith('victim-')) {
        const created = addNotificationSafely(database, {
          userId: recipient.id,
          title: notifTitle,
          message: notifMessage,
          type: 'announcement',
          targetArea: isServiceTarget ? 'services' : 'dashboard',
          targetProgramId: targetProgram?.id || announcement.targetProgramId,
          targetProgramTitle: programTitle,
          announcementId: announcement.id,
          documentData: {
            docType: isServiceTarget ? 'Qualified Service Advisory Notice' : 'Qualified Beneficiary Schedule Notice',
            controlNumber: `ADV-2026-${String(announcement.id || Date.now()).slice(-4)}`,
            issueDate: getExactFormattedDate(),
            recipientName: recipient.name,
            subject: announcement.title,
            narrative: notifMessage,
            venueOrOffice: announcement.meetingVenue || 'Barangay Bugo Hall',
            officialRemarks: announcement.instructions || 'Please bring your valid ID.',
            signatoryName: getEffectiveSecretariatDetails(database).punongBarangay,
            signatoryRole: 'Punong Barangay',
          },
        });
        if (created) createdNotifications.push(created);
      }
    }
  }

  return { createdNotifications };
}

// ----------------------------------------------------
// 5. Rate Limiter (Brute-Force Protection)
// ----------------------------------------------------
interface RateLimitRecord {
  attempts: number;
  blockedUntil: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

function authRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (record && record.blockedUntil > now) {
    const waitSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return res.status(429).json({
      success: false,
      message: `Too many login attempts. Please wait ${waitSeconds} seconds before trying again.`
    });
  }

  next();
}

function recordFailedLogin(ip: string) {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { attempts: 0, blockedUntil: 0 };
  record.attempts += 1;

  if (record.attempts >= 5) {
    record.blockedUntil = now + 60 * 1000;
    record.attempts = 0;
  }
  rateLimitMap.set(ip, record);
}

function clearLoginAttempts(ip: string) {
  rateLimitMap.delete(ip);
}

// ----------------------------------------------------
// 6. Express App Security, CORS, TLS & Logging Setup
// ----------------------------------------------------
const app = express();
app.set('trust proxy', 1);

// HTTP Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: IS_PROD
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'blob:', 'https://www.google.com', 'https://www.gstatic.com', 'https://apis.google.com'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https://api.dicebear.com', 'https://*.tile.openstreetmap.org', 'https://tile.openstreetmap.org', 'https://www.gstatic.com'],
            connectSrc: [
              "'self'",
              'data:',
              'blob:',
              'https://nominatim.openstreetmap.org',
              'https://*.tile.openstreetmap.org',
              'https://tile.openstreetmap.org',
              'https://*.googleapis.com',
            ],
            frameSrc: ["'self'", 'blob:', 'data:'],
            childSrc: ["'self'", 'blob:'],
            workerSrc: ["'self'", 'blob:'],
            frameAncestors: ["'self'", 'https:'],
          },
        }
      : false,
    frameguard: false,
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// Explicit CORS Allowlist
const configuredCorsOrigins = sanitizeEnvValue(process.env.CORS_ORIGIN)
  .split(',')
  .map(s => sanitizeEnvValue(s).replace(/\/$/, ''))
  .filter(Boolean);
const sanitizedAppUrl = sanitizeEnvValue(process.env.APP_URL).replace(/\/$/, '');
if (sanitizedAppUrl) {
  configuredCorsOrigins.push(sanitizedAppUrl);
}
if (!IS_PROD) {
  configuredCorsOrigins.push(`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`);
}

app.use(
  cors((req, callback) => {
    const origin = req.headers.origin;
    if (!origin) {
      return callback(null, { origin: true, credentials: true });
    }
    const normalized = origin.replace(/\/$/, '');
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
    const isSameHost = Boolean(
      host && (normalized === `https://${host}` || normalized === `http://${host}`)
    );
    const isAllowed =
      isSameHost ||
      configuredCorsOrigins.includes(normalized) ||
      (!IS_PROD && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized));

    if (isAllowed) {
      return callback(null, {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      });
    }
    return callback(new Error('Origin not permitted by CORS policy'));
  })
);

// Enforce HTTPS redirect behind reverse proxy when enabled
if (IS_PROD && sanitizeEnvValue(process.env.FORCE_HTTPS) === 'true') {
  app.use((req, res, next) => {
    if (req.path === '/api/health') return next();
    const proto = req.headers['x-forwarded-proto'];
    if (req.secure || proto === 'https') return next();
    const host = req.headers.host;
    if (host) {
      return res.redirect(301, `https://${host}${req.originalUrl}`);
    }
    return next();
  });
}

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({
      success: false,
      message: 'Uploaded ID images are too large. Please attach smaller photos and try again.'
    });
  }
  if (err instanceof SyntaxError && 'body' in err && req.path.startsWith('/api')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON request payload.'
    });
  }
  return next(err);
});

// Request Monitoring Middleware (never logs credentials or sensitive payloads)
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  const startedAt = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    if (res.statusCode >= 500) {
      logServerError('http_5xx', new Error(`HTTP ${res.statusCode} on ${req.method} ${req.path}`), {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
      });
    } else if (sanitizeEnvValue(process.env.LOG_LEVEL) === 'debug') {
      logInfo('http_request', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
      });
    }
  });
  next();
});

// Health Check (verifies Express + Database connectivity)
app.get('/api/health', async (_req, res) => {
  const dbHealth = await checkDatabaseHealth();
  const healthy = dbHealth.connected;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    environment: NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    serverTime: new Date().toISOString(),
    database: {
      mode: activePersistenceMode,
      connected: dbHealth.connected,
      ...(dbHealth.latencyMs !== undefined ? { latencyMs: dbHealth.latencyMs } : {}),
    },
  });
});

// GET Full Database State
app.get('/api/data', (_req, res) => {
  // Omit password hashes in public payload
  const sanitizedUsers = db.users.map(({ passwordHash, ...rest }) => rest);
  const sanitizedArchives = (db.archivedItems || []).map(sanitizeArchiveItem);
  res.json({
    users: sanitizedUsers,
    programs: sortProgramsAlphabetically(db.programs || []),
    applications: sortApplicationsFCFS(db.applications || []).map((a, idx) => ({
      ...a,
      queueNumber: idx + 1,
    })),
    announcements: db.announcements,
    activityLogs: db.activityLogs,
    archivedItems: sanitizedArchives,
    notifications: db.notifications,
    disasterVictims: db.disasterVictims || [],
    hazardZones: db.hazardZones || [],
    hazardSummaries: db.hazardSummaries || createDefaultHazardSummaries(),
    rankingClassifications: [...(db.rankingClassifications || [])].sort((a: any, b: any) => {
      if ((a.priority ?? 5) !== (b.priority ?? 5)) return (a.priority ?? 5) - (b.priority ?? 5);
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    }),
    census: db.census,
    secretariatDetails: getEffectiveSecretariatDetails(db)
  });
});

// Real-Time Server-Sent Events (SSE) Stream for Live Admin -> Resident Synchronization
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  res.write(': connected\n\n');
  sseClients.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

const BUGO_ZONE_ANCHORS: Array<{ zone: string; keywords: string[]; lat: number; lng: number }> = [
  { zone: 'Zone 1', keywords: ['zone 1', 'purok 1', 'bantiles', 'bantiles creek', 'bugo central'], lat: 8.5055, lng: 124.7538 },
  { zone: 'Zone 2', keywords: ['zone 2', 'purok 2', 'greymar', 'reyes'], lat: 8.5048, lng: 124.7582 },
  { zone: 'Zone 3', keywords: ['zone 3', 'purok 3', 'suntingon', 'raboca', 'bugo national high'], lat: 8.5062, lng: 124.765 },
  { zone: 'Zone 4', keywords: ['zone 4', 'purok 4', 'national highway', 'bcir', 'butuan-cagayan', 'c.m. recto'], lat: 8.5082, lng: 124.7586 },
  { zone: 'Zone 5', keywords: ['zone 5', 'purok 5', 'market', 'public market', 'crossing', 'barangay hall'], lat: 8.5089, lng: 124.7574 },
  { zone: 'Zone 6', keywords: ['zone 6', 'purok 6', 'upper bugo', 'sapong', 'hills'], lat: 8.5005, lng: 124.7652 },
  { zone: 'Zone 7', keywords: ['zone 7', 'purok 7', 'upper bantiles'], lat: 8.5015, lng: 124.7615 },
  { zone: 'Zone 8', keywords: ['zone 8', 'purok 8', 'villa trinitas'], lat: 8.5112, lng: 124.7666 },
  { zone: 'Zone 9', keywords: ['zone 9', 'purok 9', 'bayside', 'coastal', 'macajalar'], lat: 8.5142, lng: 124.7524 },
  { zone: 'Zone 10', keywords: ['zone 10', 'purok 10', 'del monte', 'cannery', 'industrial', 'pier'], lat: 8.5083, lng: 124.7533 }
];

function matchBugoZoneFromTextAndCoords(text: string, lat: number, lng: number): string {
  const normalized = text.toLowerCase();
  // Check longer zone numbers first (Zone 10 before Zone 1)
  const orderedBySpecificity = [...BUGO_ZONE_ANCHORS].reverse();
  for (const anchor of orderedBySpecificity) {
    if (anchor.keywords.some(kw => normalized.includes(kw))) {
      return anchor.zone;
    }
  }
  let bestZone = BUGO_ZONE_ANCHORS[0].zone;
  let bestDist = Infinity;
  for (const anchor of BUGO_ZONE_ANCHORS) {
    const dLat = lat - anchor.lat;
    const dLng = lng - anchor.lng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < bestDist) {
      bestDist = dist;
      bestZone = anchor.zone;
    }
  }
  return bestZone;
}

// Server-side Reverse Geocoding Proxy (OpenStreetMap Nominatim)
app.get('/api/maps/reverse-geocode', async (req, res) => {
  const rawLat = String(req.query.lat ?? '').trim();
  const rawLng = String(req.query.lng ?? '').trim();
  const lat = rawLat === '' ? NaN : Number(rawLat);
  const lng = rawLng === '' ? NaN : Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ success: false, message: 'Valid lat and lng query parameters are required.' });
  }

  try {
    const osmUrl = new URL('https://nominatim.openstreetmap.org/reverse');
    osmUrl.searchParams.set('format', 'jsonv2');
    osmUrl.searchParams.set('lat', String(lat));
    osmUrl.searchParams.set('lon', String(lng));
    osmUrl.searchParams.set('zoom', '18');
    osmUrl.searchParams.set('addressdetails', '1');
    osmUrl.searchParams.set('accept-language', 'en');

    const osmResp = await fetch(osmUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BugoSyncList/1.0 (Barangay Bugo Disaster Hazard Map)'
      }
    });

    if (!osmResp.ok) {
      const fallbackZone = matchBugoZoneFromTextAndCoords('', lat, lng);
      return res.json({
        success: true,
        areaName: fallbackZone,
        formattedAddress: `${fallbackZone}, Barangay Bugo, Cagayan de Oro City`,
        matchedZone: fallbackZone,
        nearbyLandmark: '',
        suggestedTitle: fallbackZone,
        source: 'bugo-zone-fallback'
      });
    }

    const osmData: any = await osmResp.json();
    const addr = osmData?.address || {};
    const formattedAddress = String(osmData?.display_name || '').trim();
    const primaryDisplayName = String(osmData?.name || '').trim();
    const routeName = String(addr.road || addr.pedestrian || addr.footway || addr.path || '').trim();
    const neighborhoodName = String(
      addr.neighbourhood || addr.quarter || addr.suburb || addr.village || addr.hamlet || ''
    ).trim();
    const nearbyLandmark = String(
      addr.amenity || addr.building || addr.shop || addr.tourism || addr.leisure || ''
    ).trim();

    const combinedText = [
      primaryDisplayName,
      nearbyLandmark,
      routeName,
      neighborhoodName,
      formattedAddress
    ].filter(Boolean).join(' ');

    const matchedZone = matchBugoZoneFromTextAndCoords(combinedText, lat, lng);
    const shortZoneLabel = stripZoneName(matchedZone);

    const cleanNeighborhood = /^(bugo|cagayan de oro)$/i.test(neighborhoodName) ? '' : neighborhoodName;
    const specificPart =
      primaryDisplayName ||
      nearbyLandmark ||
      routeName ||
      cleanNeighborhood ||
      (formattedAddress ? formattedAddress.split(',')[0].replace(/^\d+\s+/, '').trim() : '');

    let areaName = specificPart || shortZoneLabel;
    if (/^unnamed road$/i.test(areaName)) {
      areaName = nearbyLandmark ? `Near ${nearbyLandmark}` : shortZoneLabel;
    }

    let suggestedTitle = areaName;
    if (areaName.toLowerCase() === shortZoneLabel.toLowerCase()) {
      suggestedTitle = shortZoneLabel;
    } else if (!areaName.toLowerCase().includes(shortZoneLabel.toLowerCase())) {
      suggestedTitle = `${areaName} (${shortZoneLabel})`;
    }

    if (nearbyLandmark && !suggestedTitle.toLowerCase().includes(nearbyLandmark.toLowerCase()) && areaName === shortZoneLabel) {
      suggestedTitle = `Near ${nearbyLandmark} (${shortZoneLabel})`;
    }

    return res.json({
      success: true,
      areaName,
      formattedAddress: formattedAddress || `${matchedZone}, Barangay Bugo, Cagayan de Oro City`,
      matchedZone,
      nearbyLandmark,
      suggestedTitle,
      source: formattedAddress || specificPart ? 'openstreetmap-nominatim' : 'bugo-zone-fallback'
    });
  } catch (err: any) {
    logServerError('maps.reverseGeocode', err);
    const fallbackZone = matchBugoZoneFromTextAndCoords('', lat, lng);
    return res.json({
      success: true,
      areaName: fallbackZone,
      formattedAddress: `${fallbackZone}, Barangay Bugo, Cagayan de Oro City`,
      matchedZone: fallbackZone,
      nearbyLandmark: '',
      suggestedTitle: fallbackZone,
      source: 'bugo-zone-fallback'
    });
  }
});

// Same-Origin Cached OpenStreetMap Tile Proxy (prevents browser/iframe 403 Referer blocks)
interface CachedOsmTile {
  buffer: Buffer;
  contentType: string;
  cachedAt: number;
}
const OSM_TILE_CACHE_MAX = 600;
const OSM_TILE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const osmTileCache = new Map<string, CachedOsmTile>();
const osmInFlightTiles = new Map<string, Promise<CachedOsmTile | null>>();

function storeCachedOsmTile(key: string, entry: CachedOsmTile) {
  if (osmTileCache.has(key)) osmTileCache.delete(key);
  osmTileCache.set(key, entry);
  if (osmTileCache.size > OSM_TILE_CACHE_MAX) {
    const oldestKey = osmTileCache.keys().next().value;
    if (oldestKey) osmTileCache.delete(oldestKey);
  }
}

async function fetchOsmTileUpstream(z: number, x: number, y: number, refererHeader: string): Promise<CachedOsmTile | null> {
  const upstreamUrls = [
    `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    `https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`,
    `https://b.tile.openstreetmap.org/${z}/${x}/${y}.png`
  ];

  for (const upstreamUrl of upstreamUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const upstreamRes = await fetch(upstreamUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'BugoSyncList/1.0 (Barangay Bugo Disaster Hazard Map; https://bugo.cagayandeoro.gov.ph)',
          'Referer': refererHeader,
          'Accept': 'image/png,image/webp,image/*;q=0.8'
        }
      }).finally(() => clearTimeout(timeout));

      const blockedHeader = upstreamRes.headers.get('x-blocked');
      const contentType = upstreamRes.headers.get('content-type') || '';
      if (!upstreamRes.ok || blockedHeader || !contentType.startsWith('image/')) {
        continue;
      }

      const arrayBuf = await upstreamRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      if (buffer.length === 0) continue;

      return {
        buffer,
        contentType,
        cachedAt: Date.now()
      };
    } catch {
      // Try next upstream mirror
    }
  }
  return null;
}

app.get('/api/maps/tiles/:z/:x/:y.png', async (req, res) => {
  const z = Number(req.params.z);
  const x = Number(req.params.x);
  const y = Number(req.params.y);

  if (
    !Number.isInteger(z) ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    z < 0 ||
    z > 19
  ) {
    return res.status(400).send('Invalid tile coordinates');
  }

  const maxIndex = Math.pow(2, z);
  if (x < 0 || x >= maxIndex || y < 0 || y >= maxIndex) {
    return res.status(400).send('Tile coordinates out of range');
  }

  const cacheKey = `${z}/${x}/${y}`;
  const cached = osmTileCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < OSM_TILE_CACHE_TTL_MS) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.send(cached.buffer);
  }

  const configuredOrigin = sanitizeEnvValue(process.env.APP_URL);
  const reqOrigin = req.headers.origin || (req.headers.host ? `${req.protocol}://${req.headers.host}/` : '');
  const refererHeader = configuredOrigin || reqOrigin || 'https://bugo.cagayandeoro.gov.ph/';

  let pending = osmInFlightTiles.get(cacheKey);
  if (!pending) {
    pending = fetchOsmTileUpstream(z, x, y, refererHeader).then((tile) => {
      if (tile) storeCachedOsmTile(cacheKey, tile);
      return tile;
    }).finally(() => {
      osmInFlightTiles.delete(cacheKey);
    });
    osmInFlightTiles.set(cacheKey, pending);
  }

  const tile = await pending;
  if (!tile) {
    return res.status(502).send('Unable to load OpenStreetMap tile');
  }

  res.setHeader('Content-Type', tile.contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  return res.send(tile.buffer);
});

// REST Collections Individual GET Endpoints
const SPECIFIC_DISASTER_CATEGORY_SET = new Set([
  'flood',
  'fire',
  'landslide',
  'earthquake',
  'typhoon / storm',
  'other'
]);

function doesVictimQualifyForDisasterProgram(
  victimDisasterType: string | undefined | null,
  program: { category?: string } | null | undefined
): boolean {
  if (!program) return false;
  const victimLower = String(victimDisasterType || '').trim().toLowerCase();
  if (!victimLower) return false;
  const catLower = String(program.category || '').trim().toLowerCase();
  if (SPECIFIC_DISASTER_CATEGORY_SET.has(catLower)) {
    return victimLower === catLower;
  }
  return true;
}

function getVictimResidentKey(victim: { residentId?: string; fullName?: string } | null | undefined): string {
  if (!victim) return '';
  if (victim.residentId && String(victim.residentId).trim()) {
    return `id:${String(victim.residentId).trim()}`;
  }
  return `name:${String(victim.fullName || '').trim().toLowerCase()}`;
}

app.get('/api/programs', (_req, res) => {
  res.json(sortProgramsAlphabetically(db.programs || []));
});

app.post('/api/programs', authenticateJWT, requireRole('admin'), (req, res) => {
  const {
    title,
    category,
    tagline,
    description,
    status,
    badgeText,
    deadline,
    targetAudience,
    processingTime,
    requirements,
    eligibilityCriteria,
    maxBenefitAmount,
    programType,
    applicationMode,
    autoEnrollVictims,
    qualificationRules
  } = req.body || {};

  const categoryStr = String(category || '').trim();
  const isServiceCategory =
    categoryStr === 'Barangay Administrative Services' ||
    categoryStr === 'Civil Registration Services' ||
    categoryStr === 'Clearance & Certification';

  const normalizedProgramType: 'regular' | 'disaster' | 'service' =
    programType === 'disaster' || (programType !== 'regular' && programType !== 'service' && autoEnrollVictims === true)
      ? 'disaster'
      : programType === 'service' || (programType !== 'regular' && isServiceCategory)
      ? 'service'
      : 'regular';

  const normalizedApplicationMode: 'automatic' | 'apply' | undefined =
    normalizedProgramType === 'regular'
      ? (applicationMode === 'apply' ? 'apply' : 'automatic')
      : undefined;

  if (
    !title ||
    !String(title).trim() ||
    !categoryStr ||
    (normalizedProgramType !== 'disaster' && (!description || !String(description).trim()))
  ) {
    return res.status(400).json({
      success: false,
      message: 'Title, category, and description are required.'
    });
  }

  const slug = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);

  // Disaster Programs are excluded from Qualified automation — only Admin manually selects qualifiers
  const shouldAutoEnroll = false;
  const programStatus = status === 'Open' || status === 'Closed' ? status : 'Active';
  const resolvedDescription =
    description && String(description).trim()
      ? String(description).trim()
      : `${categoryStr} disaster assistance program.`;

  const newProgram = {
    id: `prog-custom-${slug || 'service'}-${Date.now()}`,
    title: String(title).trim(),
    category: categoryStr,
    tagline: tagline ? String(tagline).trim() : resolvedDescription.slice(0, 110),
    description: resolvedDescription,
    imageUrl: normalizedProgramType === 'disaster'
      ? '/assets/services/brgy_disaster_rescue_1794197713383.jpg'
      : normalizedProgramType === 'service'
      ? '/assets/services/brgy_clearance_cert_1794197711166.jpg'
      : '/assets/services/real_barangay_hall_1788172230992.jpg',
    status: programStatus,
    badgeText: badgeText
      ? String(badgeText).trim()
      : normalizedProgramType === 'disaster'
      ? 'Disaster Program'
      : normalizedProgramType === 'service'
      ? 'Barangay Service'
      : normalizedApplicationMode === 'apply'
      ? 'Apply Program'
      : 'Auto-Matched Program',
    deadline: deadline ? String(deadline).trim() : 'Year-Round Service',
    targetAudience: targetAudience ? String(targetAudience).trim() : (normalizedProgramType === 'disaster' ? 'Affected Disaster Victims' : 'All Bugo Residents'),
    processingTime: processingTime ? String(processingTime).trim() : (normalizedProgramType === 'service' ? 'Same Day' : '1 - 3 Business Days'),
    requirements: Array.isArray(requirements)
      ? requirements.map((r: any) => String(r).trim()).filter(Boolean)
      : (normalizedProgramType === 'disaster' ? [] : ['Barangay Certificate of Residency']),
    eligibilityCriteria: Array.isArray(eligibilityCriteria)
      ? eligibilityCriteria.map((c: any) => String(c).trim()).filter(Boolean)
      : ['Resident of Barangay Bugo'],
    maxBenefitAmount: maxBenefitAmount ? String(maxBenefitAmount).trim() : (normalizedProgramType === 'service' ? 'Standard Certification' : 'Barangay Assistance'),
    programType: normalizedProgramType,
    ...(normalizedApplicationMode ? { applicationMode: normalizedApplicationMode } : {}),
    ...(qualificationRules && typeof qualificationRules === 'object' ? { qualificationRules } : {}),
    autoEnrollVictims: shouldAutoEnroll
  };

  db.programs.push(newProgram);
  db.programs = sortProgramsAlphabetically(db.programs);

  // Automatically enroll qualifying disaster victims (matching specific disaster category, no duplicate resident names)
  if (normalizedProgramType === 'disaster' && shouldAutoEnroll && programStatus !== 'Closed' && Array.isArray(db.disasterVictims)) {
    const enrolledResidentKeys = new Set<string>();
    db.disasterVictims = db.disasterVictims.map((victim: any) => {
      if (!doesVictimQualifyForDisasterProgram(victim.disasterType, newProgram)) {
        return victim;
      }
      const resKey = getVictimResidentKey(victim);
      if (resKey && enrolledResidentKeys.has(resKey)) {
        return victim;
      }
      if (resKey) enrolledResidentKeys.add(resKey);

      const ids: string[] = Array.isArray(victim.enrolledProgramIds) ? [...victim.enrolledProgramIds] : [];
      const titles: string[] = Array.isArray(victim.enrolledProgramTitles) ? [...victim.enrolledProgramTitles] : [];
      if (!ids.includes(newProgram.id)) ids.push(newProgram.id);
      if (!titles.includes(newProgram.title)) titles.push(newProgram.title);
      return {
        ...victim,
        enrolledProgramIds: ids,
        enrolledProgramTitles: titles
      };
    });
  }

  // Notify active residents only for newly added open programs, certifications, or disaster programs (never auto-qualification notices)
  const createdNotifications: any[] = [];
  if (programStatus !== 'Closed' && Array.isArray(db.users)) {
    const activeResidents = db.users.filter((u: any) => u.role === 'resident' && !u.isBanned);
    const isServiceItem = isBarangayServiceApplicationItem(newProgram as any);
    const isDisasterItem = isDisasterProgram(newProgram as any);
    const signatory = getEffectiveSecretariatDetails(db).punongBarangay;
    const issueDate = getExactFormattedDate();

    const notifTitle = isServiceItem
      ? `New Certification: ${newProgram.title}`
      : isDisasterItem
        ? `New Disaster Program: ${newProgram.title}`
        : `New Program: ${newProgram.title}`;
    const notifMessage = isServiceItem
      ? `Barangay Bugo added a new certification/service: "${newProgram.title}". ${newProgram.tagline || newProgram.description}`.trim()
      : isDisasterItem
        ? `Barangay Bugo opened a new disaster assistance program: "${newProgram.title}". ${newProgram.tagline || newProgram.description}`.trim()
        : `Barangay Bugo opened "${newProgram.title}" (${newProgram.targetAudience || 'Barangay Assistance'}). ${newProgram.tagline || newProgram.description}`.trim();
    const notifDocType = isServiceItem
      ? 'Barangay Bugo Certification Bulletin'
      : isDisasterItem
        ? 'Barangay Bugo Disaster Program Bulletin'
        : 'Barangay Bugo Program Bulletin';
    const notifTargetArea = isServiceItem ? 'services' : 'dashboard';

    for (const resident of activeResidents) {
      const createdNotif = addNotificationSafely(db, {
        userId: resident.id,
        title: notifTitle,
        message: notifMessage,
        type: 'announcement',
        targetArea: notifTargetArea,
        targetProgramId: newProgram.id,
        targetProgramTitle: newProgram.title,
        documentData: {
          docType: notifDocType,
          controlNumber: `PRG-2026-${newProgram.id.slice(-4).toUpperCase()}`,
          issueDate,
          recipientName: resident.name,
          subject: newProgram.title,
          narrative: `${newProgram.description} Target Audience: ${newProgram.targetAudience}.`,
          venueOrOffice: 'Barangay Bugo Assistance & Welfare Desk',
          officialRemarks: isServiceItem
            ? `Requirements: ${(newProgram.requirements || []).join(' • ') || newProgram.targetAudience}`
            : `Eligibility Criteria: ${(newProgram.eligibilityCriteria || []).join(' • ') || newProgram.targetAudience}`,
          signatoryName: signatory,
          signatoryRole: 'Punong Barangay'
        }
      });
      if (createdNotif) {
        createdNotifications.push(createdNotif);
      }
    }
  }

  saveDatabase(db);
  persistAsync(syncProgramToMySQL(newProgram), 'program.create');
  broadcastSystemUpdate('programs', 'create', { id: newProgram.id });
  if (createdNotifications.length > 0) {
    broadcastSystemUpdate('notifications', 'create', { programId: newProgram.id });
  }

  res.json({
    success: true,
    program: newProgram,
    disasterVictims: db.disasterVictims || [],
    createdNotifications
  });
});

app.patch('/api/programs/:id', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const idx = db.programs.findIndex(p => p.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Program or service not found.' });
  }

  const existing = db.programs[idx];
  const body = req.body || {};

  const nextTitle = body.title !== undefined && String(body.title).trim() ? String(body.title).trim() : existing.title;
  const nextCategory = body.category !== undefined && String(body.category).trim() ? String(body.category).trim() : existing.category;
  const nextDescription = body.description !== undefined ? String(body.description).trim() : existing.description;
  const nextTagline = body.tagline !== undefined
    ? String(body.tagline).trim()
    : (existing.tagline || nextDescription.slice(0, 110));
  const nextStatus = body.status === 'Active' || body.status === 'Open' || body.status === 'Closed'
    ? body.status
    : existing.status;

  const updatedProgram = {
    ...existing,
    title: nextTitle,
    category: nextCategory,
    tagline: nextTagline,
    description: nextDescription || existing.description,
    status: nextStatus,
    ...(body.badgeText !== undefined && { badgeText: String(body.badgeText).trim() }),
    ...(body.deadline !== undefined && { deadline: String(body.deadline).trim() }),
    ...(body.targetAudience !== undefined && { targetAudience: String(body.targetAudience).trim() }),
    ...(body.processingTime !== undefined && { processingTime: String(body.processingTime).trim() }),
    ...(body.maxBenefitAmount !== undefined && { maxBenefitAmount: String(body.maxBenefitAmount).trim() }),
    ...(Array.isArray(body.requirements) && {
      requirements: body.requirements.map((r: any) => String(r).trim()).filter(Boolean)
    }),
    ...(Array.isArray(body.eligibilityCriteria) && {
      eligibilityCriteria: body.eligibilityCriteria.map((c: any) => String(c).trim()).filter(Boolean)
    }),
    ...(body.programType !== undefined && { programType: body.programType }),
    ...(body.applicationMode !== undefined && { applicationMode: body.applicationMode }),
    ...(body.qualificationRules !== undefined && { qualificationRules: body.qualificationRules }),
    ...(body.autoEnrollVictims !== undefined && { autoEnrollVictims: Boolean(body.autoEnrollVictims) })
  };

  db.programs[idx] = updatedProgram;
  persistAsync(syncProgramToMySQL(updatedProgram), 'program.update');

  // Cascade title/category changes to linked applications
  const affectedApplicantIds = new Set<string>();
  if (Array.isArray(db.applications)) {
    db.applications = db.applications.map((appItem: any) => {
      const matchesProgram = appItem.programId === id || appItem.programTitle === existing.title;
      if (!matchesProgram) return appItem;
      if (appItem.applicantId) affectedApplicantIds.add(appItem.applicantId);
      const syncedApp = {
        ...appItem,
        programTitle: updatedProgram.title,
        programCategory: updatedProgram.category
      };
      persistAsync(syncApplicationToMySQL(syncedApp), 'application.cascadeProgram');
      return syncedApp;
    });
  }

  // Cascade title changes to targeted announcements
  if (Array.isArray(db.announcements) && updatedProgram.title !== existing.title) {
    db.announcements = db.announcements.map((ann: any) => {
      if (ann.targetProgramId !== id) return ann;
      const syncedAnn = { ...ann, targetProgramTitle: updatedProgram.title };
      persistAsync(syncAnnouncementToMySQL(syncedAnn), 'announcement.cascadeProgram');
      return syncedAnn;
    });
  }

  // Cascade title updates to enrolled disaster victims
  if (Array.isArray(db.disasterVictims)) {
    db.disasterVictims = db.disasterVictims.map((victim: any) => {
      if (!Array.isArray(victim.enrolledProgramIds) || !victim.enrolledProgramIds.includes(id)) {
        return victim;
      }
      const nextTitles = victim.enrolledProgramIds.map((pid: string) =>
        pid === id ? updatedProgram.title : (db.programs.find(p => p.id === pid)?.title || pid)
      );
      return { ...victim, enrolledProgramTitles: nextTitles };
    });
  }

  const createdNotifications: any[] = [];
  // Notify active residents when a previously Closed program/certification/disaster program is reopened
  if (existing.status === 'Closed' && updatedProgram.status !== 'Closed' && Array.isArray(db.users)) {
    const activeResidents = db.users.filter((u: any) => u.role === 'resident' && !u.isBanned);
    const isServiceItem = isBarangayServiceApplicationItem(updatedProgram as any);
    const isDisasterItem = isDisasterProgram(updatedProgram as any);
    const reopenTitle = isServiceItem
      ? `New Certification Available: ${updatedProgram.title}`
      : isDisasterItem
        ? `New Disaster Program Available: ${updatedProgram.title}`
        : `New Program Available: ${updatedProgram.title}`;
    const reopenMessage = isServiceItem
      ? `"${updatedProgram.title}" is now open for resident requests under Services.`
      : isDisasterItem
        ? `"${updatedProgram.title}" has been opened for disaster assistance.`
        : `"${updatedProgram.title}" is now open for Barangay Bugo residents.`;
    const reopenTargetArea = isServiceItem ? 'services' : 'dashboard';
    const signatory = getEffectiveSecretariatDetails(db).punongBarangay;
    const issueDate = getExactFormattedDate();

    for (const resident of activeResidents) {
      const created = addNotificationSafely(db, {
        userId: resident.id,
        title: reopenTitle,
        message: reopenMessage,
        type: 'announcement',
        targetArea: reopenTargetArea,
        targetProgramId: updatedProgram.id,
        targetProgramTitle: updatedProgram.title,
        documentData: {
          docType: isServiceItem
            ? 'Barangay Bugo Certification Bulletin'
            : isDisasterItem
              ? 'Barangay Bugo Disaster Program Bulletin'
              : 'Barangay Bugo Program Bulletin',
          controlNumber: `PRG-2026-${updatedProgram.id.slice(-4).toUpperCase()}`,
          issueDate,
          recipientName: resident.name,
          subject: updatedProgram.title,
          narrative: updatedProgram.description || reopenMessage,
          venueOrOffice: 'Barangay Bugo Assistance & Welfare Desk',
          officialRemarks: `Status updated to ${updatedProgram.status}.`,
          signatoryName: signatory,
          signatoryRole: 'Punong Barangay'
        }
      });
      if (created) createdNotifications.push(created);
    }
  }

  // Notify affected resident applicants if status changed or title changed
  if (affectedApplicantIds.size > 0 && (existing.status !== updatedProgram.status || existing.title !== updatedProgram.title)) {
    for (const applicantId of affectedApplicantIds) {
      const created = addNotificationSafely(db, {
        userId: applicantId,
        title: `Program Updated: ${updatedProgram.title}`,
        message: updatedProgram.status === 'Closed'
          ? `The program/service "${updatedProgram.title}" has been marked as Closed by the Barangay Administrator.`
          : `Details for "${updatedProgram.title}" (${updatedProgram.category}) have been updated by the Barangay Administrator.`,
        type: 'status_update',
        targetArea: 'services',
        targetProgramId: updatedProgram.id,
        targetProgramTitle: updatedProgram.title
      });
      if (created) createdNotifications.push(created);
    }
  }

  const logEntry = {
    id: `log-${Date.now()}`,
    residentName: updatedProgram.title,
    residentIdNumber: updatedProgram.id,
    purok: 'Barangay Bugo',
    actionType: 'Status Updated',
    locationOrService: 'Barangay Programs Catalog',
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
    officerInCharge: req.authUser?.email || 'Barangay Administrator',
    status: 'Completed',
    details: `Updated program/service "${updatedProgram.title}" (${updatedProgram.category} • ${updatedProgram.status}).`
  };
  db.activityLogs.unshift(logEntry);
  persistAsync(syncActivityLogToMySQL(logEntry), 'activityLog.programUpdate');

  saveDatabase(db);
  broadcastSystemUpdate('programs', 'update', { id });
  if (createdNotifications.length > 0) {
    broadcastSystemUpdate('notifications', 'create', { programId: updatedProgram.id });
  }

  res.json({
    success: true,
    program: updatedProgram,
    applications: db.applications,
    announcements: db.announcements,
    disasterVictims: db.disasterVictims || [],
    createdNotifications
  });
});

app.delete('/api/programs/:id', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const idx = db.programs.findIndex(p => p.id === id);

  if (idx === -1) {
    return res.status(404).json({
      success: false,
      message: 'Program not found.'
    });
  }

  const [removed] = db.programs.splice(idx, 1);

  if (Array.isArray(db.disasterVictims)) {
    db.disasterVictims = db.disasterVictims.map((victim: any) => ({
      ...victim,
      enrolledProgramIds: Array.isArray(victim.enrolledProgramIds)
        ? victim.enrolledProgramIds.filter((pid: string) => pid !== id)
        : [],
      enrolledProgramTitles: Array.isArray(victim.enrolledProgramTitles)
        ? victim.enrolledProgramTitles.filter((t: string) => t !== removed.title)
        : []
    }));
  }

  if (Array.isArray(db.announcements)) {
    db.announcements = db.announcements.map((ann: any) => {
      if (ann.targetProgramId !== id) return ann;
      const updatedAnn = { ...ann, targetProgramId: undefined, targetProgramTitle: `${removed.title} (Discontinued)` };
      persistAsync(syncAnnouncementToMySQL(updatedAnn), 'announcement.programRemoved');
      return updatedAnn;
    });
  }

  // Notify residents who have active applications referencing the deleted program/service
  const affectedOpenApplicants = new Set<string>(
    (db.applications || [])
      .filter((a: any) =>
        (a.programId === id || a.programTitle === removed.title) &&
        a.applicantId &&
        a.status !== 'Disbursed' &&
        a.status !== 'Completed'
      )
      .map((a: any) => a.applicantId)
  );
  for (const applicantId of affectedOpenApplicants) {
    addNotificationSafely(db, {
      userId: applicantId,
      title: `Service Discontinued: ${removed.title}`,
      message: `The Barangay service/program "${removed.title}" was removed from the active catalog by the administrator.`,
      type: 'system_alert',
      targetArea: 'services'
    });
  }

  const logEntry = {
    id: `log-${Date.now()}`,
    residentName: removed.title,
    residentIdNumber: removed.id,
    purok: 'Barangay Bugo',
    actionType: 'Status Updated',
    locationOrService: 'Barangay Programs Catalog',
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
    officerInCharge: req.authUser?.email || 'Barangay Administrator',
    status: 'Completed',
    details: `Removed program "${removed.title}" (${removed.category}) from active catalog.`
  };
  db.activityLogs.unshift(logEntry);
  persistAsync(syncActivityLogToMySQL(logEntry), 'activityLog.programDelete');

  const archivedItem = createArchiveEntry(db, {
    title: removed.title,
    originalCategory: 'Program / Service',
    referenceCode: removed.id,
    deletedBy: req.authUser?.email || 'Barangay Administrator',
    reasonForArchive: `Removed program/service "${removed.title}" (${removed.category}) from active catalog.`,
    originalData: removed,
  });

  markDeletedDefaultIds(db, [id]);
  saveDatabase(db);
  persistAsync(deleteProgramFromMySQL(id), 'program.delete');
  broadcastSystemUpdate('programs', 'delete', { id, deletedTitle: removed.title });
  broadcastSystemUpdate('archives', 'create', { id: archivedItem.id });

  res.json({ success: true, deletedId: id, deletedTitle: removed.title, archivedItem });
});

app.post('/api/programs/bulk-delete', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const rawIds = req.body?.ids;
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please select at least one program to delete.'
    });
  }

  const targetIds = Array.from(
    new Set(
      rawIds
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .map(id => id.trim())
    )
  );

  if (targetIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid program IDs provided.'
    });
  }

  const targetSet = new Set(targetIds);
  const removedPrograms = db.programs.filter(p => targetSet.has(p.id));

  if (removedPrograms.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Selected programs were not found.'
    });
  }

  const removedIds = removedPrograms.map(p => p.id);
  const removedIdSet = new Set(removedIds);
  const removedTitles = removedPrograms.map(p => p.title);
  const removedTitleSet = new Set(removedTitles);

  db.programs = db.programs.filter(p => !removedIdSet.has(p.id));

  if (Array.isArray(db.disasterVictims)) {
    db.disasterVictims = db.disasterVictims.map((victim: any) => ({
      ...victim,
      enrolledProgramIds: Array.isArray(victim.enrolledProgramIds)
        ? victim.enrolledProgramIds.filter((pid: string) => !removedIdSet.has(pid))
        : [],
      enrolledProgramTitles: Array.isArray(victim.enrolledProgramTitles)
        ? victim.enrolledProgramTitles.filter((t: string) => !removedTitleSet.has(t))
        : []
    }));
  }

  if (Array.isArray(db.announcements)) {
    db.announcements = db.announcements.map((ann: any) => {
      if (!ann.targetProgramId || !removedIdSet.has(ann.targetProgramId)) return ann;
      const updatedAnn = {
        ...ann,
        targetProgramId: undefined,
        targetProgramTitle: `${ann.targetProgramTitle || 'Program'} (Discontinued)`
      };
      persistAsync(syncAnnouncementToMySQL(updatedAnn), 'announcement.programBulkRemoved');
      return updatedAnn;
    });
  }

  const affectedApplicantsMap = new Map<string, string[]>();
  for (const appItem of db.applications || []) {
    if (
      (removedIdSet.has(appItem.programId) || removedTitleSet.has(appItem.programTitle)) &&
      appItem.applicantId &&
      appItem.status !== 'Disbursed' &&
      appItem.status !== 'Completed'
    ) {
      const list = affectedApplicantsMap.get(appItem.applicantId) || [];
      if (!list.includes(appItem.programTitle)) list.push(appItem.programTitle);
      affectedApplicantsMap.set(appItem.applicantId, list);
    }
  }
  for (const [applicantId, progTitles] of affectedApplicantsMap.entries()) {
    addNotificationSafely(db, {
      userId: applicantId,
      title: `Program Catalog Update (${progTitles.length} Discontinued)`,
      message: `The following Barangay service(s)/program(s) were removed from the catalog: ${progTitles.join(', ')}.`,
      type: 'system_alert',
      targetArea: 'services'
    });
  }

  const logEntry = {
    id: `log-${Date.now()}`,
    residentName: `${removedPrograms.length} Programs`,
    residentIdNumber: removedIds.slice(0, 3).join(', '),
    purok: 'Barangay Bugo',
    actionType: 'Status Updated',
    locationOrService: 'Barangay Programs Catalog',
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
    officerInCharge: req.authUser?.email || 'Barangay Administrator',
    status: 'Completed',
    details: `Bulk removed ${removedPrograms.length} program(s) from active catalog: ${removedTitles.slice(0, 5).join(', ')}${removedTitles.length > 5 ? ` (+${removedTitles.length - 5} more)` : ''}.`
  };
  db.activityLogs.unshift(logEntry);
  persistAsync(syncActivityLogToMySQL(logEntry), 'activityLog.programBulkDelete');

  const archivedItems = removedPrograms.map((removedProg: any) =>
    createArchiveEntry(db, {
      title: removedProg.title,
      originalCategory: 'Program / Service',
      referenceCode: removedProg.id,
      deletedBy: req.authUser?.email || 'Barangay Administrator',
      reasonForArchive: `Bulk removed program/service "${removedProg.title}" (${removedProg.category}) from active catalog.`,
      originalData: removedProg,
    })
  );

  markDeletedDefaultIds(db, removedIds);
  saveDatabase(db);
  for (const deletedId of removedIds) {
    persistAsync(deleteProgramFromMySQL(deletedId), 'program.bulkDelete');
  }
  broadcastSystemUpdate('programs', 'bulk_delete', { deletedIds: removedIds });
  broadcastSystemUpdate('archives', 'create', { count: archivedItems.length });

  res.json({
    success: true,
    deletedIds: removedIds,
    deletedTitles: removedTitles,
    deletedCount: removedIds.length,
    archivedItems
  });
});

app.get('/api/applications', (req, res) => {
  const { applicantId, status } = req.query;
  let apps = sortApplicationsFCFS(db.applications || []).map((a, idx) => ({
    ...a,
    queueNumber: idx + 1,
  }));
  if (applicantId && typeof applicantId === 'string') {
    apps = apps.filter(a => a.applicantId === applicantId);
  }
  if (status && typeof status === 'string') {
    apps = apps.filter(a => a.status === status);
  }
  res.json(apps);
});

app.get('/api/residents', (_req, res) => {
  const sanitizedUsers = db.users.map(({ passwordHash, ...rest }) => rest);
  res.json(sanitizedUsers);
});

app.get('/api/announcements', (_req, res) => {
  res.json(db.announcements || []);
});

app.get('/api/notifications', (req, res) => {
  const { userId } = req.query;
  let notifs = db.notifications || [];
  if (userId && typeof userId === 'string') {
    notifs = notifs.filter(
      n => (!n.userId || n.userId === 'all' || n.userId === userId) && !(Array.isArray(n.dismissedBy) && n.dismissedBy.includes(userId))
    );
  }
  res.json(notifs);
});

app.get('/api/archives', (_req, res) => {
  res.json((db.archivedItems || []).map(sanitizeArchiveItem));
});

app.get('/api/logs', (_req, res) => {
  res.json(db.activityLogs || []);
});

// GET MySQL Schema & SQL Dump File
app.get('/api/database/export-sql', (_req, res) => {
  const sqlFile = path.resolve(process.cwd(), 'database', 'schema_mysql.sql');
  if (fs.existsSync(sqlFile)) {
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', 'attachment; filename="barangay_bugo_db.sql"');
    return res.sendFile(sqlFile);
  }
  return res.status(404).json({ error: 'SQL schema file not found.' });
});

// GET MySQL Schema Summary & Table Diagnostics (Zero credentials exposed)
app.get('/api/database/mysql-info', (_req, res) => {
  res.json({
    databaseName: 'barangay_bugo_db',
    orm: 'Prisma ORM',
    activePersistenceMode,
    characterSet: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
    engine: 'InnoDB',
    compatibility: 'MySQL 8.0+, MariaDB 10.6+',
    tables: [
      { name: 'users', rows: db.users?.length || 0, primaryKey: 'id', description: 'Citizen & administrator user demographic profiles' },
      { name: 'assistance_programs', rows: db.programs?.length || 0, primaryKey: 'id', description: `${ALL_BARANGAY_SERVICES.length} Barangay Bugo welfare & administrative services` },
      { name: 'assistance_applications', rows: db.applications?.length || 0, primaryKey: 'id', description: 'Beneficiary assistance filings, status & QR codes' },
      { name: 'announcements', rows: db.announcements?.length || 0, primaryKey: 'id', description: 'Official community advisories & emergency notices' },
      { name: 'census_puroks', rows: db.census?.purokBreakdown?.length || 0, primaryKey: 'id', description: 'Demographic population & household census (Zones 1-10)' },
      { name: 'notifications', rows: db.notifications?.length || 0, primaryKey: 'id', description: 'Push & portal tracking notification alerts' },
      { name: 'activity_logs', rows: db.activityLogs?.length || 0, primaryKey: 'id', description: 'Immutable system & security audit trail logs' },
      { name: 'archived_records', rows: db.archivedItems?.length || 0, primaryKey: 'id', description: 'Archived resident, service application & document records' }
    ],
    existingAccounts: db.users.map(u => ({
      role: u.role === 'admin' ? 'Administrator' : 'Resident',
      name: u.name,
      email: u.email,
      residentId: u.residentIdNumber,
      status: u.registrationStatus,
    }))
  });
});

// GET Postman Collection JSON File for Automated Defense Testing
app.get('/api/testing/postman-collection', (_req, res) => {
  const collectionFile = path.resolve(process.cwd(), 'tests', 'Barangay_Bugo_API.postman_collection.json');
  if (fs.existsSync(collectionFile)) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="Barangay_Bugo_API.postman_collection.json"');
    return res.sendFile(collectionFile);
  }
  return res.status(404).json({ error: 'Postman collection file not found.' });
});

// GET Relational Schema, ERD Edges & Sanitized Table Previews (Zero secrets exposed)
app.get('/api/database/schema', (req, res) => {
  let isAdmin = false;
  const token = extractBearerToken(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'bugo-sync-list' }) as AuthTokenPayload;
      if (decoded?.role === 'admin') isAdmin = true;
    } catch {
      isAdmin = false;
    }
  }

  const maskEmail = (email?: string) => {
    if (!email) return '';
    if (isAdmin) return email;
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return `${local.slice(0, 2)}***@${domain}`;
  };

  const maskPhone = (phone?: string) => {
    if (!phone) return '';
    if (isAdmin) return phone;
    return phone.length > 6 ? `${phone.slice(0, 4)}***${phone.slice(-3)}` : '***';
  };

  const tables = [
    {
      name: 'users',
      modelName: 'User',
      rowCount: db.users?.length || 0,
      primaryKey: 'id',
      description: 'Citizen & administrator demographic profiles and RBAC credentials',
      columns: [
        { name: 'id', type: 'VARCHAR(64)', key: 'PK', nullable: false },
        { name: 'name', type: 'VARCHAR(191)', key: '', nullable: false },
        { name: 'email', type: 'VARCHAR(191)', key: 'UQ', nullable: false },
        { name: 'password_hash', type: 'VARCHAR(255)', key: '', nullable: false },
        { name: 'role', type: 'VARCHAR(32)', key: 'IDX', nullable: false },
        { name: 'purok', type: 'VARCHAR(128)', key: 'IDX', nullable: false },
        { name: 'resident_id_number', type: 'VARCHAR(64)', key: 'UQ', nullable: false },
        { name: 'registration_status', type: 'VARCHAR(64)', key: '', nullable: false },
        { name: 'is_verified', type: 'BOOLEAN', key: '', nullable: false },
        { name: 'household_income', type: 'VARCHAR(64)', key: '', nullable: true }
      ],
      sampleRows: (db.users || []).slice(0, 20).map(u => ({
        id: u.id,
        name: u.name,
        email: maskEmail(u.email),
        role: u.role,
        residentIdNumber: u.residentIdNumber,
        purok: u.purok,
        registrationStatus: u.registrationStatus,
        isVerified: u.isVerified,
        contactNumber: maskPhone(u.contactNumber),
        registeredDate: u.registeredDate
      }))
    },
    {
      name: 'assistance_programs',
      modelName: 'AssistanceProgram',
      rowCount: db.programs?.length || 0,
      primaryKey: 'id',
      description: `${ALL_BARANGAY_SERVICES.length} Barangay Bugo welfare, health, civil, and livelihood programs`,
      columns: [
        { name: 'id', type: 'VARCHAR(64)', key: 'PK', nullable: false },
        { name: 'title', type: 'VARCHAR(191)', key: '', nullable: false },
        { name: 'category', type: 'VARCHAR(128)', key: 'IDX', nullable: false },
        { name: 'status', type: 'VARCHAR(32)', key: 'IDX', nullable: false },
        { name: 'max_benefit_amount', type: 'VARCHAR(128)', key: '', nullable: true },
        { name: 'allocated_budget', type: 'DECIMAL(14,2)', key: '', nullable: false },
        { name: 'slots_available', type: 'INT', key: '', nullable: false },
        { name: 'processing_time', type: 'VARCHAR(128)', key: '', nullable: true }
      ],
      sampleRows: (db.programs || []).slice(0, 20).map((p: any) => ({
        id: p.id,
        title: p.title,
        category: p.category,
        status: p.status,
        maxBenefitAmount: p.maxBenefitAmount || 'Service',
        processingTime: p.processingTime || '1-3 days',
        slotsAvailable: p.slotsAvailable ?? 'Open'
      }))
    },
    {
      name: 'assistance_applications',
      modelName: 'AssistanceApplication',
      rowCount: db.applications?.length || 0,
      primaryKey: 'id',
      description: 'Submitted resident service filings, status timelines & disbursement records',
      columns: [
        { name: 'id', type: 'VARCHAR(64)', key: 'PK', nullable: false },
        { name: 'reference_code', type: 'VARCHAR(64)', key: 'UQ', nullable: false },
        { name: 'program_id', type: 'VARCHAR(64)', key: 'FK', nullable: false },
        { name: 'applicant_user_id', type: 'VARCHAR(64)', key: 'FK', nullable: false },
        { name: 'applicant_name', type: 'VARCHAR(191)', key: '', nullable: false },
        { name: 'status', type: 'VARCHAR(64)', key: 'IDX', nullable: false },
        { name: 'submission_date', type: 'VARCHAR(64)', key: '', nullable: false },
        { name: 'official_receipt_number', type: 'VARCHAR(64)', key: '', nullable: true }
      ],
      sampleRows: (db.applications || []).slice(0, 20).map((a: any) => ({
        id: a.id,
        referenceCode: a.referenceCode,
        programTitle: a.programTitle,
        applicantName: a.applicantName,
        purok: a.purok,
        status: a.status,
        submissionDate: a.submissionDate,
        officialReceiptNumber: a.officialReceiptNumber || '-'
      }))
    },
    {
      name: 'announcements',
      modelName: 'Announcement',
      rowCount: db.announcements?.length || 0,
      primaryKey: 'id',
      description: 'Official community advisories, water/utility notices & public bulletins',
      columns: [
        { name: 'id', type: 'VARCHAR(64)', key: 'PK', nullable: false },
        { name: 'title', type: 'VARCHAR(191)', key: '', nullable: false },
        { name: 'category', type: 'VARCHAR(64)', key: 'IDX', nullable: false },
        { name: 'publish_date', type: 'VARCHAR(64)', key: '', nullable: false },
        { name: 'views_count', type: 'INT', key: '', nullable: false },
        { name: 'is_pinned', type: 'BOOLEAN', key: 'IDX', nullable: false },
        { name: 'status', type: 'VARCHAR(32)', key: '', nullable: false }
      ],
      sampleRows: (db.announcements || []).slice(0, 20).map((a: any) => ({
        id: a.id,
        title: a.title,
        category: a.category,
        date: a.date,
        viewsCount: a.viewsCount || 0,
        isPinned: Boolean(a.isPinned),
        status: a.status
      }))
    },
    {
      name: 'census_puroks',
      modelName: 'CensusPurok',
      rowCount: db.census?.purokBreakdown?.length || 0,
      primaryKey: 'id',
      description: 'Zone 1-10 demographic population & household census breakdown',
      columns: [
        { name: 'id', type: 'INT (AUTO)', key: 'PK', nullable: false },
        { name: 'purok_name', type: 'VARCHAR(128)', key: 'UQ', nullable: false },
        { name: 'population', type: 'INT', key: '', nullable: false },
        { name: 'households', type: 'INT', key: '', nullable: false },
        { name: 'registered_voters', type: 'INT', key: '', nullable: false },
        { name: 'senior_citizens', type: 'INT', key: '', nullable: false }
      ],
      sampleRows: (db.census?.purokBreakdown || []).map((p: any, idx: number) => ({
        id: idx + 1,
        purok: p.purok,
        population: p.population,
        households: p.households
      }))
    },
    {
      name: 'notifications',
      modelName: 'Notification',
      rowCount: db.notifications?.length || 0,
      primaryKey: 'id',
      description: 'Citizen & admin status alerts and printable official paper dockets',
      columns: [
        { name: 'id', type: 'VARCHAR(64)', key: 'PK', nullable: false },
        { name: 'user_id', type: 'VARCHAR(64)', key: 'IDX', nullable: true },
        { name: 'title', type: 'VARCHAR(191)', key: '', nullable: false },
        { name: 'type', type: 'VARCHAR(64)', key: '', nullable: false },
        { name: 'is_read', type: 'BOOLEAN', key: 'IDX', nullable: false },
        { name: 'timestamp', type: 'VARCHAR(64)', key: '', nullable: false }
      ],
      sampleRows: (db.notifications || []).slice(0, 20).map((n: any) => ({
        id: n.id,
        title: n.title,
        type: n.type,
        read: Boolean(n.read),
        timestamp: n.timestamp,
        targetArea: n.targetArea || '-'
      }))
    },
    {
      name: 'activity_logs',
      modelName: 'ActivityLog',
      rowCount: db.activityLogs?.length || 0,
      primaryKey: 'id',
      description: 'Audit trail for registrations, clearances, logins & disbursements',
      columns: [
        { name: 'id', type: 'VARCHAR(64)', key: 'PK', nullable: false },
        { name: 'resident_name', type: 'VARCHAR(191)', key: '', nullable: false },
        { name: 'resident_id_number', type: 'VARCHAR(64)', key: 'IDX', nullable: false },
        { name: 'action_type', type: 'VARCHAR(64)', key: 'IDX', nullable: false },
        { name: 'location_or_service', type: 'VARCHAR(191)', key: '', nullable: false },
        { name: 'timestamp', type: 'VARCHAR(64)', key: '', nullable: false },
        { name: 'status', type: 'VARCHAR(64)', key: '', nullable: false }
      ],
      sampleRows: (db.activityLogs || []).slice(0, 20).map((l: any) => ({
        id: l.id,
        residentName: l.residentName,
        actionType: l.actionType,
        locationOrService: l.locationOrService,
        timestamp: l.timestamp,
        status: l.status
      }))
    },
    {
      name: 'archived_records',
      modelName: 'ArchivedRecord',
      rowCount: db.archivedItems?.length || 0,
      primaryKey: 'id',
      description: 'Archived grant disbursements, resident & document records',
      columns: [
        { name: 'id', type: 'VARCHAR(64)', key: 'PK', nullable: false },
        { name: 'title', type: 'VARCHAR(191)', key: '', nullable: false },
        { name: 'record_type', type: 'VARCHAR(64)', key: 'IDX', nullable: false },
        { name: 'record_reference', type: 'VARCHAR(128)', key: 'IDX', nullable: false },
        { name: 'archived_by', type: 'VARCHAR(191)', key: '', nullable: false },
        { name: 'deleted_at', type: 'VARCHAR(64)', key: '', nullable: false },
        { name: 'status', type: 'VARCHAR(32)', key: '', nullable: false }
      ],
      sampleRows: (db.archivedItems || []).slice(0, 20).map((a: any) => ({
        id: a.id,
        title: a.title,
        originalCategory: a.originalCategory,
        referenceCode: a.referenceCode || '-',
        deletedBy: a.deletedBy,
        deletedAt: a.deletedAt
      }))
    }
  ];

  res.json({
    databaseName: 'barangay_bugo_db',
    orm: 'Prisma ORM',
    activePersistenceMode,
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
    totalTables: tables.length,
    totalRows: tables.reduce((sum, t) => sum + t.rowCount, 0),
    isAdminView: isAdmin,
    relations: [
      { fromTable: 'assistance_applications', fromColumn: 'applicant_user_id', toTable: 'users', toColumn: 'id', cardinality: 'N:1' },
      { fromTable: 'assistance_applications', fromColumn: 'program_id', toTable: 'assistance_programs', toColumn: 'id', cardinality: 'N:1' },
      { fromTable: 'notifications', fromColumn: 'user_id', toTable: 'users', toColumn: 'id', cardinality: 'N:1 (logical)' }
    ],
    tables
  });
});

// GET Deployment & Production Readiness Diagnostics (Zero secrets exposed)
app.get('/api/deployment/status', async (_req, res) => {
  const dbHealth = await checkDatabaseHealth();
  const distHtmlExists = fs.existsSync(path.resolve(process.cwd(), 'dist', 'index.html'));
  const distServerExists = fs.existsSync(path.resolve(process.cwd(), 'dist', 'server.mjs'));
  const prismaSchemaExists = fs.existsSync(path.resolve(process.cwd(), 'prisma', 'schema.prisma'));
  const mysqlDdlExists = fs.existsSync(path.resolve(process.cwd(), 'database', 'schema_mysql.sql'));
  const postmanExists = fs.existsSync(path.resolve(process.cwd(), 'tests', 'Barangay_Bugo_API.postman_collection.json'));
  const backupScriptExists = fs.existsSync(path.resolve(process.cwd(), 'scripts', 'backup_mysql.sh'));
  const deploymentGuideExists = fs.existsSync(path.resolve(process.cwd(), 'DEPLOYMENT.md'));
  const renderBlueprintExists = fs.existsSync(path.resolve(process.cwd(), 'render.yaml'));

  res.json({
    status: dbHealth.connected ? 'ok' : 'degraded',
    platform: 'render',
    environment: NODE_ENV,
    port: Number(PORT),
    nodeVersion: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    serverTime: new Date().toISOString(),
    persistenceMode: activePersistenceMode,
    database: dbHealth,
    readinessChecks: [
      {
        id: 'render-blueprint',
        label: 'Render Blueprint (render.yaml)',
        passed: renderBlueprintExists,
        detail: renderBlueprintExists
          ? 'render.yaml configured for Render Web Service (/api/health)'
          : 'Missing render.yaml Blueprint'
      },
      {
        id: 'db-health',
        label: 'Active Persistence Engine',
        passed: dbHealth.connected,
        detail: activePersistenceMode === 'mysql-prisma'
          ? `Connected to MySQL via Prisma (${dbHealth.latencyMs ?? 0}ms)`
          : 'Running in JSON local persistence mode (data/db.json); MySQL activates when DATABASE_URL is set'
      },
      {
        id: 'prisma-schema',
        label: 'Prisma ORM Schema (prisma/schema.prisma)',
        passed: prismaSchemaExists,
        detail: prismaSchemaExists ? '8 relational models defined for MySQL 8.0+' : 'Missing prisma/schema.prisma'
      },
      {
        id: 'mysql-ddl',
        label: 'MySQL DDL Export (database/schema_mysql.sql)',
        passed: mysqlDdlExists,
        detail: mysqlDdlExists ? 'InnoDB + utf8mb4 DDL script ready for download/import' : 'Missing database/schema_mysql.sql'
      },
      {
        id: 'prod-build',
        label: 'Production Build Bundle (dist/)',
        passed: distHtmlExists && distServerExists,
        detail: distHtmlExists && distServerExists
          ? 'dist/index.html & dist/server.mjs compiled'
          : 'Run "npm run build" to generate dist/index.html and dist/server.mjs'
      },
      {
        id: 'jwt-secret',
        label: 'Custom Production JWT Secret',
        passed: Boolean(sanitizeEnvValue(process.env.JWT_SECRET) && sanitizeEnvValue(process.env.JWT_SECRET) !== DEV_FALLBACK_JWT_SECRET),
        detail: sanitizeEnvValue(process.env.JWT_SECRET) && sanitizeEnvValue(process.env.JWT_SECRET) !== DEV_FALLBACK_JWT_SECRET
          ? 'Custom JWT_SECRET environment variable configured'
          : 'Using development fallback JWT secret (set JWT_SECRET before production deployment)'
      },
      {
        id: 'hmac-secret',
        label: 'Custom Production HMAC Voucher Secret',
        passed: Boolean(sanitizeEnvValue(process.env.HMAC_SECRET) && sanitizeEnvValue(process.env.HMAC_SECRET) !== DEV_FALLBACK_HMAC_SECRET),
        detail: sanitizeEnvValue(process.env.HMAC_SECRET) && sanitizeEnvValue(process.env.HMAC_SECRET) !== DEV_FALLBACK_HMAC_SECRET
          ? 'Custom HMAC_SECRET environment variable configured'
          : 'Using development fallback HMAC secret (set HMAC_SECRET before production deployment)'
      },
      {
        id: 'mysql-env',
        label: 'MySQL DATABASE_URL Configured',
        passed: isMySqlConfigured(),
        detail: isMySqlConfigured()
          ? 'MySQL connection string detected'
          : 'Not set in current preview environment (JSON fallback active)'
      },
      {
        id: 'postman-suite',
        label: 'Postman API Test Collection',
        passed: postmanExists,
        detail: postmanExists ? 'tests/Barangay_Bugo_API.postman_collection.json available' : 'Missing Postman collection'
      },
      {
        id: 'backup-script',
        label: 'Automated MySQL Backup & Render Docs',
        passed: backupScriptExists && deploymentGuideExists,
        detail: backupScriptExists && deploymentGuideExists
          ? 'scripts/backup_mysql.sh & DEPLOYMENT.md (Render) present'
          : 'Missing backup script or DEPLOYMENT.md'
      }
    ],
    endpoints: [
      { method: 'GET', path: '/api/health', description: 'Server uptime & database health probe' },
      { method: 'GET', path: '/api/database/mysql-info', description: '8-table MySQL metadata & live row counts' },
      { method: 'GET', path: '/api/database/schema', description: 'Full column schemas, ERD links & sanitized rows' },
      { method: 'GET', path: '/api/database/export-sql', description: 'Download barangay_bugo_db.sql DDL' },
      { method: 'GET', path: '/api/testing/postman-collection', description: 'Download Postman API collection JSON' },
      { method: 'POST', path: '/api/testing/run-diagnostics', description: 'Execute live server-side verification suite' },
      { method: 'GET', path: '/api/deployment/status', description: 'Runtime & production readiness diagnostics' },
      { method: 'GET', path: '/api/programs', description: `${ALL_BARANGAY_SERVICES.length} Barangay assistance programs catalog` },
      { method: 'GET', path: '/api/applications', description: 'Resident assistance & certificate applications' },
      { method: 'GET', path: '/api/announcements', description: 'Barangay public advisories & release schedules' },
      { method: 'GET', path: '/api/census', description: 'Barangay Bugo Zone 1-10 census analytics' }
    ]
  });
});

// POST Live Server-Side Verification & QA Test Runner
app.post('/api/testing/run-diagnostics', async (_req, res) => {
  const startedAll = performance.now();
  const results: Array<{
    suite: string;
    testName: string;
    passed: boolean;
    durationMs: number;
    details: string;
  }> = [];

  const runCheck = async (suite: string, testName: string, fn: () => Promise<string> | string) => {
    const start = performance.now();
    try {
      const details = await fn();
      results.push({
        suite,
        testName,
        passed: true,
        durationMs: Math.max(1, Math.round(performance.now() - start)),
        details
      });
    } catch (err: any) {
      results.push({
        suite,
        testName,
        passed: false,
        durationMs: Math.max(1, Math.round(performance.now() - start)),
        details: err?.message || String(err)
      });
    }
  };

  // Suite 1: Auth & Cryptographic Security
  await runCheck('Auth & Security', 'Registry has Admin and Resident accounts', () => {
    const admin = db.users.find(u => u.role === 'admin');
    const resident = db.users.find(u => u.role === 'resident');
    if (!admin || !resident) throw new Error('Missing seeded admin or resident account');
    return `${db.users.length} total accounts (${admin.email}, ${resident.email})`;
  });

  await runCheck('Auth & Security', 'All user passwords stored with Bcrypt/PBKDF2 hashes', () => {
    for (const u of db.users) {
      const isBcrypt = u.passwordHash?.startsWith('$2');
      const isPbkdf2 = u.passwordHash?.includes(':') && u.passwordHash.length > 64;
      if (!isBcrypt && !isPbkdf2) {
        throw new Error(`Insecure password storage on user ${u.email}`);
      }
    }
    return `Verified cryptographic hashes across ${db.users.length} user records`;
  });

  await runCheck('Auth & Security', 'Password policy rejects weak & accepts 5-criteria strong passwords', () => {
    const weak = validatePasswordStrengthServer('simple123');
    if (weak.isValid) throw new Error('Weak password was unexpectedly accepted');
    const strong = validatePasswordStrengthServer('Strong@Bugo2026!');
    if (!strong.isValid) throw new Error('Valid strong password was rejected');
    return 'Enforces 8+ chars, upper, lower, digit & special symbol';
  });

  await runCheck('Auth & Security', 'HMAC-SHA256 voucher token sign & timing-safe verify', () => {
    const token = generateVoucherToken('BUG-2026-9001', 'user-maria-santos', '5000');
    const valid = verifyVoucherToken('BUG-2026-9001', 'user-maria-santos', '5000', token);
    const tampered = verifyVoucherToken('BUG-2026-9001', 'user-maria-santos', '99999', token);
    if (!valid || tampered) throw new Error('HMAC verification integrity check failed');
    return 'Signed 64-char SHA-256 HMAC and rejected tampered payload';
  });

  // Suite 2: Services Catalog & Assets
  await runCheck('Services & Assets', `Catalog contains all ${ALL_BARANGAY_SERVICES.length}+ Barangay Bugo programs`, () => {
    if (!Array.isArray(db.programs) || db.programs.length < ALL_BARANGAY_SERVICES.length) {
      throw new Error(`Expected at least ${ALL_BARANGAY_SERVICES.length} services, found ${db.programs?.length || 0}`);
    }
    return `${db.programs.length} Barangay services loaded (${ALL_BARANGAY_SERVICES.length} base catalog)`;
  });

  await runCheck('Services & Assets', 'All program image assets exist on disk', () => {
    const servicesDir = path.resolve(process.cwd(), 'public', 'assets', 'services');
    if (!fs.existsSync(servicesDir)) throw new Error('public/assets/services directory missing');
    const files = new Set(fs.readdirSync(servicesDir));
    let checked = 0;
    for (const p of db.programs) {
      const file = path.basename(p.imageUrl || '');
      if (!files.has(file)) throw new Error(`Missing image file: ${file}`);
      checked++;
    }
    return `${checked} program image references verified in public/assets/services/`;
  });

  // Suite 3: Relational Database & DDL
  await runCheck('Database & Prisma', 'Prisma schema defines all 8 active MySQL models', () => {
    const prismaPath = path.resolve(process.cwd(), 'prisma', 'schema.prisma');
    if (!fs.existsSync(prismaPath)) throw new Error('prisma/schema.prisma not found');
    const content = fs.readFileSync(prismaPath, 'utf-8');
    const tables = ['users', 'assistance_programs', 'assistance_applications', 'announcements', 'census_puroks', 'notifications', 'activity_logs', 'archived_records'];
    for (const t of tables) {
      if (!content.includes(`@@map("${t}")`)) throw new Error(`Missing @@map("${t}") in schema.prisma`);
    }
    if (content.includes('blotter_complaints') || content.includes('BlotterComplaint')) {
      throw new Error('Unused blotter_complaints model still present in schema.prisma');
    }
    return 'All 8 active relational models verified in prisma/schema.prisma';
  });

  await runCheck('Database & Prisma', 'MySQL DDL script includes InnoDB, utf8mb4 & 8 active tables', () => {
    const sqlPath = path.resolve(process.cwd(), 'database', 'schema_mysql.sql');
    if (!fs.existsSync(sqlPath)) throw new Error('database/schema_mysql.sql not found');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    const tables = ['users', 'assistance_programs', 'assistance_applications', 'announcements', 'census_puroks', 'notifications', 'activity_logs', 'archived_records'];
    for (const t of tables) {
      if (!sql.includes(`CREATE TABLE \`${t}\``)) throw new Error(`Missing CREATE TABLE \`${t}\``);
    }
    if (sql.includes('blotter_complaints')) {
      throw new Error('Unused blotter_complaints table found in schema_mysql.sql');
    }
    if (!sql.includes('ENGINE=InnoDB') || !sql.includes('utf8mb4')) {
      throw new Error('Missing InnoDB or utf8mb4 declaration');
    }
    return `8-table DDL verified (${Math.round(Buffer.byteLength(sql) / 1024)} KB)`;
  });

  await runCheck('Database & Prisma', 'Active database connectivity health check', async () => {
    const health = await checkDatabaseHealth();
    if (!health.connected) throw new Error('Database health check failed');
    return `Connected (${activePersistenceMode}, latency ${health.latencyMs ?? 0}ms)`;
  });

  // Suite 4: Testing & Deployment Artifacts
  await runCheck('Testing & Deployment', 'Postman API collection parses cleanly', () => {
    const postmanPath = path.resolve(process.cwd(), 'tests', 'Barangay_Bugo_API.postman_collection.json');
    if (!fs.existsSync(postmanPath)) throw new Error('Postman collection missing');
    const parsed = JSON.parse(fs.readFileSync(postmanPath, 'utf-8'));
    const count = Array.isArray(parsed.item) ? parsed.item.length : 0;
    return `Valid Postman collection (${count} folder/request groups)`;
  });

  await runCheck('Testing & Deployment', 'Backup script & DEPLOYMENT.md documentation exist', () => {
    const backup = fs.existsSync(path.resolve(process.cwd(), 'scripts', 'backup_mysql.sh'));
    const guide = fs.existsSync(path.resolve(process.cwd(), 'DEPLOYMENT.md'));
    if (!backup || !guide) throw new Error('Missing backup script or DEPLOYMENT.md');
    return 'scripts/backup_mysql.sh and DEPLOYMENT.md verified';
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  res.json({
    total: results.length,
    passed,
    failed,
    durationMs: Math.max(1, Math.round(performance.now() - startedAll)),
    executedAt: new Date().toISOString(),
    results
  });
});

// AUTH: Login with Bcrypt/PBKDF2 Password Verification, JWT Issuance & Rate Limiting
app.post('/api/auth/login', authRateLimiter, (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required.' });
  }

  const cleanEmail = normalizeAccountEmail(email);
  if (!isAllowedAccountEmail(cleanEmail)) {
    return res.status(400).json({ success: false, message: ALLOWED_EMAIL_DOMAIN_MESSAGE });
  }
  const user = db.users.find(u => matchesUserAccountEmail(u, cleanEmail));

  if (!user) {
    recordFailedLogin(ip);
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  if (user.isBanned || user.registrationStatus === 'Banned') {
    return res.status(403).json({
      success: false,
      message: `Account is banned: ${user.banReason || 'Administrative policy violation.'}`
    });
  }

  const isValid = verifyPassword(String(password), user.passwordHash);
  if (!isValid) {
    recordFailedLogin(ip);
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  clearLoginAttempts(ip);

  const token = signAuthToken(user);
  const { passwordHash, ...safeUser } = user;

  res.json({
    success: true,
    user: safeUser,
    token,
    sessionToken: token,
    expiresIn: 7200
  });
});

// AUTH: Verify current JWT session and return active user profile
app.get('/api/auth/me', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const user = db.users.find(u => u.id === req.authUser?.sub);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }
  const { passwordHash, ...safeUser } = user;
  res.json({ success: true, user: safeUser, role: req.authUser?.role });
});

// ----------------------------------------------------
// Verification Token Store for Authenticated Actions
// ----------------------------------------------------
const verifiedTokensMap = new Map<string, { userId: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [token, record] of verifiedTokensMap.entries()) {
    if (record.expiresAt < now) verifiedTokensMap.delete(token);
  }
}, 60000);

// AUTH: Verify Old / Current Password Before Allowing New Password Entry
app.post('/api/auth/verify-current-password', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const { userId, email, currentPassword } = req.body;

  if ((!userId && !email) || !currentPassword) {
    return res.status(400).json({
      success: false,
      message: 'User ID and old/current password are required.'
    });
  }

  const cleanEmail = email ? normalizeAccountEmail(email) : '';
  const user = db.users.find(u =>
    (userId && u.id === userId) ||
    (cleanEmail && matchesUserAccountEmail(u, cleanEmail))
  );

  if (!user) {
    return res.status(404).json({ success: false, message: 'User account not found.' });
  }

  if (req.authUser?.role !== 'admin' && req.authUser?.sub !== user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden: Account mismatch.' });
  }

  const isMatch = verifyPassword(String(currentPassword), user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Old password is incorrect. Please double-check your existing password.'
    });
  }

  const verificationToken = crypto.randomBytes(24).toString('hex');
  verifiedTokensMap.set(verificationToken, {
    userId: user.id,
    expiresAt: Date.now() + 15 * 60 * 1000
  });

  res.json({
    success: true,
    verificationToken,
    message: 'Old password confirmed! You may now edit and set your new password.'
  });
});

// AUTH: Change Password (Requires JWT + prior verified token or current password)
app.post('/api/auth/change-password', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const { userId, email, currentPassword, verificationToken, newPassword } = req.body;

  if ((!userId && !email) || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'User identity and new password are required.'
    });
  }

  const cleanEmail = email ? normalizeAccountEmail(email) : '';
  const user = db.users.find(u =>
    (userId && u.id === userId) ||
    (cleanEmail && matchesUserAccountEmail(u, cleanEmail))
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Account not found in Barangay Bugo registry.'
    });
  }

  if (req.authUser?.role !== 'admin' && req.authUser?.sub !== user.id) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You can only change your own account password.'
    });
  }

  let isAuthorized = false;
  let consumedToken: string | null = null;

  if (verificationToken) {
    const tokenRecord = verifiedTokensMap.get(verificationToken);
    if (tokenRecord && tokenRecord.userId === user.id && tokenRecord.expiresAt > Date.now()) {
      isAuthorized = true;
      consumedToken = verificationToken;
    }
  }

  if (!isAuthorized && currentPassword) {
    if (verifyPassword(currentPassword, user.passwordHash)) {
      isAuthorized = true;
    } else {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect. Verification failed.'
      });
    }
  }

  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      message: 'Security Authorization Required: You must verify your current password before changing to a new password.'
    });
  }

  if (verifyPassword(newPassword, user.passwordHash)) {
    return res.status(400).json({
      success: false,
      message: 'New password cannot be the same as your current password.'
    });
  }

  const strengthCheck = validatePasswordStrengthServer(newPassword);
  if (!strengthCheck.isValid) {
    return res.status(400).json({
      success: false,
      message: strengthCheck.message || 'New password does not meet security requirements.'
    });
  }

  if (consumedToken) {
    verifiedTokensMap.delete(consumedToken);
  }

  user.passwordHash = hashPassword(newPassword);
  persistAsync(syncUserToMySQL(user), 'user.changePassword');

  const logEntry = {
    id: `act-${Date.now()}`,
    residentName: user.name,
    residentIdNumber: user.residentIdNumber || 'USER',
    purok: user.purok || 'Bugo',
    actionType: 'Status Updated',
    locationOrService: 'Account Security Settings',
    timestamp: getExactFormattedDate(),
    officerInCharge: user.name,
    status: 'Completed',
    details: `Security credentials updated for ${user.name} (${user.email}). Bcrypt password hashing applied.`
  };
  db.activityLogs.unshift(logEntry);
  persistAsync(syncActivityLogToMySQL(logEntry), 'activityLog.passwordChange');

  addNotificationSafely(db, {
    userId: user.id,
    title: 'Security Password Changed',
    message: 'Your account password has been updated successfully. Please use your new strong password for future logins.',
    type: 'system',
    targetArea: 'settings'
  });

  saveDatabase(db);

  res.json({
    success: true,
    message: 'Password changed successfully! Your new strong password is now active.'
  });
});

// AI ID INSPECTION: Detect official ID (Front & Back), match expected ID type & ALL filled-out fields, and detect blur/invalid photos
app.post('/api/ai/validate-id-photo', async (req, res) => {
  const {
    imageBase64,
    mimeType,
    fileName,
    side,
    expectedIdType,
    expectedName,
    firstName,
    middleName,
    lastName,
    suffix,
    expectedBirthdate,
    expectedAge,
    expectedIdNumber,
    expectedGender,
    expectedCivilStatus,
  } = req.body || {};

  const idSide = side === 'back' ? 'back' : 'front';
  const expectedTypeStr = String(expectedIdType || '').trim();
  const composedName = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const expectedNameStr = String(expectedName || composedName || '').trim();
  const expectedBirthdateStr = String(expectedBirthdate || '').trim();
  const expectedAgeNum = expectedAge !== undefined && expectedAge !== '' && !isNaN(Number(expectedAge)) ? Number(expectedAge) : undefined;
  const expectedIdNumberStr = String(expectedIdNumber || '').trim();
  const expectedGenderStr = String(expectedGender || '').trim();
  const expectedCivilStatusStr = String(expectedCivilStatus || '').trim();
  const expectedCanon = canonicalizeIdCategory(expectedTypeStr);

  if (!imageBase64) {
    return res.status(400).json({
      success: false,
      message: 'No image provided for ID inspection.'
    });
  }

  let rawBase64 = String(imageBase64).trim();
  let detectedMime = mimeType || 'image/jpeg';
  if (rawBase64.includes('base64,')) {
    const parts = rawBase64.split('base64,');
    const header = parts[0];
    rawBase64 = (parts[1] || '').trim();
    if (header.includes('image/png')) detectedMime = 'image/png';
    else if (header.includes('image/webp')) detectedMime = 'image/webp';
    else if (header.includes('image/gif')) detectedMime = 'image/gif';
    else detectedMime = 'image/jpeg';
  }
  rawBase64 = rawBase64.replace(/\s+/g, '');

  const isStrictBase64 =
    rawBase64.length >= 256 &&
    rawBase64.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(rawBase64);

  let hasValidRasterImageBytes = false;
  if (isStrictBase64) {
    try {
      const sampleBuf = Buffer.from(rawBase64.slice(0, 32), 'base64');
      const isJpeg = sampleBuf.length >= 3 && sampleBuf[0] === 0xff && sampleBuf[1] === 0xd8 && sampleBuf[2] === 0xff;
      const isPng = sampleBuf.length >= 4 && sampleBuf[0] === 0x89 && sampleBuf[1] === 0x50 && sampleBuf[2] === 0x4e && sampleBuf[3] === 0x47;
      const isGif = sampleBuf.length >= 4 && sampleBuf.subarray(0, 4).toString('ascii') === 'GIF8';
      const isWebp = sampleBuf.length >= 12 && sampleBuf.subarray(0, 4).toString('ascii') === 'RIFF' && sampleBuf.subarray(8, 12).toString('ascii') === 'WEBP';
      hasValidRasterImageBytes = isJpeg || isPng || isGif || isWebp;
    } catch {
      hasValidRasterImageBytes = false;
    }
  }

  const nameLower = String(fileName || '').toLowerCase();
  if (isNonIdDocumentFilename(nameLower)) {
    return res.json({
      success: true,
      analysis: {
        isId: false,
        isClear: true,
        isBlurry: false,
        detectedSide: 'unknown',
        matchesExpectedSide: false,
        matchesExpectedType: false,
        matchesExpectedName: false,
        matchesExpectedBirthdate: true,
        matchesExpectedAddress: true,
        matchesExpectedIdNumber: true,
        matchesExpectedGender: true,
        matchesExpectedCivilStatus: true,
        expectedIdType: expectedTypeStr || undefined,
        expectedName: expectedNameStr || undefined,
        aiVisionUsed: false,
        detectedDocType: 'Not an ID',
        warning: `Not a valid ${idSide} ID. Attached file does not appear to be an official government/resident ID.`,
        advice: `Please upload a valid ${expectedTypeStr || 'Resident'} ID photo and try again.`,
        score: 20
      }
    });
  }

  if (!hasValidRasterImageBytes) {
    return res.status(400).json({
      success: false,
      message: 'Invalid image file. Please upload a valid JPG, PNG, or WEBP photo of your ID.'
    });
  }

  const profileTypeCheck = matchIdTypeWithProfile({ idType: expectedTypeStr, age: expectedAgeNum });

  const activeAiClient = getAiClient();
  if (!activeAiClient) {
    return res.status(503).json({
      success: false,
      message: 'ID verification service is not configured on this server. Please check GEMINI_API_KEY in Settings > Secrets.'
    });
  }

  const sideExpectation = idSide === 'back'
    ? 'This must be the BACK side of an official ID card (showing signature, barcode/QR, address, thumbprint, emergency contact, terms, or back of card). Set detectedSide="back". If this image actually shows the FRONT face/portrait/cardholder header side of an ID card, set detectedSide="front" and matchesExpectedSide=false. IMPORTANT: ID Number and personal information can appear on EITHER the Front OR Back of an ID — they are NOT required on the Back side. Extract ONLY fields that clearly belong to the cardholder and are visibly printed on THIS BACK side; leave any field NOT shown on the back (including ID Number, Name, Birthdate, Gender, Civil Status, or Address if shown only on the front) as "" (empty string) or 0 or false. On the BACK side: (a) ONLY populate extractedName if the cardholder\'s own full name is explicitly printed/labeled as Cardholder/Owner — NEVER put an Emergency Contact person\'s name or an issuing officer\'s signature name into extractedName; (b) ONLY populate extractedIdNumber if the card\'s actual primary cardholder ID Number (PSN/PCN/CRN/License/Postal/Student/Voter/OSCA/PWD/Solo Parent/PRC/Barangay ID No.) is clearly printed — NEVER transcribe QR code strings, card-stock print/batch codes, document control serials, hotlines, or emergency contact phone numbers into extractedIdNumber (leave "" instead).'
    : 'This must be the FRONT side of an official ID card (showing ID layout, holder portrait/header, or card front details). Set detectedSide="front". If this image only shows the BACK side of an ID card (only signature, barcode/QR, terms, or emergency contact without cardholder front header), set detectedSide="back" and matchesExpectedSide=false. IMPORTANT: ID Number and personal information can appear on EITHER the Front OR Back of an ID — neither side is required to contain every field. Transcribe ONLY the fields clearly printed on THIS FRONT side and leave any field NOT printed on the front (e.g. if ID Number, address, birthdate, gender, civil status, or full name appears only on the back) as "" (empty string) or 0 or false.';

  const expectedTypeInstruction = expectedTypeStr
    ? `6. The applicant selected Resident ID Type: "${expectedTypeStr}". Inspect the card header, agency logos, colors, and layout strictly. Set matchesExpectedType=false ONLY if the uploaded ID clearly belongs to a DIFFERENT or UNRELATED ID type (for example, Driver's License, Student ID, Passport, PhilHealth ID, TIN ID, Voter's ID, or a certificate/letter when "${expectedTypeStr}" was selected). If this is the BACK side showing generic back-of-card elements (signature, barcode/QR, address, terms) without a conflicting agency header, set matchesExpectedType=true and do NOT guess an unrelated ID type. Report the true ID type in extractedIdType/detectedDocType when visible.`
    : '';

  const expectedNameInstruction = expectedNameStr
    ? `7. The applicant declared their Account Name as: "${expectedNameStr}". If the cardholder's own printed name is visible on THIS ${idSide.toUpperCase()} side, compare it with "${expectedNameStr}" (ignoring middle-initial vs full middle name, punctuation, capitalization, or "LAST, FIRST" ordering) and set matchesExpectedName=false if it belongs to a different person. If the cardholder's name is NOT printed on this ${idSide.toUpperCase()} side, leave extractedName="" and set matchesExpectedName=true.`
    : '';

  const extraFieldLines = [
    expectedBirthdateStr ? `- Declared Birthdate: ${expectedBirthdateStr}` : '',
    expectedIdNumberStr ? `- Declared ID Number: ${expectedIdNumberStr}` : '',
    expectedGenderStr ? `- Declared Sex/Gender: ${expectedGenderStr}` : '',
    expectedCivilStatusStr ? `- Declared Civil Status: ${expectedCivilStatusStr}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `You are an official ID inspector for Barangay Bugo.
Inspect this uploaded ${idSide.toUpperCase()} ID photo strictly:
1. ${sideExpectation}
2. Is this image an official ID card (PhilSys National ID, Driver's License, UMID, Postal ID, PRC, Voter's ID/Certificate, Student ID, Senior Citizen OSCA ID, PWD ID, Solo Parent ID, Barangay Resident ID)? Set isId=false if it is NOT an ID (selfie, landscape, pet, food, meme, screenshot, barangay certificate/indigency, hospital bill, receipt, request letter, blank page, or random object).
3. Is the photo clear, bright, focused, and readable? Set isClear=false if it is blurry, dark, glared, heavily cropped, or unreadable.
4. Keep "warning" and "advice" VERY SHORT and SIMPLE (max 18 words each):
   - If isId is false: warning="Not a valid ID. Does not qualify.", advice="Attach a valid ID photo and try again."
   - If isId is true and isClear is false: warning="Photo is blurry or unclear. Please try again.", advice="Retake in good lighting and try again."
5. Extract ONLY visible details clearly printed on THIS ${idSide.toUpperCase()} side (leave "" or 0 or false if not shown on this side — do NOT copy, invent, or guess missing fields):
   - extractedName (cardholder's full name ONLY, no labels), extractedBirthdate (YYYY-MM-DD if visible else ""), extractedIdType (exact official ID name such as "PhilSys National ID", "UMID (Unified Multi-Purpose ID)", "Driver’s License", "COMELEC Voter’s ID / Certificate", "Senior Citizen OSCA ID", "Person with Disability (PWD) ID", "Solo Parent ID Card", "Student School ID Card", "Postal ID", "Barangay Resident ID Card", "PRC Professional License", or true other ID/document name, or "" if generic back), extractedIdNumber (ONLY the card's primary cardholder ID Number / Control No. / PSN / PCN / CRN / License No. / VIN / OSCA No. / PWD No. / Student No. / PRC No., preserving dashes/alphanumeric digits without labels; leave "" if this side has no primary ID number — do NOT extract QR payloads, card-stock print codes, or phone numbers), extractedAddress, extractedAge, extractedGender ("Male", "Female", or ""), extractedCivilStatus ("Single", "Married", "Widowed", "Separated", or ""), isSenior, isPwd, isSoloParent, isStudent.
${expectedTypeInstruction}
${expectedNameInstruction}
${extraFieldLines ? `8. Applicant also filled out:\n${extraFieldLines}\nTranscribe only what is actually printed on THIS ${idSide.toUpperCase()} side accurately so any mismatch against the applicant's entered details is accurately detected.` : ''}

Respond in strict JSON with the required schema.`;

  const idSchema = {
    type: Type.OBJECT,
    properties: {
      isId: { type: Type.BOOLEAN },
      isClear: { type: Type.BOOLEAN },
      detectedSide: { type: Type.STRING },
      matchesExpectedSide: { type: Type.BOOLEAN },
      matchesExpectedType: { type: Type.BOOLEAN },
      matchesExpectedName: { type: Type.BOOLEAN },
      detectedDocType: { type: Type.STRING },
      warning: { type: Type.STRING },
      advice: { type: Type.STRING },
      score: { type: Type.INTEGER },
      extractedName: { type: Type.STRING },
      extractedBirthdate: { type: Type.STRING },
      extractedIdType: { type: Type.STRING },
      extractedIdNumber: { type: Type.STRING },
      extractedAddress: { type: Type.STRING },
      extractedAge: { type: Type.INTEGER },
      extractedGender: { type: Type.STRING },
      extractedCivilStatus: { type: Type.STRING },
      isSenior: { type: Type.BOOLEAN },
      isPwd: { type: Type.BOOLEAN },
      isSoloParent: { type: Type.BOOLEAN },
      isStudent: { type: Type.BOOLEAN }
    },
    required: ['isId', 'isClear', 'detectedDocType', 'score']
  };

  const imageHashKey = `${idSide}:${crypto.createHash('sha256').update(rawBase64).digest('hex')}`;
  const cachedVision = idVisionCache.get(imageHashKey);
  let parsed: any = null;

  if (cachedVision && cachedVision.expiresAt > Date.now()) {
    const cachedDocCanon = canonicalizeIdCategory(cachedVision.parsed?.extractedIdType || cachedVision.parsed?.detectedDocType);
    const typeIndependent = Boolean(cachedDocCanon) || cachedVision.expectedTypeStr === expectedTypeStr;
    const cachedExtName = String(cachedVision.parsed?.extractedName || '').trim();
    const nameIndependent =
      !cachedExtName ||
      cachedVision.expectedNameStr === expectedNameStr ||
      Boolean(expectedNameStr && expectedNameStr.split(/\s+/).filter(Boolean).length >= 2);
    if (typeIndependent && nameIndependent) {
      const sameExpectations =
        cachedVision.expectedTypeStr === expectedTypeStr &&
        cachedVision.expectedNameStr === expectedNameStr;
      parsed = sameExpectations
        ? cachedVision.parsed
        : {
            ...cachedVision.parsed,
            matchesExpectedType: undefined,
            matchesExpectedName: undefined,
            warning: '',
            advice: '',
          };
    }
  }

  if (!parsed) {
    const inFlightKey = `${imageHashKey}:${expectedTypeStr}:${expectedNameStr}`;
    let visionPromise = inFlightIdVisionRequests.get(inFlightKey);
    if (!visionPromise) {
      visionPromise = generateGeminiVisionJson({
        client: activeAiClient,
        parts: [
          {
            inlineData: {
              mimeType: detectedMime,
              data: rawBase64
            }
          },
          { text: prompt }
        ],
        responseSchema: idSchema,
        context: 'gemini_id_vision',
      }).finally(() => {
        inFlightIdVisionRequests.delete(inFlightKey);
      });
      inFlightIdVisionRequests.set(inFlightKey, visionPromise);
    }

    const visionResult = await visionPromise;

    parsed = visionResult.data;
    if (!parsed) {
      const errStatus = visionResult.errorInfo?.statusCode || 503;
      const errMsg = visionResult.errorInfo?.message || 'Unable to verify your ID photo right now. Please try again.';
      return res.status(200).json({
        success: false,
        aiUnavailable: true,
        upstreamStatus: errStatus,
        message: `Could not verify your ${idSide} ID photo: ${errMsg}`
      });
    }

    if (parsed.isId && parsed.isClear) {
      if (idVisionCache.size >= 100) {
        const oldestKey = idVisionCache.keys().next().value;
        if (oldestKey) idVisionCache.delete(oldestKey);
      }
      idVisionCache.set(imageHashKey, {
        parsed,
        expectedTypeStr,
        expectedNameStr,
        expiresAt: Date.now() + 15 * 60_000,
      });
    }
  }

  const detectedLabel = parsed.extractedIdType || parsed.detectedDocType || `${idSide === 'back' ? 'Back' : 'Front'} ID`;
  const detectedCanon = canonicalizeIdCategory(detectedLabel);
  let matchesExpectedType = parsed.matchesExpectedType !== false;
  if (expectedCanon && detectedCanon && expectedCanon === detectedCanon && profileTypeCheck.matches && parsed.isId) {
    matchesExpectedType = true;
  }
  if (expectedCanon && detectedCanon && detectedCanon !== expectedCanon) {
    matchesExpectedType = false;
  }
  const photoMatchesExpectedType = Boolean(parsed.isId) && (expectedCanon && detectedCanon ? detectedCanon === expectedCanon : parsed.matchesExpectedType !== false);
  if (!profileTypeCheck.matches) {
    matchesExpectedType = false;
  }
  if (!parsed.isId) {
    matchesExpectedType = false;
  }

  const rawDetectedSide = String(parsed.detectedSide || '').trim().toLowerCase();
  const detectedSide: 'front' | 'back' | 'unknown' =
    rawDetectedSide === 'front' ? 'front' : rawDetectedSide === 'back' ? 'back' : 'unknown';
  let matchesExpectedSide = detectedSide === idSide ? true : parsed.matchesExpectedSide !== false;
  if (idSide === 'front' && detectedSide === 'back') matchesExpectedSide = false;
  if (idSide === 'back' && detectedSide === 'front') matchesExpectedSide = false;

  const extractedName = String(parsed.extractedName || '').trim();
  const deterministicNameCheck = matchApplicantNameWithId(
    { firstName, middleName, lastName, suffix, fullName: expectedNameStr },
    extractedName
  );
  let matchesExpectedName = true;
  if (expectedNameStr && extractedName) {
    matchesExpectedName = deterministicNameCheck.compared
      ? deterministicNameCheck.matches
      : parsed.matchesExpectedName !== false;
  }

  const extractedBirthdate = String(parsed.extractedBirthdate || '').trim();
  const extractedAge = typeof parsed.extractedAge === 'number' ? parsed.extractedAge : 0;
  const dobCheck = matchApplicantBirthdateWithId(
    { birthdate: expectedBirthdateStr, age: expectedAgeNum },
    { extractedBirthdate, extractedAge }
  );

  const extractedIdNumber = String(parsed.extractedIdNumber || '').trim();
  const idNumCheck = matchApplicantIdNumberWithId(expectedIdNumberStr, extractedIdNumber);
  const idNumMatchesScan = idNumCheck.matches || isIdNumberPrefixMatch(expectedIdNumberStr, extractedIdNumber);

  const extractedAddress = String(parsed.extractedAddress || '').trim();
  const extractedGender = parsed.extractedGender === 'Male' || parsed.extractedGender === 'Female' ? parsed.extractedGender : '';
  const genderCheck = matchApplicantGenderWithId(expectedGenderStr, extractedGender);

  const extractedCivilStatus = String(parsed.extractedCivilStatus || '').trim();
  const civilStatusCheck = matchApplicantCivilStatusWithId(expectedCivilStatusStr, extractedCivilStatus);

  const allFieldsMatch =
    matchesExpectedSide &&
    matchesExpectedType &&
    matchesExpectedName &&
    dobCheck.matches &&
    idNumMatchesScan &&
    genderCheck.matches &&
    civilStatusCheck.matches;

  const mismatchWarning = !parsed.isId
    ? `Not a valid ${idSide} ID (${detectedLabel}). Please attach your ${expectedTypeStr || 'official ID'}.`
    : !matchesExpectedSide
    ? `${idSide === 'front' ? 'Front' : 'Back'} ID slot contains the ${detectedSide === 'back' ? 'Back' : 'Front'} side of an ID. Please attach the actual ${idSide === 'front' ? 'Front' : 'Back'} side.`
    : !profileTypeCheck.matches
    ? profileTypeCheck.reason
    : !matchesExpectedType && expectedTypeStr
    ? `ID mismatch: Selected "${expectedTypeStr}", but uploaded ${detectedLabel}. Please try again.`
    : !matchesExpectedName && expectedNameStr
    ? deterministicNameCheck.reason ||
      `Name mismatch: Account name "${expectedNameStr}" does not match ID name${extractedName ? ` "${extractedName}"` : ''}.`
    : !dobCheck.matches
    ? dobCheck.reason
    : !idNumMatchesScan
    ? idNumCheck.reason
    : !genderCheck.matches
    ? genderCheck.reason
    : !civilStatusCheck.matches
    ? civilStatusCheck.reason
    : null;

  return res.json({
    success: true,
    analysis: {
      isId: Boolean(parsed.isId),
      isClear: Boolean(parsed.isClear),
      isBlurry: !Boolean(parsed.isClear),
      detectedDocType: detectedLabel,
      detectedSide,
      matchesExpectedSide,
      expectedIdType: expectedTypeStr || undefined,
      matchesExpectedType,
      photoMatchesExpectedType,
      expectedName: expectedNameStr || undefined,
      matchesExpectedName,
      expectedBirthdate: expectedBirthdateStr || undefined,
      matchesExpectedBirthdate: dobCheck.matches,
      matchesExpectedAddress: true,
      expectedIdNumber: expectedIdNumberStr || undefined,
      matchesExpectedIdNumber: idNumMatchesScan,
      expectedGender: expectedGenderStr || undefined,
      matchesExpectedGender: genderCheck.matches,
      expectedCivilStatus: expectedCivilStatusStr || undefined,
      matchesExpectedCivilStatus: civilStatusCheck.matches,
      aiVisionUsed: true,
      warning:
        mismatchWarning ||
        (!parsed.isClear
          ? (parsed.warning || 'Photo is blurry or unclear. Please try again.')
          : !parsed.isId
            ? (parsed.warning || 'Not a valid ID. Does not qualify.')
            : null),
      advice: !matchesExpectedSide
        ? `Please upload the ${idSide === 'front' ? 'Front' : 'Back'} photo of your ${expectedTypeStr || 'ID'}.`
        : !matchesExpectedType
        ? (profileTypeCheck.reason || `Upload both Front and Back of your ${expectedTypeStr} and try again.`)
        : !matchesExpectedName
        ? 'Ensure your filled-out Legal Name matches your printed ID name.'
        : !dobCheck.matches || !idNumMatchesScan || !genderCheck.matches || !civilStatusCheck.matches
        ? 'Your filled-out information does not match the attached ID. Correct your info or attach your own matching ID.'
        : (parsed.advice || (parsed.isId ? (parsed.isClear ? 'Valid ID detected.' : 'Please retake a clearer photo and try again.') : 'Attach a valid ID photo and try again.')),
      score: !allFieldsMatch
        ? 25
        : (typeof parsed.score === 'number' ? parsed.score : (parsed.isId ? (parsed.isClear ? 90 : 40) : 20)),
      extractedName,
      extractedBirthdate,
      extractedIdType: parsed.extractedIdType || '',
      extractedIdNumber,
      extractedAddress,
      extractedAge,
      extractedGender,
      extractedCivilStatus,
      detectedFlags: {
        isSenior: Boolean(parsed.isSenior),
        isPwd: Boolean(parsed.isPwd),
        isSoloParent: Boolean(parsed.isSoloParent),
        isStudent: Boolean(parsed.isStudent)
      }
    }
  });
});

function extractPdfLiteralStrings(rawChunk: string): string {
  const tokens: string[] = [];
  const parenRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = parenRegex.exec(rawChunk)) !== null) {
    const cleaned = match[1]
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .replace(/\\t/g, ' ')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
      .replace(/[^\x20-\x7E]/g, ' ')
      .trim();
    if (cleaned.length >= 2) tokens.push(cleaned);
  }
  return tokens.join(' ');
}

function extractServerDocumentText(dataUrl?: string): string {
  if (!dataUrl || typeof dataUrl !== 'string') return '';
  const inlineText = extractTextFromInlineDataUrl(dataUrl);
  if (inlineText) return inlineText;

  if (!dataUrl.toLowerCase().startsWith('data:application/pdf')) {
    return '';
  }

  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return '';
    const body = dataUrl.slice(commaIdx + 1);
    const pdfBuffer = Buffer.from(body, 'base64');
    const rawLatin = pdfBuffer.toString('latin1');
    const chunks: string[] = [extractPdfLiteralStrings(rawLatin)];

    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let streamMatch: RegExpExecArray | null;
    while ((streamMatch = streamRegex.exec(rawLatin)) !== null) {
      try {
        const compressedBuf = Buffer.from(streamMatch[1], 'latin1');
        const inflated = zlib.inflateSync(compressedBuf).toString('latin1');
        const text = extractPdfLiteralStrings(inflated);
        if (text) chunks.push(text);
      } catch {
        // Ignore non-zlib streams
      }
    }

    return chunks.join(' ').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

// AI DOCUMENT INSPECTION: Scan Step 2 Qualification Documents for Blurriness, Validity & Admin Keyword Detection
app.post('/api/ai/validate-document-photo', async (req, res) => {
  const {
    imageBase64,
    mimeType,
    fileName,
    expectedDocument,
    additionalRequirements,
    extractedText: clientExtractedText,
  } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ success: false, message: 'No document image provided.' });
  }

  const expectedDocStr = String(expectedDocument || '').trim();
  const extraReqs = Array.isArray(additionalRequirements)
    ? additionalRequirements.map((r: any) => String(r || '').trim()).filter(Boolean)
    : [];
  const serverExtractedText = extractServerDocumentText(String(imageBase64));
  const combinedPreExtractedText = [String(clientExtractedText || ''), serverExtractedText]
    .filter(Boolean)
    .join(' ')
    .trim();

  let rawBase64 = String(imageBase64).trim();
  let detectedMime = mimeType || 'image/jpeg';
  if (rawBase64.includes('base64,')) {
    const parts = rawBase64.split('base64,');
    const header = parts[0];
    rawBase64 = (parts[1] || '').trim();
    if (header.includes('image/png')) detectedMime = 'image/png';
    else if (header.includes('image/webp')) detectedMime = 'image/webp';
    else if (header.includes('image/svg')) detectedMime = 'image/svg+xml';
    else if (header.includes('application/pdf')) detectedMime = 'application/pdf';
    else detectedMime = 'image/jpeg';
  }
  rawBase64 = rawBase64.replace(/\s+/g, '');

  const isStrictDocBase64 =
    rawBase64.length >= 256 &&
    rawBase64.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(rawBase64);

  let hasValidUploadBytes = false;
  if (isStrictDocBase64) {
    try {
      const sampleBuf = Buffer.from(rawBase64.slice(0, 32), 'base64');
      const isJpeg = sampleBuf.length >= 3 && sampleBuf[0] === 0xff && sampleBuf[1] === 0xd8 && sampleBuf[2] === 0xff;
      const isPng = sampleBuf.length >= 4 && sampleBuf[0] === 0x89 && sampleBuf[1] === 0x50 && sampleBuf[2] === 0x4e && sampleBuf[3] === 0x47;
      const isWebp = sampleBuf.length >= 12 && sampleBuf.subarray(0, 4).toString('ascii') === 'RIFF' && sampleBuf.subarray(8, 12).toString('ascii') === 'WEBP';
      const isPdfBytes =
        detectedMime === 'application/pdf' &&
        rawBase64.length <= 6_500_000 &&
        sampleBuf.length >= 4 &&
        sampleBuf.subarray(0, 4).toString('ascii') === '%PDF';
      hasValidUploadBytes = isJpeg || isPng || isWebp || isPdfBytes;
    } catch {
      hasValidUploadBytes = false;
    }
  }

  const reqKeywordsInfo = expectedDocStr
    ? extractKeywordsForRequirement(expectedDocStr)
    : null;
  const expectedDocHint = expectedDocStr ? getRequirementHintLabel(expectedDocStr) : '';
  const keywordPromptList = [
    ...(reqKeywordsInfo?.allEffectiveKeywords || []),
    ...extraReqs.flatMap((r) => extractKeywordsForRequirement(r).allEffectiveKeywords),
  ];
  const uniquePromptKeywords = Array.from(new Set(keywordPromptList)).slice(0, 20);

  const docAiClient = getAiClient();
  if (docAiClient && hasValidUploadBytes) {
    const requirementDesc = expectedDocStr
      ? `Required document: "${expectedDocStr}" (must be: ${expectedDocHint})${extraReqs.length > 0 ? ` (or one of: ${extraReqs.join(', ')})` : ''}. Expected keywords: ${uniquePromptKeywords.join(', ') || expectedDocStr}.`
      : '';
    const prompt = `You are a Barangay Bugo qualification document scanner & strict requirement verifier.
Inspect ONLY the actual visual/printed content of this uploaded document${requirementDesc ? `\n${requirementDesc}` : ''}
CRITICAL RULES:
- NEVER trust or rely on the uploaded filename. Inspect the actual document pixels/pages.
- Strictly match the document against the exact required document ("${expectedDocStr || 'supporting document'}"):
  * TOR / Grades / Report Card: ONLY accept Transcript of Records, Report Card, Grade Sheet, Form 138/137, SF9/SF10, or Grade Slip showing grades. Reject Diplomas without grades or CORs.
  * Certificate of Registration (COR) / Enrollment Form: ONLY accept school COR, matriculation, or official study load/enrollment form. Reject TORs, Diplomas, or business registrations.
  * Medical Certificate / Clinical Abstract: ONLY accept a signed Medical Certificate or Clinical Abstract from a physician/hospital. Reject Bills, Prescriptions, or Lab Requests.
  * Hospital Bill / Statement of Account: ONLY accept an itemized Hospital Bill or Statement of Account. Reject Prescriptions or Medical Certificates.
  * Doctor's Prescription (Reseta): ONLY accept a medical prescription (Rx / Reseta) listing prescribed medicines.
  * Laboratory Request / Referral: ONLY accept a diagnostic/lab test request or medical referral.
  * Birth Certificate / CENOMAR / Marriage Certificate / Death Certificate / Funeral Contract: strictly verify the exact civil registry or funeral contract type — never accept a Birth Certificate for CENOMAR, or a Funeral Contract for a Death Certificate or Indigency, or a Medical Certificate for a Death Certificate.
  * Barangay Indigency / Barangay Residency / Barangay Clearance / Police Blotter / NBI Clearance / Cedula / DTI or SEC / Utility Bill / Rental Contract / Oath of Undertaking / Solo Parent / PWD / OSCA / 2x2 Photo / Pet Vaccination Card / Request or Justification Letter / Valid ID: verify the document visually matches that exact category.
1. Read and extract the visible document title, headers, labels, and key printed words into extractedText.
2. Identify the actual document type in detectedDocType (e.g. "Transcript of Records / Grades", "Certificate of Registration (COR)", "Medical Certificate", "Hospital Bill", "Doctor's Prescription", "Death Certificate", "Funeral Contract", "Birth Certificate", "CENOMAR", "Barangay Indigency", "Barangay Residency", "Police Blotter", "Utility Bill", "Pet Vaccination Card", "Random Photo").
3. Set isValid=true ONLY if it is an official/legitimate document AND strictly matches the required document${expectedDocStr ? ` ("${expectedDocStr}")` : ''}. Set isValid=false and matchesRequirement=false if it is a selfie, pet, food, meme, landscape, blank image, OR a different document type unrelated to the required document.
4. Set matchesRequirement=true ONLY if visible text/content in the document clearly matches the required document type and concepts; otherwise false. Populate matchedKeywords with the detected keywords from the document.
5. Set isClear=true if text is sharp and readable. Set isClear=false if blurry, dark, or unreadable.
6. Provide concise warning (empty if valid, matches requirement, and clear) and advice (max 16 words).
Respond in strict JSON.`;

    const docSchema = {
      type: Type.OBJECT,
      properties: {
        isValid: { type: Type.BOOLEAN },
        isClear: { type: Type.BOOLEAN },
        matchesRequirement: { type: Type.BOOLEAN },
        detectedDocType: { type: Type.STRING },
        extractedText: { type: Type.STRING },
        matchedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
        warning: { type: Type.STRING },
        advice: { type: Type.STRING },
        score: { type: Type.INTEGER }
      },
      required: ['isValid', 'isClear', 'matchesRequirement', 'detectedDocType', 'score']
    };

    const docVisionResult = await generateGeminiVisionJson({
      client: docAiClient,
      parts: [
        { inlineData: { mimeType: detectedMime, data: rawBase64 } },
        { text: prompt }
      ],
      responseSchema: docSchema,
      context: 'gemini_doc_scan',
    });

    if (docVisionResult.data) {
      const parsed = docVisionResult.data;
      const aiExtractedText = [combinedPreExtractedText, String(parsed.extractedText || '')]
        .filter(Boolean)
        .join(' ')
        .trim();
      const aiMatchedKws = Array.isArray(parsed.matchedKeywords)
        ? parsed.matchedKeywords.map((k: any) => String(k || '').trim()).filter(Boolean)
        : [];

      const kwCheck = (expectedDocStr || extraReqs.length > 0)
        ? matchRequirementKeywords({
            expectedRequirement: expectedDocStr || extraReqs[0],
            additionalRequirements: extraReqs,
            fileName: String(fileName || ''),
            extractedText: aiExtractedText,
            detectedDocType: String(parsed.detectedDocType || ''),
            matchedKeywordsFromAi: aiMatchedKws,
          })
        : { isMatch: true, matchedKeywords: aiMatchedKws, expectedKeywords: [] as string[], reason: undefined as string | undefined };

      const keywordMatched = Boolean(parsed.matchesRequirement !== false) && kwCheck.isMatch;
      const finalIsValid = Boolean(parsed.isValid) && keywordMatched;
      const finalIsClear = Boolean(parsed.isClear);

      let finalWarning = parsed.warning || null;
      if (!finalIsClear) {
        finalWarning = finalWarning || 'Document photo is blurry or unreadable. Please try again.';
      } else if (!keywordMatched) {
        finalWarning =
          kwCheck.reason ||
          `Invalid document (detected "${parsed.detectedDocType || 'Unrelated'}") — must be ${expectedDocHint || expectedDocStr}.`;
      } else if (!finalIsValid) {
        finalWarning =
          finalWarning ||
          `Invalid document — must be ${expectedDocHint || expectedDocStr || 'a recognized qualification document'}.`;
      }

      return res.json({
        success: true,
        analysis: {
          isValid: finalIsValid,
          isClear: finalIsClear,
          detectedDocType: parsed.detectedDocType || expectedDocStr || 'Supporting Document',
          extractedText: aiExtractedText.slice(0, 500),
          matchedKeywords: kwCheck.matchedKeywords,
          expectedKeywords: kwCheck.expectedKeywords,
          warning: finalWarning,
          advice: parsed.advice || (finalIsValid && finalIsClear
            ? 'Document photo and required keywords verified.'
            : `Upload a clear "${expectedDocStr || 'required document'}" showing its official title/keywords.`),
          score: finalIsValid && finalIsClear ? (typeof parsed.score === 'number' ? parsed.score : 88) : Math.min(35, Number(parsed.score) || 25)
        }
      });
    } else if (docVisionResult.errorInfo) {
      logInfo('gemini_doc_vision_fallback', {
        statusCode: docVisionResult.errorInfo.statusCode,
        reason: docVisionResult.errorInfo.message,
      });
    }
  }

  const nameLower = String(fileName || '').toLowerCase();
  const isPdfOrInlineText =
    detectedMime === 'application/pdf' ||
    detectedMime === 'image/svg+xml' ||
    nameLower.endsWith('.pdf') ||
    nameLower.endsWith('.svg') ||
    Boolean(combinedPreExtractedText);
  const isInvalidName = ['selfie', 'food', 'cat', 'dog', 'meme', 'wallpaper', 'vacation'].some(k => nameLower.includes(k));
  const isBlurryFallback = nameLower.includes('blur') || (!isPdfOrInlineText && String(imageBase64).length < 4000);

  if (isInvalidName) {
    return res.json({
      success: true,
      analysis: {
        isValid: false,
        isClear: true,
        detectedDocType: 'Unrecognized / Non-Document Photo',
        matchedKeywords: [],
        expectedKeywords: reqKeywordsInfo?.allEffectiveKeywords || [],
        warning: 'Invalid image — does not look like an official qualification document. Please try again.',
        advice: 'Upload a photo of your actual document, receipt, prescription, or certificate.',
        score: 20
      }
    });
  }

  if (isBlurryFallback) {
    return res.json({
      success: true,
      analysis: {
        isValid: false,
        isClear: false,
        detectedDocType: 'Blurred / Low Resolution Image',
        matchedKeywords: [],
        expectedKeywords: reqKeywordsInfo?.allEffectiveKeywords || [],
        warning: 'Photo is blurry or unclear. Please retake in bright lighting and try again.',
        advice: 'Hold camera steady on a flat desk so all text is readable.',
        score: 35
      }
    });
  }

  if (expectedDocStr || extraReqs.length > 0) {
    const kwCheck = matchRequirementKeywords({
      expectedRequirement: expectedDocStr || extraReqs[0],
      additionalRequirements: extraReqs,
      fileName: String(fileName || ''),
      extractedText: combinedPreExtractedText,
    });

    if (!kwCheck.isMatch) {
      return res.json({
        success: true,
        analysis: {
          isValid: false,
          isClear: true,
          detectedDocType: 'Unrelated / Keyword Mismatch Document',
          matchedKeywords: [],
          expectedKeywords: kwCheck.expectedKeywords,
          extractedText: combinedPreExtractedText.slice(0, 400),
          warning: kwCheck.reason || `Invalid document — no keyword related to "${expectedDocStr || extraReqs[0]}" was detected in "${fileName || 'uploaded file'}".`,
          advice: `Upload a file containing keywords/details matching "${expectedDocStr || extraReqs[0]}".`,
          score: 20
        }
      });
    }

    return res.json({
      success: true,
      analysis: {
        isValid: true,
        isClear: true,
        detectedDocType: kwCheck.matchedRequirement || expectedDocStr || 'Supporting Qualification Document',
        matchedKeywords: kwCheck.matchedKeywords,
        expectedKeywords: kwCheck.expectedKeywords,
        extractedText: combinedPreExtractedText.slice(0, 400),
        warning: null,
        advice: kwCheck.matchedKeywords.length > 0
          ? `Document verified — detected keyword(s): ${kwCheck.matchedKeywords.slice(0, 4).join(', ')}.`
          : 'Qualification document looks clear and ready.',
        score: 90
      }
    });
  }

  return res.json({
    success: true,
    analysis: {
      isValid: true,
      isClear: true,
      detectedDocType: expectedDocStr || 'Supporting Qualification Document',
      warning: null,
      advice: 'Qualification document looks clear and ready.',
      score: 90
    }
  });
});

// AUTH: Strict Resident Registration with Bcrypt & JWT Issuance
app.post('/api/auth/register', async (req, res) => {
  const {
    name,
    firstName,
    middleName,
    lastName,
    suffix,
    birthdate,
    email,
    contactNumber,
    purok,
    address,
    householdIncome,
    familyMembersCount,
    password,
    idType,
    idNumber,
    frontIdUrl,
    backIdUrl,
    idPhotoAnalysis,
    backIdPhotoAnalysis,
    age,
    civilStatus,
    occupation,
    employmentStatus,
    nationality,
    gender,
    yearsOfResidency,
    isPwd,
    pwdIdNumber,
    pwdDisabilityType,
    isSoloParent,
    soloParentIdNumber,
    isSenior,
    seniorIdNumber,
    isStudent,
    schoolName,
    studentLevel,
    isTeenager,
    hasMedicalNeed,
    medicalConditionNote,
    isDisasterAffected,
    disasterType,
    disasterDamageLevel,
    avatarUrl
  } = req.body;

  const cleanFirst = firstName ? String(firstName).trim() : '';
  const cleanMiddle = middleName ? String(middleName).trim() : '';
  const cleanLast = lastName ? String(lastName).trim() : '';
  const cleanSuffix = suffix ? String(suffix).trim() : '';
  const composedFromParts = [cleanFirst, cleanMiddle, cleanLast, cleanSuffix].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const cleanName = composedFromParts || String(name || '').trim();

  if (!cleanName || !email || !password || !contactNumber || !address || !purok) {
    return res.status(400).json({
      success: false,
      message: 'All mandatory registration fields marked with an asterisk must be completed.'
    });
  }

  const nameParts = cleanName.split(/\s+/);
  if (nameParts.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Please enter both your First Name and Last Name.'
    });
  }
  if (/[0-9]/.test(cleanName)) {
    return res.status(400).json({
      success: false,
      message: 'Legal name cannot contain numbers.'
    });
  }

  const parsedAgeInput = age !== undefined && age !== null && age !== '' && !isNaN(Number(age)) ? Number(age) : null;
  let computedAge = parsedAgeInput !== null ? parsedAgeInput : 28;
  const cleanBirthdate = birthdate ? String(birthdate).trim() : '';
  if (cleanBirthdate) {
    const ymdMatch = cleanBirthdate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    let dobYear: number;
    let dobMonth: number;
    let dobDay: number;
    let dobDateForFutureCheck: Date;
    if (ymdMatch) {
      dobYear = Number(ymdMatch[1]);
      dobMonth = Number(ymdMatch[2]) - 1;
      dobDay = Number(ymdMatch[3]);
      dobDateForFutureCheck = new Date(dobYear, dobMonth, dobDay);
    } else {
      const dob = new Date(cleanBirthdate);
      if (isNaN(dob.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid birthdate.'
        });
      }
      dobYear = dob.getFullYear();
      dobMonth = dob.getMonth();
      dobDay = dob.getDate();
      dobDateForFutureCheck = dob;
    }
    const today = new Date();
    if (
      isNaN(dobDateForFutureCheck.getTime()) ||
      dobDateForFutureCheck.getFullYear() !== dobYear ||
      dobDateForFutureCheck.getMonth() !== dobMonth ||
      dobDateForFutureCheck.getDate() !== dobDay ||
      dobDateForFutureCheck > today
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid birthdate.'
      });
    }
    let calcAge = today.getFullYear() - dobYear;
    const m = today.getMonth() - dobMonth;
    if (m < 0 || (m === 0 && today.getDate() < dobDay)) {
      calcAge -= 1;
    }
    if (calcAge < 0 || calcAge > 120) {
      return res.status(400).json({
        success: false,
        message: 'Birthdate produces an invalid age range.'
      });
    }
    computedAge = calcAge;
  }

  if (cleanBirthdate && parsedAgeInput !== null) {
    if (Math.abs(parsedAgeInput - computedAge) > 1) {
      return res.status(400).json({
        success: false,
        message: `Age (${age}) does not match your entered Birthdate (${cleanBirthdate}, age ${computedAge}).`
      });
    }
  }

  const cleanEmail = normalizeAccountEmail(email);
  if (!isAllowedAccountEmail(cleanEmail)) {
    return res.status(400).json({
      success: false,
      message: ALLOWED_EMAIL_DOMAIN_MESSAGE
    });
  }

  if (db.users.some(u => matchesUserAccountEmail(u, cleanEmail))) {
    return res.status(409).json({
      success: false,
      message: 'This email address is already registered in Barangay Bugo registry.'
    });
  }

  const normalizedRegPhone = normalizePhMobile(contactNumber);
  if (!normalizedRegPhone.valid) {
    return res.status(400).json({
      success: false,
      message: normalizedRegPhone.reason || 'Contact number must be a real 11-digit Philippine mobile number starting with 09 (e.g. 0917 628 4915).'
    });
  }

  if (String(address).trim().length < 5) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a complete residential street address (house number, street name, and zone).'
    });
  }

  const effectiveIdType = idType || 'PhilSys National ID';
  const effectiveFrontId = frontIdUrl || req.body.idDocumentUrl;

  if (!effectiveFrontId || !backIdUrl) {
    return res.status(400).json({
      success: false,
      message: 'Please attach both Front and Back photos of your valid ID.'
    });
  }

  const normFrontPayload = String(effectiveFrontId).replace(/^data:[^;]+;base64,/, '');
  const normBackPayload = String(backIdUrl).replace(/^data:[^;]+;base64,/, '');
  if (
    (String(effectiveFrontId).length > 500 && String(effectiveFrontId) === String(backIdUrl)) ||
    (normFrontPayload.length > 400 && normFrontPayload === normBackPayload)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Front ID and Back ID cannot be the exact same image. Please attach separate Front and Back photos of your ID.'
    });
  }

  const profileIdTypeCheck = matchIdTypeWithProfile({ idType: effectiveIdType, age: computedAge, isSenior: Boolean(isSenior) });
  if (!profileIdTypeCheck.matches) {
    return res.status(400).json({
      success: false,
      message: profileIdTypeCheck.reason || `Selected Resident ID Type "${effectiveIdType}" is not valid for this profile.`
    });
  }

  if (!idPhotoAnalysis || !backIdPhotoAnalysis) {
    return res.status(400).json({
      success: false,
      message: 'Both Front and Back ID photos must be scanned and verified before creating an account.'
    });
  }

  if (idPhotoAnalysis.aiVisionUsed === false || backIdPhotoAnalysis.aiVisionUsed === false) {
    return res.status(400).json({
      success: false,
      message: 'Attached Front or Back ID could not be verified. Please re-upload clear photos of your ID.'
    });
  }

  if (idPhotoAnalysis.isId !== true || backIdPhotoAnalysis.isId !== true) {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID attachment: Both Front and Back photos must be a valid official ID.'
    });
  }

  if (idPhotoAnalysis.isClear !== true || backIdPhotoAnalysis.isClear !== true) {
    return res.status(400).json({
      success: false,
      message: 'ID photo is blurry or unclear. Please try again with a clearer photo.'
    });
  }

  if (
    idPhotoAnalysis.matchesExpectedSide === false ||
    idPhotoAnalysis.detectedSide === 'back' ||
    backIdPhotoAnalysis.matchesExpectedSide === false ||
    backIdPhotoAnalysis.detectedSide === 'front'
  ) {
    return res.status(400).json({
      success: false,
      message: 'ID side mismatch: Please upload the Front photo in the Front slot and the Back photo in the Back slot.'
    });
  }

  const selectedCanon = canonicalizeIdCategory(effectiveIdType);
  const frontDetectedCanon = canonicalizeIdCategory(idPhotoAnalysis?.extractedIdType || idPhotoAnalysis?.detectedDocType);
  const backDetectedCanon = canonicalizeIdCategory(backIdPhotoAnalysis?.extractedIdType || backIdPhotoAnalysis?.detectedDocType);

  if (
    idPhotoAnalysis?.matchesExpectedType === false ||
    backIdPhotoAnalysis?.matchesExpectedType === false ||
    (selectedCanon && frontDetectedCanon && frontDetectedCanon !== selectedCanon) ||
    (selectedCanon && backDetectedCanon && backDetectedCanon !== selectedCanon)
  ) {
    return res.status(400).json({
      success: false,
      message: `ID Type mismatch: Attached Front or Back ID does not match selected Resident ID Type "${effectiveIdType}". Please upload your ${effectiveIdType} and try again.`
    });
  }

  const frontExtractedName = String(idPhotoAnalysis?.extractedName || '').trim();
  const backExtractedName = String(backIdPhotoAnalysis?.extractedName || '').trim();
  const hasValidFrontName = frontExtractedName.split(/\s+/).filter(Boolean).length >= 2;
  const hasValidBackName = backExtractedName.split(/\s+/).filter(Boolean).length >= 2;
  if (!hasValidFrontName && !hasValidBackName) {
    return res.status(400).json({
      success: false,
      message: 'Could not read a valid cardholder name on either the Front or Back ID photo. Please attach clear Front and Back ID photos showing your full name.'
    });
  }

  const frontNameMatch = matchApplicantNameWithId(
    { firstName: cleanFirst, middleName: cleanMiddle, lastName: cleanLast, suffix: cleanSuffix, fullName: cleanName },
    frontExtractedName
  );
  const backNameMatch = matchApplicantNameWithId(
    { firstName: cleanFirst, middleName: cleanMiddle, lastName: cleanLast, suffix: cleanSuffix, fullName: cleanName },
    backExtractedName
  );

  if (
    (frontNameMatch.compared ? !frontNameMatch.matches : (hasValidFrontName && idPhotoAnalysis?.matchesExpectedName === false)) ||
    (backNameMatch.compared ? !backNameMatch.matches : (hasValidBackName && backIdPhotoAnalysis?.matchesExpectedName === false))
  ) {
    return res.status(400).json({
      success: false,
      message:
        (!frontNameMatch.matches && frontNameMatch.reason) ||
        (!backNameMatch.matches && backNameMatch.reason) ||
        `Name mismatch: The name on your attached/scanned ID does not match "${cleanName}". Please attach your own matching ID or update your filled-out name.`
    });
  }

  const frontDobMatch = matchApplicantBirthdateWithId(
    { birthdate: cleanBirthdate, age: computedAge },
    { extractedBirthdate: idPhotoAnalysis?.extractedBirthdate, extractedAge: idPhotoAnalysis?.extractedAge }
  );
  const backDobMatch = matchApplicantBirthdateWithId(
    { birthdate: cleanBirthdate, age: computedAge },
    { extractedBirthdate: backIdPhotoAnalysis?.extractedBirthdate, extractedAge: backIdPhotoAnalysis?.extractedAge }
  );
  if (
    idPhotoAnalysis?.matchesExpectedBirthdate === false ||
    backIdPhotoAnalysis?.matchesExpectedBirthdate === false ||
    !frontDobMatch.matches ||
    !backDobMatch.matches
  ) {
    return res.status(400).json({
      success: false,
      message:
        (!frontDobMatch.matches && frontDobMatch.reason) ||
        (!backDobMatch.matches && backDobMatch.reason) ||
        'Birthdate/Age mismatch: Your filled-out birthdate/age does not match the attached ID.'
    });
  }

  const idNumAcrossSides = matchApplicantIdNumberAcrossSides(
    idNumber,
    idPhotoAnalysis?.extractedIdNumber,
    backIdPhotoAnalysis?.extractedIdNumber
  );
  if (idNumAcrossSides.compared && !idNumAcrossSides.matches) {
    return res.status(400).json({
      success: false,
      message:
        idNumAcrossSides.reason ||
        'ID Number mismatch: Your filled-out ID Number does not match the attached Front or Back ID.'
    });
  }

  const frontGenderMatch = matchApplicantGenderWithId(gender, idPhotoAnalysis?.extractedGender);
  const backGenderMatch = matchApplicantGenderWithId(gender, backIdPhotoAnalysis?.extractedGender);
  if (
    idPhotoAnalysis?.matchesExpectedGender === false ||
    backIdPhotoAnalysis?.matchesExpectedGender === false ||
    !frontGenderMatch.matches ||
    !backGenderMatch.matches
  ) {
    return res.status(400).json({
      success: false,
      message:
        (!frontGenderMatch.matches && frontGenderMatch.reason) ||
        (!backGenderMatch.matches && backGenderMatch.reason) ||
        'Gender mismatch: Your selected Gender does not match the sex/gender on the attached ID.'
    });
  }

  const frontCivilMatch = matchApplicantCivilStatusWithId(civilStatus, idPhotoAnalysis?.extractedCivilStatus);
  const backCivilMatch = matchApplicantCivilStatusWithId(civilStatus, backIdPhotoAnalysis?.extractedCivilStatus);
  if (
    idPhotoAnalysis?.matchesExpectedCivilStatus === false ||
    backIdPhotoAnalysis?.matchesExpectedCivilStatus === false ||
    !frontCivilMatch.matches ||
    !backCivilMatch.matches
  ) {
    return res.status(400).json({
      success: false,
      message:
        (!frontCivilMatch.matches && frontCivilMatch.reason) ||
        (!backCivilMatch.matches && backCivilMatch.reason) ||
        'Civil Status mismatch: Your selected Civil Status does not match the attached ID.'
    });
  }

  const crossSideConsistency = matchFrontAndBackIdConsistency(idPhotoAnalysis, backIdPhotoAnalysis, {
    expectedIdNumber: idNumber,
  });
  if (crossSideConsistency.compared && !crossSideConsistency.matches) {
    return res.status(400).json({
      success: false,
      message: crossSideConsistency.reason || 'Front and Back ID photos do not appear to belong to the same ID card.'
    });
  }

  const rawPassword = String(password);
  const passStrength = validatePasswordStrengthServer(rawPassword);
  if (!passStrength.isValid) {
    return res.status(400).json({
      success: false,
      message: passStrength.message || 'Password must be strong (at least 8 characters with uppercase, lowercase, number, and special character).'
    });
  }

  let newId = `user-${Date.now()}`;
  if (db.users.some(u => u.id === newId)) {
    newId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  }
  const existingResidentIdNumbers = new Set(db.users.map(u => String(u.residentIdNumber || '').toUpperCase()));
  let generatedIdNumber = `BG-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  let attempts = 0;
  while (existingResidentIdNumbers.has(generatedIdNumber.toUpperCase()) && attempts < 25) {
    generatedIdNumber = `BG-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    attempts += 1;
  }
  if (existingResidentIdNumbers.has(generatedIdNumber.toUpperCase())) {
    generatedIdNumber = `BG-2026-${Date.now().toString().slice(-6)}`;
  }
  const passwordHash = hashPassword(rawPassword);
  if (!verifyPassword(rawPassword, passwordHash)) {
    return res.status(500).json({
      success: false,
      message: 'Failed to securely store account credentials. Please try again.'
    });
  }
  const parsedAge = computedAge;
  const resolvedGender = gender === 'Male' || gender === 'Female' || gender === 'Other' ? gender : 'Female';

  // Auto-validate registration automatically if resident already has a verified/valid matching application in registry
  const matchingApp = (db.applications || []).find((a: any) =>
    a.status !== 'Disqualified' &&
    a.status !== 'Rejected' &&
    ((a.email && a.email.toLowerCase() === cleanEmail) ||
      (a.applicantName && a.applicantName.trim().toLowerCase() === cleanName.toLowerCase()))
  );

  const newUser = {
    id: newId,
    name: cleanName,
    ...(cleanFirst ? { firstName: cleanFirst } : {}),
    ...(cleanMiddle ? { middleName: cleanMiddle } : {}),
    ...(cleanLast ? { lastName: cleanLast } : {}),
    ...(cleanSuffix ? { suffix: cleanSuffix } : {}),
    ...(cleanBirthdate ? { birthdate: cleanBirthdate } : {}),
    email: cleanEmail,
    username: cleanEmail,
    passwordHash,
    role: 'resident' as const,
    accountSource: 'create_account' as const,
    contactNumber: normalizedRegPhone.local09,
    purok: stripZoneName(purok) || 'Zone 1',
    address: String(address).trim(),
    residentIdNumber: generatedIdNumber,
    isVerified: true,
    registrationStatus: 'Verified' as const,
    ...(matchingApp ? { autoValidatedFromApplication: true, autoValidatedRefCode: matchingApp.referenceCode } : {}),
    registeredDate: new Date().toISOString().split('T')[0],
    householdIncome: householdIncome || '₱8,500.00',
    familyMembersCount: Number(familyMembersCount) || 4,
    voterStatus: 'Registered' as const,
    occupation: occupation || 'Resident',
    employmentStatus: employmentStatus || 'Self-Employed',
    civilStatus: civilStatus || 'Single',
    nationality: nationality || 'Filipino',
    age: parsedAge,
    gender: resolvedGender,
    yearsOfResidency: Number(yearsOfResidency) || 1,
    idType: effectiveIdType,
    ...(idNumber ? { idNumber: String(idNumber).trim() } : {}),
    isPwd: Boolean(isPwd),
    ...(isPwd && pwdIdNumber ? { pwdIdNumber: String(pwdIdNumber).trim() } : {}),
    ...(isPwd && pwdDisabilityType ? { pwdDisabilityType } : {}),
    isSoloParent: Boolean(isSoloParent),
    ...(isSoloParent && soloParentIdNumber ? { soloParentIdNumber: String(soloParentIdNumber).trim() } : {}),
    isSenior: Boolean(isSenior) || parsedAge >= 60,
    ...(seniorIdNumber ? { seniorIdNumber: String(seniorIdNumber).trim() } : {}),
    isStudent: Boolean(isStudent),
    ...(isStudent && schoolName ? { schoolName: String(schoolName).trim() } : {}),
    ...(isStudent && studentLevel ? { studentLevel } : {}),
    isTeenager: Boolean(isTeenager) || (parsedAge >= 13 && parsedAge <= 19),
    hasMedicalNeed: Boolean(hasMedicalNeed),
    ...(hasMedicalNeed && medicalConditionNote ? { medicalConditionNote: String(medicalConditionNote).trim() } : {}),
    isDisasterAffected: Boolean(isDisasterAffected),
    ...(isDisasterAffected && disasterType ? { disasterType } : {}),
    ...(isDisasterAffected && disasterDamageLevel ? { disasterDamageLevel } : {}),
    frontIdUrl: effectiveFrontId,
    backIdUrl,
    idPhotoAnalysis,
    backIdPhotoAnalysis,
    avatarUrl: avatarUrl || effectiveFrontId || (String(gender).toLowerCase() === 'female'
      ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanName.replace(/\s+/g, ''))}&top=straight02&facialHairProbability=0&clothing=shirtVNeck&backgroundColor=ffd5dc`
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanName.replace(/\s+/g, ''))}&top=shortFlat&facialHair=beardLight&clothing=collarAndSweater&backgroundColor=b6e3f4`)
  };

  const existingNotifsLength = (db.notifications || []).length;
  db.users.unshift(newUser);

  if (isMySqlConfigured()) {
    try {
      await syncUserToMySQL(newUser);
    } catch (mysqlErr) {
      logServerError('mysql-sync:user.register', mysqlErr);
      if (IS_PROD && activePersistenceMode === 'mysql-prisma') {
        db.users = db.users.filter(u => u.id !== newId);
        return res.status(500).json({
          success: false,
          message: 'Failed to save your account to the database. Please try again.'
        });
      }
    }
  }

  addNotificationSafely(db, {
    userId: 'admin-juan-delacruz',
    title: 'New Resident Account Approved',
    message: matchingApp
      ? `${newUser.name} created a Resident Account and was automatically approved (matched Application ${matchingApp.referenceCode}).`
      : `${newUser.name} created a Resident Account from ${newUser.purok} with ${effectiveIdType} and was automatically approved.`,
    type: 'registration_approved',
    targetArea: 'residents'
  });

  const savedOk = saveDatabase(db);
  if (!savedOk && activePersistenceMode === 'json-local') {
    db.users = db.users.filter(u => u.id !== newId);
    if (Array.isArray(db.notifications) && db.notifications.length > existingNotifsLength) {
      db.notifications = db.notifications.filter(
        n => n.userId !== newId && !String(n.message || '').includes(newUser.name)
      );
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to save your account to system storage. Please try again.'
    });
  }

  broadcastSystemUpdate('residents', 'register', { id: newId });

  const qualifiedPrograms = getQualifiedProgramsForResident(newUser, db.programs, {
    disasterVictims: db.disasterVictims || []
  });

  const token = signAuthToken(newUser);
  const { passwordHash: _, ...safeUser } = newUser;
  res.json({
    success: true,
    user: safeUser,
    token,
    sessionToken: token,
    residentId: newId,
    residentIdNumber: generatedIdNumber,
    credentialsSaved: true,
    qualifiedProgramIds: qualifiedPrograms.map(p => p.id),
    qualifiedCount: qualifiedPrograms.length
  });
});

// VOUCHER: Get Signed QR Payload (Strict Boundary Enforcement)
app.get('/api/vouchers/sign/:refCode', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const { refCode } = req.params;
  const appItem = db.applications.find(a => a.referenceCode.toUpperCase() === refCode.toUpperCase());

  if (!appItem) {
    return res.status(404).json({ success: false, message: 'Application not found.' });
  }

  if (req.authUser?.role !== 'admin' && appItem.applicantId !== req.authUser?.sub) {
    return res.status(403).json({ success: false, message: 'Forbidden: You may only sign vouchers for your own applications.' });
  }

  if (appItem.status === 'Disqualified' || appItem.status === 'Rejected') {
    return res.status(403).json({
      success: false,
      message: 'Claim Voucher Blocked: Application is Disqualified under program eligibility boundaries. An official voucher cannot be generated for disqualified applications.'
    });
  }

  const token = generateVoucherToken(appItem.referenceCode, appItem.applicantId, appItem.approvedAmount || appItem.requestedAmount);
  const baseUrl = sanitizeEnvValue(process.env.APP_URL).replace(/\/$/, '') || 'https://bugo-portal.gov.ph';

  res.json({
    success: true,
    referenceCode: appItem.referenceCode,
    applicantId: appItem.applicantId,
    amount: appItem.approvedAmount || appItem.requestedAmount,
    token,
    verifyUrl: `${baseUrl}/verify?ref=${encodeURIComponent(appItem.referenceCode)}&token=${token}`
  });
});

// VOUCHER: Cryptographic QR Signature Verification
app.post('/api/vouchers/verify', authenticateJWT, (req, res) => {
  const { referenceCode, token } = req.body;

  if (!referenceCode) {
    return res.status(400).json({ valid: false, message: 'Reference code required.' });
  }

  const appItem = db.applications.find(a => a.referenceCode.toUpperCase() === String(referenceCode).trim().toUpperCase());

  if (!appItem) {
    return res.json({
      valid: false,
      tampered: false,
      message: 'Voucher reference code not found in official Barangay Bugo registry.'
    });
  }

  if (appItem.status === 'Disqualified' || appItem.status === 'Rejected') {
    return res.json({
      valid: false,
      tampered: false,
      message: 'Void Voucher: This application was disqualified and does not qualify for benefit claim.'
    });
  }

  if (token) {
    const isSignatureValid = verifyVoucherToken(
      appItem.referenceCode,
      appItem.applicantId,
      appItem.approvedAmount || appItem.requestedAmount,
      token
    );

    if (!isSignatureValid) {
      return res.json({
        valid: false,
        tampered: true,
        message: 'Security Alert: Cryptographic signature mismatch! This voucher may have been tampered with or modified.'
      });
    }
  }

  res.json({
    valid: true,
    tampered: false,
    application: appItem,
    message: 'Authentic Official Voucher: Cryptographic signature verified against Barangay records.'
  });
});

// VOUCHERS: Cashier Disbursement Counter Endpoint (Admin Only)
app.post('/api/vouchers/disburse', authenticateJWT, requireRole('admin'), async (req, res) => {
  const { referenceCode, officialReceiptNumber, officerName, paymentMethod, remarks } = req.body;

  if (!referenceCode) {
    return res.status(400).json({ success: false, message: 'Reference code is required.' });
  }

  const appIndex = db.applications.findIndex(a => a.referenceCode === referenceCode);
  if (appIndex === -1) {
    return res.status(404).json({ success: false, message: `Application ${referenceCode} not found.` });
  }

  const appItem = db.applications[appIndex];

  if (appItem.status === 'Disqualified' || appItem.status === 'Rejected') {
    return res.status(403).json({ success: false, message: 'Cannot disburse: Application was disqualified or rejected.' });
  }

  if (appItem.status === 'Disbursed') {
    return res.status(400).json({
      success: false,
      message: `Already Disbursed: Voucher was already redeemed on ${appItem.disbursedAt || 'earlier'} under O.R. #${appItem.officialReceiptNumber || 'N/A'}.`
    });
  }

  const now = new Date().toISOString().split('T')[0];
  const orNumber = officialReceiptNumber || `OR-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const disbursingOfficer = officerName || 'Hon. Juan Dela Cruz (Barangay Cashier)';
  const payMethod = paymentMethod || 'Cash Grant';

  const updated: any = {
    ...appItem,
    status: 'Disbursed',
    lastUpdated: now,
    disbursedAt: now,
    disbursedBy: disbursingOfficer,
    officialReceiptNumber: orNumber,
    paymentMethod: payMethod,
    timeline: [
      {
        status: 'Disbursed',
        timestamp: 'Just now',
        officerName: disbursingOfficer,
        remarks: `Grant disbursed at Treasury window under Official Receipt #${orNumber} (${payMethod}). ${remarks || ''}`.trim()
      },
      ...appItem.timeline
    ]
  };

  db.applications[appIndex] = updated;
  persistAsync(syncApplicationToMySQL(updated), 'application.disburse');

  const logItem = {
    id: `log-${Date.now()}`,
    residentName: appItem.applicantName,
    residentIdNumber: appItem.applicantId || 'RESIDENT',
    purok: appItem.purok,
    actionType: 'Status Updated',
    locationOrService: 'Treasury & Cashier Window',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
    officerInCharge: disbursingOfficer,
    status: 'Completed',
    details: `Disbursed ${appItem.programTitle} voucher ${appItem.referenceCode} (${appItem.approvedAmount || appItem.requestedAmount || '₱5,000.00'}) under O.R. #${orNumber}.`
  };
  db.activityLogs.unshift(logItem);
  persistAsync(syncActivityLogToMySQL(logItem), 'activityLog.disburse');

  const archItem = {
    id: `arch-${Date.now()}`,
    title: `Disbursed Grant: ${appItem.applicantName} (${appItem.programTitle})`,
    originalCategory: 'Service Application',
    referenceCode: appItem.referenceCode,
    deletedBy: disbursingOfficer,
    deletedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    status: 'Archived',
    reasonForArchive: `Automated archive upon release of grant under Official Receipt #${orNumber}.`,
    originalData: {
      residentName: appItem.applicantName,
      purok: appItem.purok,
      programTitle: appItem.programTitle,
      approvedAmount: appItem.approvedAmount || appItem.requestedAmount,
      officialReceiptNumber: orNumber,
      disbursedBy: disbursingOfficer,
      disbursedAt: now
    }
  };
  db.archivedItems.unshift(archItem);
  persistAsync(syncArchiveToMySQL(archItem), 'archive.disburse');

  addNotificationSafely(db, {
    userId: appItem.applicantId,
    title: 'Grant Disbursed & Released',
    message: `Your benefit for "${appItem.programTitle}" (${appItem.referenceCode}) has been released at the Treasury window. Official Receipt #${orNumber}.`,
    type: 'status_update',
    applicationRef: appItem.referenceCode,
    targetArea: 'services',
    documentData: {
      docType: 'Official Assistance Disbursement Voucher',
      controlNumber: `VCH-2026-${(appItem.referenceCode || '').replace(/[^0-9]/g, '').slice(-4) || '9120'}`,
      issueDate: getExactFormattedDate(),
      recipientName: appItem.applicantName,
      subject: `Disbursement & Release of Benefit: ${appItem.programTitle}`,
      narrative: `Official certification that the grant assistance for "${appItem.programTitle}" under control tracking code ${appItem.referenceCode} has been disbursed and released to the beneficiary. Official receipt #${orNumber} has been stamped and filed in the Treasury registry.`,
      venueOrOffice: 'Office of the Barangay Treasurer, Barangay Bugo Hall',
      officialRemarks: `Treasury Voucher stamped. Amount received in full with Official Receipt #${orNumber}.`,
      signatoryName: getEffectiveSecretariatDetails(db).punongBarangay,
      signatoryRole: 'Punong Barangay / Disbursing Officer'
    }
  });

  saveDatabase(db);
  broadcastSystemUpdate('applications', 'disburse', { referenceCode, applicantId: appItem.applicantId });

  res.json({
    success: true,
    application: updated,
    officialReceiptNumber: orNumber,
    message: `Benefit grant for ${appItem.applicantName} successfully marked as DISBURSED.`
  });
});

// AI ASSISTANCE EVALUATION: Brain to detect eligibility boundaries
app.post('/api/ai/evaluate-application', (req, res) => {
  const {
    programId,
    programTitle,
    applicantName,
    purok,
    address,
    householdIncome,
    familyCount,
    occupation,
    employmentStatus,
    hasMedicalNeed,
    isDisasterAffected,
    purpose,
    hasFrontId,
    hasBackId,
    hasSupportingDoc,
    idAnalysis,
    backIdAnalysis
  } = req.body;

  const targetProgram = (db.programs || []).find(
    (p: any) => p.id === programId || (programTitle && p.title?.toLowerCase() === String(programTitle).toLowerCase())
  );

  const evaluation = evaluateApplicantEligibility({
    programId: programId || 'prog-barangay-clearance',
    programTitle: programTitle || targetProgram?.title,
    programCategory: targetProgram?.category,
    targetAudience: targetProgram?.targetAudience,
    programType: targetProgram?.programType,
    qualificationRules: targetProgram?.qualificationRules,
    eligibilityCriteria: targetProgram?.eligibilityCriteria,
    applicantName: applicantName || 'Applicant',
    purok: stripZoneName(purok) || 'Zone 1',
    address: address || 'Barangay Bugo, CDO',
    householdIncome: householdIncome || '₱8,500.00',
    familyCount: Number(familyCount) || 4,
    occupation: occupation || 'Resident',
    employmentStatus,
    hasMedicalNeed: Boolean(hasMedicalNeed),
    isDisasterAffected: Boolean(isDisasterAffected),
    purpose: purpose || '',
    hasFrontId: Boolean(hasFrontId),
    hasBackId: hasBackId !== undefined ? Boolean(hasBackId) : undefined,
    hasSupportingDoc: Boolean(hasSupportingDoc),
    idAnalysis,
    backIdAnalysis
  });

  res.json({
    success: true,
    evaluation
  });
});

// APPLICATIONS: Submit Application (Authenticated Resident/Admin)
app.post('/api/applications', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const appData = req.body || {};
  const targetProgram = (db.programs || []).find(
    (p: any) => p.id === appData.programId || (appData.programTitle && p.title?.toLowerCase() === String(appData.programTitle).toLowerCase())
  );
  if (targetProgram && targetProgram.status === 'Closed') {
    return res.status(403).json({
      success: false,
      message: `"${targetProgram.title}" is currently closed by Barangay Admin.`
    });
  }
  const randomCode = appData.referenceCode || `BUG-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString().split('T')[0];

  const applicantId = req.authUser?.role === 'admin' && appData.applicantId
    ? appData.applicantId
    : req.authUser!.sub;
  const applicantUser = db.users.find(u => u.id === applicantId);

  const duplicateApplication = findExistingProgramApplication(
    db.applications,
    { id: applicantId, email: applicantUser?.email || appData.email },
    { id: targetProgram?.id || appData.programId, title: targetProgram?.title || appData.programTitle }
  );
  if (duplicateApplication) {
    return res.status(409).json({
      success: false,
      code: 'DUPLICATE_APPLICATION',
      message: `You have already applied for "${targetProgram?.title || appData.programTitle || 'this service'}" (Ref: ${duplicateApplication.referenceCode}). Only one application per program or service is allowed.`,
      existingApplication: {
        id: duplicateApplication.id,
        referenceCode: duplicateApplication.referenceCode,
        status: duplicateApplication.status,
        submissionDate: duplicateApplication.submissionDate
      }
    });
  }

  const applicantNameTrimmed = String(appData.applicantName || applicantUser?.name || '').trim();
  const contactRaw = String(appData.contactNumber || applicantUser?.contactNumber || '').trim();
  const phoneCheck = normalizePhMobileNumber(contactRaw);
  const purokTrimmed = String(appData.purok || applicantUser?.purok || '').trim();
  const addressTrimmed = String(appData.address || applicantUser?.address || '').trim();
  const purposeTrimmed = String(appData.purposeOrDiagnosis || appData.purpose || '').trim();

  if (!applicantNameTrimmed || !purokTrimmed || !addressTrimmed) {
    return res.status(400).json({
      success: false,
      message: 'Please complete all required personal and Barangay Bugo residency fields before submitting.'
    });
  }
  if (!contactRaw || !phoneCheck.valid) {
    return res.status(400).json({
      success: false,
      message: phoneCheck.reason || 'Please enter a valid 11-digit Philippine mobile number.'
    });
  }
  if (purposeTrimmed.length < 10) {
    return res.status(400).json({
      success: false,
      message: 'Purpose statement is incomplete. Please provide at least 10 characters explaining your request.'
    });
  }

  const submittedDocuments: any[] = Array.isArray(appData.documents) ? appData.documents : [];
  const frontDoc = submittedDocuments.find((d: any) => d?.docCategory === 'Front ID' || d?.name?.includes('Front'));
  const backDoc = submittedDocuments.find((d: any) => d?.docCategory === 'Back ID' || d?.name?.includes('Back'));
  const frontIdUrlResolved = frontDoc?.fileUrl || frontDoc?.previewUrl || appData.idCardFrontUrl;
  const backIdUrlResolved = backDoc?.fileUrl || backDoc?.previewUrl || appData.idCardBackUrl;
  const hasFrontIdUrl = isRealDocumentUrl(frontIdUrlResolved) || Boolean(frontDoc?.autoAttached);
  const hasBackIdUrl = isRealDocumentUrl(backIdUrlResolved) || Boolean(backDoc?.autoAttached);

  const isDisasterTarget = isDisasterProgram(
    (targetProgram as any) || {
      id: appData.programId,
      title: appData.programTitle,
      category: appData.programCategory,
      programType: appData.programType
    }
  );
  const idOptionalForDisaster =
    targetProgram?.id === 'prog-disaster-relief' ||
    isDisasterTarget ||
    appData.programType === 'disaster';

  // Strict ID authenticity, clarity, side, type, name & duplicate check
  let idValidationError = '';
  const frontAnalysis = frontDoc?.analysis;
  const backAnalysis = backDoc?.analysis;
  if (!idOptionalForDisaster && (!hasFrontIdUrl || !hasBackIdUrl)) {
    idValidationError = 'Front and Back valid ID photos are required before submitting.';
  } else if (
    frontIdUrlResolved &&
    backIdUrlResolved &&
    String(frontIdUrlResolved).length > 500 &&
    String(frontIdUrlResolved) === String(backIdUrlResolved)
  ) {
    idValidationError = 'Front ID and Back ID cannot use the same file or photo. Please attach separate Front and Back photos.';
  } else if (frontAnalysis?.aiVisionUsed === false || backAnalysis?.aiVisionUsed === false) {
    idValidationError =
      frontAnalysis?.warning ||
      backAnalysis?.warning ||
      'ID verification did not complete. Please re-attach and scan your Front and Back ID photos.';
  } else if (frontAnalysis?.isId === false || backAnalysis?.isId === false) {
    idValidationError = 'Attached Front and Back IDs must both be valid identification cards.';
  } else if (
    frontAnalysis?.matchesExpectedSide === false ||
    frontAnalysis?.detectedSide === 'back' ||
    backAnalysis?.matchesExpectedSide === false ||
    backAnalysis?.detectedSide === 'front'
  ) {
    idValidationError = 'ID side mismatch: Please attach the Front photo in Front of ID and the Back photo in Back of ID.';
  } else if (frontAnalysis?.matchesExpectedType === false || backAnalysis?.matchesExpectedType === false) {
    idValidationError = 'ID type mismatch: Attached Front and Back IDs must match your selected ID type.';
  } else if (frontAnalysis?.matchesExpectedName === false || backAnalysis?.matchesExpectedName === false) {
    idValidationError =
      frontAnalysis?.warning ||
      backAnalysis?.warning ||
      'ID name mismatch: Attached ID must belong to the applicant.';
  } else if (
    frontAnalysis?.isClear === false ||
    frontAnalysis?.isBlurry === true ||
    backAnalysis?.isClear === false ||
    backAnalysis?.isBlurry === true
  ) {
    idValidationError = 'ID photo is blurry or unclear. Please upload a clearer photo and try again.';
  }

  // Validate uploaded requirement files against Admin-defined requirement keywords and clarity/validity flags
  let serverHasMissingRequiredDocs = Boolean(appData.hasMissingRequiredDocs);
  let serverMissingDocsLabel = appData.missingDocsLabel ? String(appData.missingDocsLabel) : '';
  const programRequirements: string[] = Array.isArray(targetProgram?.requirements)
    ? targetProgram.requirements.map((r: any) => String(r || '').trim()).filter(Boolean)
    : [];

  for (const doc of submittedDocuments) {
    if (!doc) continue;
    if (doc.docCategory === 'Front ID' || doc.docCategory === 'Back ID') continue;
    if (
      doc.analysis?.isValid === false ||
      doc.scanResult?.isValid === false ||
      doc.scanResult?.isClear === false ||
      doc.analysis?.isClear === false
    ) {
      serverHasMissingRequiredDocs = true;
      serverMissingDocsLabel =
        doc.analysis?.warning ||
        doc.scanResult?.warning ||
        `Invalid or unclear requirement file "${doc.name}".`;
      break;
    }
    if (doc.autoAttached) continue;

    if (!isRealDocumentUrl(doc.fileUrl || doc.previewUrl)) {
      serverHasMissingRequiredDocs = true;
      serverMissingDocsLabel = `Uploaded requirement file "${doc.name}" is empty or missing a valid document.`;
      break;
    }

    const bracketMatch = String(doc.name || '').match(/^\[([^\]]+)\]\s*(.+)$/);
    const explicitReqLabel = bracketMatch ? bracketMatch[1].trim() : '';
    if (explicitReqLabel || programRequirements.length > 0) {
      const serverDocText = extractServerDocumentText(doc.fileUrl || doc.previewUrl);
      const docScan = doc.scanResult || doc.analysis || {};
      const kwResult = matchRequirementKeywords({
        expectedRequirement: explicitReqLabel || programRequirements[0],
        additionalRequirements: explicitReqLabel ? [] : programRequirements,
        fileName: doc.name,
        extractedText: [serverDocText, docScan.extractedText || ''].filter(Boolean).join(' '),
        detectedDocType: docScan.detectedDocType || '',
        matchedKeywordsFromAi: Array.isArray(docScan.matchedKeywords) ? docScan.matchedKeywords : [],
        sourceLabel: doc.sourceLabel,
      });
      if (!kwResult.isMatch) {
        serverHasMissingRequiredDocs = true;
        serverMissingDocsLabel = kwResult.reason || `Uploaded file "${doc.name}" does not contain keywords matching "${explicitReqLabel || programRequirements[0]}".`;
        break;
      }
    }
  }

  // Ensure every mandatory (non-optional) program requirement has a matching attached/uploaded valid document
  if (!serverHasMissingRequiredDocs && targetProgram && programRequirements.length > 0) {
    const validSubmittedDocs = submittedDocuments.filter(
      (d: any) =>
        d &&
        d.analysis?.isValid !== false &&
        d.scanResult?.isValid !== false &&
        d.scanResult?.isClear !== false &&
        isRealDocumentUrl(d.fileUrl || d.previewUrl)
    );
    const reqSlots = matchProgramRequirementsWithAccount(targetProgram, applicantUser as any, validSubmittedDocs);
    const missingMandatorySlot = reqSlots.find((slot) => !slot.isOptional && slot.status !== 'auto-attached');
    if (missingMandatorySlot) {
      const hint = getRequirementHintLabel(missingMandatorySlot.requirement);
      serverHasMissingRequiredDocs = true;
      serverMissingDocsLabel = `Missing or invalid required document: "${missingMandatorySlot.requirement}" (must upload ${hint}).`;
    }
  }

  const evaluation = evaluateApplicantEligibility({
    programId: appData.programId,
    programTitle: appData.programTitle || targetProgram?.title,
    programCategory: appData.programCategory || targetProgram?.category,
    targetAudience: targetProgram?.targetAudience,
    programType: appData.programType || targetProgram?.programType,
    qualificationRules: targetProgram?.qualificationRules,
    eligibilityCriteria: targetProgram?.eligibilityCriteria,
    applicantName: applicantNameTrimmed,
    purok: purokTrimmed,
    address: addressTrimmed,
    householdIncome: appData.householdMonthlyIncome || appData.householdIncome || applicantUser?.householdIncome || '₱8,500.00',
    familyCount: Number(appData.familyMembersCount ?? applicantUser?.familyMembersCount) || 1,
    occupation: appData.occupation || applicantUser?.occupation,
    employmentStatus: appData.employmentStatus || applicantUser?.employmentStatus,
    age: typeof appData.age === 'number' ? appData.age : applicantUser?.age,
    civilStatus: appData.civilStatus || (applicantUser as any)?.civilStatus,
    isPwd: Boolean(appData.isPwd ?? (applicantUser as any)?.isPwd),
    isSenior: Boolean(appData.isSenior ?? (applicantUser as any)?.isSenior),
    isSoloParent: Boolean(appData.isSoloParent ?? (applicantUser as any)?.isSoloParent),
    isStudent: Boolean(appData.isStudent ?? (applicantUser as any)?.isStudent),
    hasVerifiedStudentDoc: hasVerifiedStudentDocument(submittedDocuments),
    isTeenager: Boolean(appData.isTeenager ?? (applicantUser as any)?.isTeenager),
    isBanned: Boolean(applicantUser?.isBanned),
    hasMedicalNeed: Boolean(appData.hasMedicalNeed ?? (applicantUser as any)?.hasMedicalNeed),
    isDisasterAffected: Boolean(appData.isDisasterAffected ?? (applicantUser as any)?.isDisasterAffected),
    purpose: purposeTrimmed,
    hasFrontId: hasFrontIdUrl,
    hasBackId: hasBackIdUrl,
    hasSupportingDoc: submittedDocuments.length > 2,
    hasMissingRequiredDocs: serverHasMissingRequiredDocs,
    missingDocsLabel: serverMissingDocsLabel || appData.missingDocsLabel,
    idAnalysis: frontDoc?.analysis || submittedDocuments.find((d: any) => d?.analysis)?.analysis,
    backIdAnalysis: backDoc?.analysis
  });

  if (idValidationError) {
    return res.status(400).json({
      success: false,
      message: idValidationError,
      evaluation
    });
  }

  const disasterBlockingRule = isDisasterTarget
    ? evaluation.rules.find(
        (r: any) =>
          !r.passed &&
          r.ruleName !== 'Income & Priority Bracket' &&
          r.ruleName !== 'Profile & Sector Qualification'
      )
    : undefined;

  if (isDisasterTarget && (serverHasMissingRequiredDocs || disasterBlockingRule)) {
    return res.status(400).json({
      success: false,
      message:
        serverMissingDocsLabel ||
        (disasterBlockingRule ? `${disasterBlockingRule.ruleName}: ${disasterBlockingRule.explanation}` : undefined) ||
        'Application cannot be submitted because required documents or details are incomplete or invalid.',
      evaluation
    });
  }

  if (!isDisasterTarget && (serverHasMissingRequiredDocs || !evaluation.isCapable)) {
    return res.status(400).json({
      success: false,
      message:
        serverMissingDocsLabel ||
        evaluation.disqualifiedReason ||
        'Application cannot be submitted because required documents or qualifications are incomplete or invalid.',
      evaluation
    });
  }

  const isCapable = isDisasterTarget ? false : true;
  const finalStatus = isDisasterTarget ? 'Under Review' : 'Valid';

  const submittedIso = new Date().toISOString();
  const newApp = {
    ...appData,
    applicantId,
    applicantName: applicantNameTrimmed,
    purok: purokTrimmed,
    address: addressTrimmed,
    purposeOrDiagnosis: purposeTrimmed,
    id: appData.id || `app-${Date.now()}`,
    referenceCode: randomCode,
    status: finalStatus,
    isCertificateQualified: isDisasterTarget ? false : true,
    submissionDate: now,
    submittedAt: appData.submittedAt || submittedIso,
    lastUpdated: now,
    approvedAmount: !isDisasterTarget && isCapable ? (appData.approvedAmount || targetProgram?.maxBenefitAmount) : undefined,
    eligibilityEvaluation: evaluation,
    rejectionReason: undefined,
    timeline: [
      {
        status: finalStatus,
        timestamp: 'Just now',
        officerName: isDisasterTarget ? 'Disaster Relief Desk' : 'Automated System',
        remarks: isDisasterTarget
          ? 'Submitted for Barangay Admin review. Only the Barangay Admin decides who is qualified in Disaster Programs.'
          : 'All requirements and qualifications satisfied. Marked as Valid and submitted.'
      }
    ]
  };

  db.applications.push(newApp);
  db.applications = sortApplicationsFCFS(db.applications);
  const assignedQueueNumber = db.applications.findIndex(a => a.id === newApp.id) + 1;
  (newApp as any).queueNumber = assignedQueueNumber;
  persistAsync(syncApplicationToMySQL(newApp), 'application.create');

  // Auto-validate resident registration based on valid Application (excluded for Disaster Programs pending Admin review)
  let autoValidatedResident = false;
  const createdNotifications: any[] = [];
  if (!isDisasterTarget && isCapable && applicantUser && applicantUser.role === 'resident' && applicantUser.registrationStatus !== 'Verified' && !applicantUser.isBanned) {
    (applicantUser as any).isVerified = true;
    (applicantUser as any).registrationStatus = 'Verified';
    (applicantUser as any).autoValidatedFromApplication = true;
    (applicantUser as any).autoValidatedRefCode = newApp.referenceCode;
    autoValidatedResident = true;
    persistAsync(syncUserToMySQL(applicantUser), 'user.autoValidateFromApplication');
  }

  // Notify resident of submission / automatic system result
  const resNotif = addNotificationSafely(db, {
    userId: applicantId,
    title: isDisasterTarget
      ? 'Disaster Application Submitted'
      : 'Application Valid & Submitted',
    message: isDisasterTarget
      ? `${newApp.programTitle} (${newApp.referenceCode}) was submitted for Barangay Admin qualification review.`
      : `${newApp.programTitle} (${newApp.referenceCode}) satisfied all requirements and qualifications, and was marked Valid and submitted.`,
    type: 'status_update',
    applicationRef: newApp.referenceCode,
    targetArea: 'services'
  });
  if (resNotif) createdNotifications.push(resNotif);

  // Notify admin (Disaster Programs require manual Admin decision; others are system view-only)
  const adminNotif = addNotificationSafely(db, {
    userId: 'admin-juan-delacruz',
    title: isDisasterTarget
      ? 'Disaster Application Pending Decision'
      : 'Valid Application Submitted',
    message: isDisasterTarget
      ? `${newApp.applicantName} applied for "${newApp.programTitle}" (${newApp.referenceCode}) — Admin qualification decision required.`
      : `${newApp.applicantName} submitted a Valid application for "${newApp.programTitle}" (${newApp.referenceCode}).`,
    type: 'status_update',
    applicationRef: newApp.referenceCode,
    targetArea: 'status-tracking'
  });
  if (adminNotif) createdNotifications.push(adminNotif);

  const sanitizedUpdatedResident = autoValidatedResident && applicantUser
    ? (() => {
        const { passwordHash: _ph, ...safeUser } = applicantUser as any;
        return safeUser;
      })()
    : undefined;

  saveDatabase(db);
  broadcastSystemUpdate('applications', 'create', { id: newApp.id, applicantId });
  if (autoValidatedResident) {
    broadcastSystemUpdate('residents', 'update', { id: applicantUser!.id });
  }
  res.json({
    success: true,
    application: newApp,
    referenceCode: randomCode,
    queueNumber: assignedQueueNumber,
    isCapable,
    autoValidatedResident,
    ...(sanitizedUpdatedResident ? { updatedResident: sanitizedUpdatedResident } : {}),
    createdNotifications,
    evaluation
  });
});

// APPLICATIONS: Verify or unverify an attached document (Admin Only)
app.patch('/api/applications/:id/documents/:docId', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id, docId } = req.params;
  const targetApp = (db.applications || []).find((a: any) => a.id === id || a.referenceCode === id);
  if (!targetApp) {
    return res.status(404).json({ success: false, message: 'Application not found.' });
  }
  if (!Array.isArray(targetApp.documents)) {
    return res.status(404).json({ success: false, message: 'Document not found.' });
  }
  const targetDoc = targetApp.documents.find((d: any) => d.id === docId);
  if (!targetDoc) {
    return res.status(404).json({ success: false, message: 'Document not found.' });
  }
  targetDoc.verified = Boolean(req.body?.verified);
  targetApp.lastUpdated = new Date().toISOString().split('T')[0];
  persistAsync(syncApplicationToMySQL(targetApp), 'application.verifyDocument');
  saveDatabase(db);
  broadcastSystemUpdate('applications', 'update', { id: targetApp.id });
  res.json({ success: true, application: targetApp });
});

// APPLICATIONS: Manual Admin approval allowed ONLY for Disaster Programs; regular/service programs stay automated
app.patch('/api/applications/:id/status', authenticateJWT, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const appIndex = (db.applications || []).findIndex((a: any) => a.id === id || a.referenceCode === id);
  if (appIndex === -1) {
    return res.status(404).json({ success: false, message: 'Application not found.' });
  }

  const targetApp = db.applications[appIndex] as any;
  const linkedProg = (db.programs || []).find(
    (p: any) => p.id === targetApp.programId || String(p.title || '').toLowerCase() === String(targetApp.programTitle || '').toLowerCase()
  );
  const isDisApp = isDisasterProgram(
    (linkedProg as any) || {
      id: targetApp.programId,
      title: targetApp.programTitle,
      category: targetApp.programCategory
    }
  );

  if (!isDisApp) {
    return res.status(403).json({
      success: false,
      message: 'Approvals are processed automatically by the system. Admin access is view-only for non-disaster programs.'
    });
  }

  const body = req.body || {};
  const allowedStatuses = ['Submitted', 'Under Review', 'Documents Verified', 'Valid', 'Approved', 'Ready for Release', 'Disbursed', 'Completed', 'Disqualified', 'Rejected'];
  const nextStatus = allowedStatuses.includes(body.status) ? body.status : null;
  if (!nextStatus) {
    return res.status(400).json({ success: false, message: 'Invalid status provided.' });
  }

  const now = getExactFormattedDate();
  const officerName = String(body.officerName || req.authUser?.email || 'Barangay Administrator').trim();
  const remarks = String(body.remarks || '').trim() ||
    (nextStatus === 'Valid' || nextStatus === 'Approved'
      ? 'Approved and marked Qualified by Barangay Admin under Disaster Program.'
      : nextStatus === 'Disqualified' || nextStatus === 'Rejected'
        ? 'Marked Not Qualified by Barangay Admin under Disaster Program.'
        : `Updated to ${nextStatus} by Barangay Admin.`);

  const isNowQualified = nextStatus === 'Valid' || nextStatus === 'Approved' || nextStatus === 'Ready for Release' || nextStatus === 'Disbursed' || nextStatus === 'Completed';
  const updatedApp = {
    ...targetApp,
    status: nextStatus,
    isCertificateQualified: isNowQualified,
    lastUpdated: now,
    approvedAmount: isNowQualified ? (body.approvedAmount || targetApp.approvedAmount || linkedProg?.maxBenefitAmount) : targetApp.approvedAmount,
    evaluatorNotes: remarks,
    rejectionReason: nextStatus === 'Disqualified' || nextStatus === 'Rejected' ? remarks : undefined,
    timeline: [
      ...(Array.isArray(targetApp.timeline) ? targetApp.timeline : []),
      {
        status: nextStatus,
        timestamp: now,
        officerName,
        remarks
      }
    ]
  };

  db.applications[appIndex] = updatedApp;
  persistAsync(syncApplicationToMySQL(updatedApp), 'application.adminDisasterDecision');

  const logEntry = {
    id: `act-${Date.now()}`,
    residentName: updatedApp.applicantName,
    residentIdNumber: updatedApp.referenceCode,
    purok: updatedApp.purok || 'Barangay Bugo',
    actionType: 'Status Updated',
    locationOrService: updatedApp.programTitle,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
    officerInCharge: officerName,
    status: 'Completed',
    details: `Admin set Disaster Program application ${updatedApp.referenceCode} to ${nextStatus}.`
  };
  db.activityLogs.unshift(logEntry);
  persistAsync(syncActivityLogToMySQL(logEntry), 'activityLog.disasterDecision');

  const createdNotifications: any[] = [];
  if (updatedApp.applicantId) {
    const notif = addNotificationSafely(db, {
      userId: updatedApp.applicantId,
      title: isNowQualified ? `Disaster Program Qualified: ${updatedApp.programTitle}` : `Disaster Program Update: ${updatedApp.programTitle}`,
      message: isNowQualified
        ? `Barangay Admin marked your application (${updatedApp.referenceCode}) for "${updatedApp.programTitle}" as Qualified / Approved.`
        : `Barangay Admin updated your application (${updatedApp.referenceCode}) for "${updatedApp.programTitle}" to ${nextStatus}. ${remarks}`,
      type: 'status_update',
      applicationRef: updatedApp.referenceCode,
      targetArea: 'services'
    });
    if (notif) createdNotifications.push(notif);
  }

  saveDatabase(db);
  broadcastSystemUpdate('applications', 'update', { id: updatedApp.id });
  if (createdNotifications.length > 0) {
    broadcastSystemUpdate('notifications', 'create', { applicationId: updatedApp.id });
  }

  return res.json({
    success: true,
    application: updatedApp,
    createdNotifications
  });
});

// APPLICATIONS: Resident Resubmit Missing Requirements
app.post('/api/applications/:id/resubmit', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { documents, note, applicantName } = req.body;

  const appIndex = db.applications.findIndex(a => a.id === id || a.referenceCode === id);
  if (appIndex === -1) {
    return res.status(404).json({ success: false, message: 'Application not found.' });
  }

  const existing = db.applications[appIndex];
  if (req.authUser?.role !== 'admin' && existing.applicantId !== req.authUser?.sub) {
    return res.status(403).json({ success: false, message: 'Forbidden: Cannot resubmit another resident application.' });
  }

  const targetProgram = (db.programs || []).find(
    (p: any) => p.id === existing.programId || p.title?.toLowerCase() === String(existing.programTitle || '').toLowerCase()
  );
  const programReqs: string[] = Array.isArray(targetProgram?.requirements)
    ? targetProgram.requirements.map((r: any) => String(r || '').trim()).filter(Boolean)
    : [];

  for (const doc of (documents || [])) {
    if (!doc || doc.autoAttached) continue;
    if (doc.scanResult?.isValid === false || doc.analysis?.isValid === false) {
      return res.status(400).json({
        success: false,
        message: doc.scanResult?.warning || doc.analysis?.warning || `Invalid document "${doc.name}".`,
      });
    }
    const bracketMatch = String(doc.name || '').match(/^\[([^\]]+)\]\s*(.+)$/);
    const explicitReqLabel = bracketMatch ? bracketMatch[1].trim() : '';
    if (explicitReqLabel || programReqs.length > 0) {
      const serverDocText = extractServerDocumentText(doc.fileUrl || doc.previewUrl);
      const docScan = doc.scanResult || doc.analysis || {};
      const kwResult = matchRequirementKeywords({
        expectedRequirement: explicitReqLabel || programReqs[0],
        additionalRequirements: explicitReqLabel ? [] : programReqs,
        fileName: doc.name,
        extractedText: [serverDocText, docScan.extractedText || ''].filter(Boolean).join(' '),
        detectedDocType: docScan.detectedDocType || '',
        matchedKeywordsFromAi: Array.isArray(docScan.matchedKeywords) ? docScan.matchedKeywords : [],
        sourceLabel: doc.sourceLabel,
      });
      if (!kwResult.isMatch) {
        return res.status(400).json({
          success: false,
          message: kwResult.reason || `Invalid document: "${doc.name}" does not contain keywords matching "${explicitReqLabel || programReqs[0]}".`,
        });
      }
    }
  }

  const now = new Date().toISOString().split('T')[0];
  const mergedDocs = [
    ...(documents || []),
    ...existing.documents.filter((d: any) => !(documents || []).some((nd: any) => nd.name === d.name || nd.id === d.id))
  ];

  const updated: any = {
    ...existing,
    status: 'Re-submitted',
    lastUpdated: now,
    resubmittedAt: now,
    resubmittedNote: note || 'Applicant attached updated requirements',
    documents: mergedDocs,
    timeline: [
      {
        status: 'Re-submitted',
        timestamp: getExactFormattedDate(),
        officerName: applicantName || existing.applicantName || 'Resident Applicant',
        remarks: `Updated requirements uploaded: ${note || 'Applicant provided additional documents requested by evaluator.'}`
      },
      ...existing.timeline
    ]
  };

  db.applications[appIndex] = updated;
  persistAsync(syncApplicationToMySQL(updated), 'application.resubmit');

  addNotificationSafely(db, {
    userId: 'admin-juan-delacruz',
    title: 'Requirements Re-submitted',
    message: `${existing.applicantName} uploaded requested documents for ${existing.referenceCode} (${existing.programTitle}). Ready for re-evaluation.`,
    type: 'status_update',
    applicationRef: existing.referenceCode,
    targetArea: 'residents'
  });

  saveDatabase(db);
  broadcastSystemUpdate('applications', 'resubmit', { id: existing.id, applicantId: existing.applicantId });
  res.json({ success: true, application: updated, message: 'Requirements successfully re-submitted.' });
});

// DELETE APPLICATION: Permanently delete an application and associated notifications
app.delete('/api/applications/:id', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const targetApp = db.applications.find(a => a.id === id || a.referenceCode === id);
  if (!targetApp) {
    return res.status(404).json({ success: false, message: `Application ${id} not found.` });
  }

  if (req.authUser?.role !== 'admin' && targetApp.applicantId !== req.authUser?.sub) {
    return res.status(403).json({ success: false, message: 'Forbidden: Cannot delete another resident application.' });
  }

  const targetRef = targetApp.referenceCode || id;
  db.applications = db.applications.filter(a => a.id !== id && a.referenceCode !== id);
  db.notifications = db.notifications.filter(n => n.applicationRef !== targetRef && !n.message?.includes(targetRef));
  db.activityLogs = db.activityLogs.filter(l => !l.details?.includes(targetRef));

  let removalNotif = null;
  if (req.authUser?.role === 'admin' && targetApp.applicantId && targetApp.applicantId !== req.authUser.sub) {
    removalNotif = addNotificationSafely(db, {
      userId: targetApp.applicantId,
      title: 'Application Removed by Administrator',
      message: `Your request for "${targetApp.programTitle}" (${targetRef}) was removed from the active applications registry by an administrator.`,
      type: 'system_alert',
      targetArea: 'services'
    });
  }

  let archivedItem: any = null;
  if (req.authUser?.role === 'admin') {
    archivedItem = createArchiveEntry(db, {
      title: `${targetApp.programTitle || 'Service Application'} - ${targetApp.applicantName || targetRef}`,
      originalCategory: 'Service Application',
      referenceCode: targetRef,
      deletedBy: req.authUser?.email || 'Barangay Administrator',
      reasonForArchive: `Application ${targetRef} deleted from active registry by administrator.`,
      originalData: targetApp,
    });
  }

  persistAsync(deleteApplicationFromMySQL(targetApp.id), 'application.delete');
  saveDatabase(db);
  broadcastSystemUpdate('applications', 'delete', { id: targetApp.id, applicantId: targetApp.applicantId });
  if (archivedItem) {
    broadcastSystemUpdate('archives', 'create', { id: archivedItem.id });
  }

  res.json({
    success: true,
    deletedId: targetApp.id,
    deletedRef: targetRef,
    notification: removalNotif,
    archivedItem,
    message: `Application ${targetRef} deleted successfully.`
  });
});

app.post('/api/applications/bulk-delete', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const rawIds = req.body?.ids;
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please select at least one application to delete.'
    });
  }

  const targetKeys = Array.from(
    new Set(
      rawIds
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .map(id => id.trim())
    )
  );

  if (targetKeys.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid application IDs provided.'
    });
  }

  const targetSet = new Set(targetKeys);
  const removedApps = db.applications.filter(
    a => targetSet.has(a.id) || (a.referenceCode && targetSet.has(a.referenceCode))
  );

  if (removedApps.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Selected applications were not found.'
    });
  }

  const removedIdSet = new Set(removedApps.map(a => a.id));
  const removedRefs = removedApps.map(a => a.referenceCode || a.id);
  const removedRefSet = new Set(removedRefs);

  db.applications = db.applications.filter(a => !removedIdSet.has(a.id));
  db.notifications = db.notifications.filter(n => {
    if (n.applicationRef && (removedRefSet.has(n.applicationRef) || removedIdSet.has(n.applicationRef))) {
      return false;
    }
    if (n.message && removedRefs.some(ref => n.message.includes(ref))) {
      return false;
    }
    return true;
  });
  db.activityLogs = db.activityLogs.filter(
    l => !l.details || !removedRefs.some(ref => l.details.includes(ref))
  );

  const byApplicant = new Map<string, string[]>();
  for (const appItem of removedApps) {
    if (appItem.applicantId && appItem.applicantId !== req.authUser?.sub) {
      const list = byApplicant.get(appItem.applicantId) || [];
      list.push(appItem.programTitle || appItem.referenceCode);
      byApplicant.set(appItem.applicantId, list);
    }
  }
  const removalNotifs: any[] = [];
  for (const [applicantId, titles] of byApplicant.entries()) {
    const created = addNotificationSafely(db, {
      userId: applicantId,
      title: `Applications Removed (${titles.length})`,
      message: `The Barangay Administrator removed ${titles.length} application(s) from the registry: ${titles.slice(0, 3).join(', ')}${titles.length > 3 ? ` (+${titles.length - 3} more)` : ''}.`,
      type: 'system_alert',
      targetArea: 'services'
    });
    if (created) removalNotifs.push(created);
  }

  const archivedItems = removedApps.map(appItem =>
    createArchiveEntry(db, {
      title: `${appItem.programTitle || 'Service Application'} - ${appItem.applicantName || appItem.referenceCode || appItem.id}`,
      originalCategory: 'Service Application',
      referenceCode: appItem.referenceCode || appItem.id,
      deletedBy: req.authUser?.email || 'Barangay Administrator',
      reasonForArchive: `Bulk deleted application ${appItem.referenceCode || appItem.id} from active registry.`,
      originalData: appItem,
    })
  );

  for (const appItem of removedApps) {
    persistAsync(deleteApplicationFromMySQL(appItem.id), 'application.bulkDelete');
  }
  saveDatabase(db);
  broadcastSystemUpdate('applications', 'bulk_delete', { deletedIds: Array.from(removedIdSet) });
  broadcastSystemUpdate('archives', 'create', { count: archivedItems.length });

  res.json({
    success: true,
    deletedIds: Array.from(removedIdSet),
    deletedRefs: removedRefs,
    deletedCount: removedApps.length,
    notifications: removalNotifs,
    archivedItems
  });
});

// RESIDENTS: Create Resident Account directly (Admin Only)
app.post('/api/residents', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const body = req.body || {};
  const cleanName = String(body.name || '').trim();
  const cleanEmail = normalizeAccountEmail(body.email);

  if (!cleanName || !cleanEmail) {
    return res.status(400).json({ success: false, message: 'Resident full name and email are required.' });
  }

  if (!isAllowedAccountEmail(cleanEmail)) {
    return res.status(400).json({ success: false, message: ALLOWED_EMAIL_DOMAIN_MESSAGE });
  }

  if (db.users.some(u => matchesUserAccountEmail(u, cleanEmail))) {
    return res.status(409).json({ success: false, message: 'A resident with this email already exists.' });
  }

  const rawContact = String(body.contactNumber || '').trim();
  let finalContact = '';
  if (rawContact) {
    const phoneCheck = normalizePhMobile(rawContact);
    if (!phoneCheck.valid) {
      return res.status(400).json({
        success: false,
        message: phoneCheck.reason || 'Please enter a valid 11-digit Philippine mobile number (e.g. 0917 628 4915).'
      });
    }
    finalContact = rawContact.startsWith('+') ? phoneCheck.e164 : phoneCheck.local09;
  }

  const hasCustomPassword = body.password !== undefined && body.password !== null && String(body.password).trim() !== '';
  const finalPassword = hasCustomPassword ? String(body.password) : 'Resident@Bugo2026!';
  if (hasCustomPassword) {
    const passStrength = validatePasswordStrengthServer(finalPassword);
    if (!passStrength.isValid) {
      return res.status(400).json({
        success: false,
        message: passStrength.message || 'Custom password must be strong (at least 8 characters with uppercase, lowercase, number, and special character).'
      });
    }
  }

  const passwordHash = hashPassword(finalPassword);
  if (!verifyPassword(finalPassword, passwordHash)) {
    return res.status(500).json({
      success: false,
      message: 'Failed to securely store resident credentials. Please try again.'
    });
  }

  const parsedAge = Number(body.age) || 28;
  const gender = body.gender === 'Male' || body.gender === 'Female' ? body.gender : 'Female';
  const newId = `user-${Date.now()}`;
  const generatedIdNumber = body.residentIdNumber || `BG-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  const newUser: any = {
    id: newId,
    name: cleanName,
    email: cleanEmail,
    username: cleanEmail,
    passwordHash,
    role: 'resident' as const,
    accountSource: 'admin_add_resident' as const,
    contactNumber: finalContact,
    purok: stripZoneName(body.purok) || 'Zone 1',
    address: String(body.address || `${stripZoneName(body.purok) || 'Zone 1'}, Barangay Bugo, CDO`).trim(),
    residentIdNumber: generatedIdNumber,
    isVerified: true,
    registrationStatus: 'Verified' as const,
    isBanned: false,
    registeredDate: new Date().toISOString().split('T')[0],
    householdIncome: body.householdIncome || '₱8,500.00',
    familyMembersCount: Number(body.familyMembersCount) || 4,
    voterStatus: body.voterStatus || 'Registered',
    occupation: body.occupation || 'Resident',
    employmentStatus: body.employmentStatus || 'Self-Employed',
    civilStatus: body.civilStatus || 'Single',
    nationality: body.nationality || 'Filipino',
    age: parsedAge,
    gender,
    yearsOfResidency: Number(body.yearsOfResidency) || 1,
    isPwd: Boolean(body.isPwd),
    isSoloParent: Boolean(body.isSoloParent),
    isSenior: Boolean(body.isSenior) || parsedAge >= 60,
    isStudent: Boolean(body.isStudent),
    isTeenager: Boolean(body.isTeenager) || (parsedAge >= 13 && parsedAge <= 19),
    isDisasterAffected: false,
    avatarUrl: body.avatarUrl || (gender === 'Female'
      ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanName.replace(/\s+/g, ''))}&top=straight02&facialHairProbability=0&clothing=shirtVNeck&backgroundColor=ffd5dc`
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanName.replace(/\s+/g, ''))}&top=shortFlat&facialHair=beardLight&clothing=collarAndSweater&backgroundColor=b6e3f4`)
  };

  db.users.unshift(newUser);
  persistAsync(syncUserToMySQL(newUser), 'user.adminCreate');

  const logEntry = {
    id: `act-${Date.now()}`,
    residentName: newUser.name,
    residentIdNumber: newUser.residentIdNumber,
    purok: newUser.purok,
    actionType: 'Status Updated',
    locationOrService: 'Citizen Registry',
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
    officerInCharge: req.authUser?.email || 'Barangay Administrator',
    status: 'Completed',
    details: `Admin created resident account for ${newUser.name} (${newUser.email}).`
  };
  db.activityLogs.unshift(logEntry);
  persistAsync(syncActivityLogToMySQL(logEntry), 'activityLog.residentCreate');

  saveDatabase(db);
  broadcastSystemUpdate('residents', 'create', { id: newUser.id });

  const { passwordHash: _, ...safeUser } = newUser;
  res.json({ success: true, user: safeUser });
});

// RESIDENTS: Auto-Validate Pending Registrations Based on Applications (Admin Only)
app.post('/api/residents/auto-validate', authenticateJWT, requireRole('admin'), (_req: AuthenticatedRequest, res) => {
  const validatedIds: string[] = [];
  for (const u of db.users as any[]) {
    if (u.role !== 'resident' || u.isBanned || u.registrationStatus === 'Verified') continue;
    const validApp = (db.applications || []).find((a: any) =>
      a.status !== 'Disqualified' &&
      a.status !== 'Rejected' &&
      (a.applicantId === u.id ||
        (a.email && u.email && a.email.toLowerCase() === u.email.toLowerCase()) ||
        (a.applicantName && u.name && a.applicantName.trim().toLowerCase() === u.name.trim().toLowerCase()))
    );
    if (validApp) {
      u.isVerified = true;
      u.registrationStatus = 'Verified';
      u.autoValidatedFromApplication = true;
      u.autoValidatedRefCode = validApp.referenceCode;
      validatedIds.push(u.id);
      persistAsync(syncUserToMySQL(u), 'user.autoValidateBatch');
    }
  }
  if (validatedIds.length > 0) {
    saveDatabase(db);
    broadcastSystemUpdate('residents', 'bulk_update', { validatedIds });
  }
  res.json({
    success: true,
    validatedCount: validatedIds.length,
    validatedIds,
    message: validatedIds.length > 0
      ? `Auto-validated ${validatedIds.length} resident registration(s) backed by applications.`
      : 'No pending registrations with qualifying applications found.'
  });
});

// RESIDENTS: Status, Full Admin Edit & Avatar Update (Profile info edits require Admin)
app.patch('/api/residents/:id', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const {
    isVerified,
    registrationStatus,
    rejectionReason,
    isBanned,
    banReason,
    avatarUrl,
    name,
    firstName,
    middleName,
    lastName,
    suffix,
    birthdate,
    email,
    contactNumber,
    nationality,
    purok,
    address,
    householdIncome,
    familyMembersCount,
    occupation,
    employmentStatus,
    civilStatus,
    yearsOfResidency,
    idType,
    idNumber,
    age,
    gender,
    voterStatus,
    isPwd,
    pwdIdNumber,
    pwdDisabilityType,
    isSoloParent,
    soloParentIdNumber,
    isSenior,
    seniorIdNumber,
    isStudent,
    schoolName,
    studentLevel,
    isTeenager
  } = req.body;

  const userIndex = db.users.findIndex(u => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: 'Resident not found.' });
  }

  const hasProfileInfoUpdate =
    name !== undefined ||
    firstName !== undefined ||
    middleName !== undefined ||
    lastName !== undefined ||
    suffix !== undefined ||
    birthdate !== undefined ||
    email !== undefined ||
    contactNumber !== undefined ||
    nationality !== undefined ||
    purok !== undefined ||
    address !== undefined ||
    householdIncome !== undefined ||
    familyMembersCount !== undefined ||
    occupation !== undefined ||
    employmentStatus !== undefined ||
    civilStatus !== undefined ||
    yearsOfResidency !== undefined ||
    idType !== undefined ||
    idNumber !== undefined ||
    age !== undefined ||
    gender !== undefined ||
    voterStatus !== undefined ||
    isPwd !== undefined ||
    pwdIdNumber !== undefined ||
    pwdDisabilityType !== undefined ||
    isSoloParent !== undefined ||
    soloParentIdNumber !== undefined ||
    isSenior !== undefined ||
    seniorIdNumber !== undefined ||
    isStudent !== undefined ||
    schoolName !== undefined ||
    studentLevel !== undefined ||
    isTeenager !== undefined;

  const hasAdminStatusUpdate =
    isVerified !== undefined ||
    registrationStatus !== undefined ||
    rejectionReason !== undefined ||
    isBanned !== undefined ||
    banReason !== undefined;

  if (hasProfileInfoUpdate || hasAdminStatusUpdate) {
    if (req.authUser?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only an administrator can approve or modify resident profile information.'
      });
    }
  } else if (req.authUser?.role !== 'admin' && req.authUser?.sub !== id) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You can only update your own avatar.'
    });
  }

  const previousUser = db.users[userIndex] as any;
  const normalizedNewEmail = email !== undefined ? normalizeAccountEmail(email) : undefined;
  if (normalizedNewEmail !== undefined) {
    if (!isAllowedAccountEmail(normalizedNewEmail)) {
      return res.status(400).json({
        success: false,
        message: ALLOWED_EMAIL_DOMAIN_MESSAGE
      });
    }
    if (normalizedNewEmail !== previousUser.email.toLowerCase()) {
      if (db.users.some((u, idx) => idx !== userIndex && matchesUserAccountEmail(u, normalizedNewEmail))) {
        return res.status(409).json({
          success: false,
          message: 'Another account already uses this email address.'
        });
      }
    }
  }

  let normalizedContactNumber: string | undefined = undefined;
  if (contactNumber !== undefined && String(contactNumber).trim() !== '') {
    const phoneCheck = normalizePhMobile(contactNumber);
    if (!phoneCheck.valid) {
      return res.status(400).json({
        success: false,
        message: phoneCheck.reason || 'Please enter a valid 11-digit Philippine mobile number (e.g. 0917 628 4915).'
      });
    }
    normalizedContactNumber = String(contactNumber).trim().startsWith('+') ? phoneCheck.e164 : phoneCheck.local09;
  } else if (contactNumber !== undefined && String(contactNumber).trim() === '') {
    normalizedContactNumber = '';
  }

  const nextUser: any = {
    ...previousUser,
    ...(avatarUrl !== undefined && { avatarUrl }),
    ...(isVerified !== undefined && { isVerified }),
    ...(registrationStatus && { registrationStatus }),
    ...(rejectionReason !== undefined && { rejectionReason: String(rejectionReason).trim() }),
    ...(isBanned !== undefined && { isBanned }),
    ...(banReason !== undefined && { banReason }),
    ...(name && { name: String(name).trim() }),
    ...(firstName !== undefined && { firstName: String(firstName).trim() }),
    ...(middleName !== undefined && { middleName: String(middleName).trim() }),
    ...(lastName !== undefined && { lastName: String(lastName).trim() }),
    ...(suffix !== undefined && { suffix: String(suffix).trim() }),
    ...(birthdate !== undefined && { birthdate: String(birthdate).trim() }),
    ...(normalizedNewEmail && { email: normalizedNewEmail, username: normalizedNewEmail }),
    ...(normalizedContactNumber !== undefined && { contactNumber: normalizedContactNumber }),
    ...(nationality && { nationality }),
    ...(purok && { purok }),
    ...(address && { address: String(address).trim() }),
    ...(householdIncome && { householdIncome }),
    ...(familyMembersCount !== undefined && { familyMembersCount: Number(familyMembersCount) }),
    ...(occupation && { occupation }),
    ...(employmentStatus && { employmentStatus }),
    ...(civilStatus && { civilStatus }),
    ...(yearsOfResidency !== undefined && { yearsOfResidency: Number(yearsOfResidency) }),
    ...(idType !== undefined && { idType }),
    ...(idNumber !== undefined && { idNumber }),
    ...(age !== undefined && { age: Number(age) }),
    ...(gender && { gender }),
    ...(voterStatus && { voterStatus }),
    ...(isPwd !== undefined && { isPwd: Boolean(isPwd) }),
    ...(pwdIdNumber !== undefined && { pwdIdNumber }),
    ...(pwdDisabilityType !== undefined && { pwdDisabilityType }),
    ...(isSoloParent !== undefined && { isSoloParent: Boolean(isSoloParent) }),
    ...(soloParentIdNumber !== undefined && { soloParentIdNumber }),
    ...(isSenior !== undefined && { isSenior: Boolean(isSenior) }),
    ...(seniorIdNumber !== undefined && { seniorIdNumber }),
    ...(isStudent !== undefined && { isStudent: Boolean(isStudent) }),
    ...(schoolName !== undefined && { schoolName }),
    ...(studentLevel !== undefined && { studentLevel }),
    ...(isTeenager !== undefined && { isTeenager: Boolean(isTeenager) })
  };

  if (registrationStatus === 'Verified') {
    delete nextUser.rejectionReason;
  }

  if (isBanned === false) {
    delete nextUser.banReason;
    delete nextUser.bannedDate;
  } else if (isBanned === true && !nextUser.bannedDate) {
    nextUser.bannedDate = new Date().toISOString().split('T')[0];
  }

  db.users[userIndex] = nextUser;
  persistAsync(syncUserToMySQL(nextUser), 'user.patch');

  // Cascade resident profile updates into linked applications & disaster victims
  if (hasProfileInfoUpdate) {
    cascadeResidentUpdates(db, nextUser);
  }

  // Emit persisted notification for key status changes
  let createdNotif = null;
  if (isBanned === true && !previousUser.isBanned) {
    createdNotif = addNotificationSafely(db, {
      userId: nextUser.id,
      title: 'Account Suspended / Banned',
      message: `Your resident account was banned by an administrator. Reason: ${nextUser.banReason || 'Administrative policy violation.'}`,
      type: 'system_alert',
      targetArea: 'settings'
    });
  } else if (isBanned === false && previousUser.isBanned) {
    createdNotif = addNotificationSafely(db, {
      userId: nextUser.id,
      title: 'Account Restored & Verified',
      message: 'Your resident account access has been restored and verified by the Barangay Administrator.',
      type: 'registration_approved',
      targetArea: 'dashboard'
    });
  } else if (isVerified === true && !previousUser.isVerified) {
    createdNotif = addNotificationSafely(db, {
      userId: nextUser.id,
      title: 'Resident Account Verified',
      message: 'Your Barangay Bugo resident registration has been verified and approved by the administrator.',
      type: 'registration_approved',
      targetArea: 'dashboard'
    });
  } else if (registrationStatus === 'Rejected' && previousUser.registrationStatus !== 'Rejected') {
    createdNotif = addNotificationSafely(db, {
      userId: nextUser.id,
      title: 'Registration Status Update',
      message: `Your resident registration was not approved.${nextUser.rejectionReason ? ` Reason: ${nextUser.rejectionReason}` : ' Please contact the Barangay Secretariat for verification.'}`,
      type: 'status_update',
      targetArea: 'settings'
    });
  }

  if (hasProfileInfoUpdate || hasAdminStatusUpdate) {
    const logEntry = {
      id: `act-${Date.now()}`,
      residentName: nextUser.name,
      residentIdNumber: nextUser.residentIdNumber || nextUser.id,
      purok: nextUser.purok || 'Barangay Bugo',
      actionType: 'Status Updated',
      locationOrService: 'Citizen Registry',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      officerInCharge: req.authUser?.email || 'Barangay Administrator',
      status: 'Completed',
      details: `Updated resident account ${nextUser.name} (${nextUser.registrationStatus}).`
    };
    db.activityLogs.unshift(logEntry);
    persistAsync(syncActivityLogToMySQL(logEntry), 'activityLog.residentPatch');
  }

  saveDatabase(db);
  broadcastSystemUpdate('residents', 'update', {
    id: nextUser.id,
    isBanned: Boolean(nextUser.isBanned)
  });

  const { passwordHash, ...safeUser } = nextUser;
  res.json({
    success: true,
    user: safeUser,
    notification: createdNotif,
    applications: db.applications,
    disasterVictims: db.disasterVictims || []
  });
});

// RESIDENTS: Delete Single Resident & Cascade Linked Records (Admin Only)
app.delete('/api/residents/:id', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const idx = db.users.findIndex(u => u.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Resident account not found.' });
  }

  const targetUser = db.users[idx];
  if (targetUser.role === 'admin' || targetUser.id === req.authUser?.sub) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Administrator accounts cannot be deleted here.'
    });
  }

  db.users.splice(idx, 1);

  const removedApps = (db.applications || []).filter((a: any) => a.applicantId === id);
  const removedAppRefs = new Set(removedApps.map((a: any) => a.referenceCode));
  db.applications = (db.applications || []).filter((a: any) => a.applicantId !== id);
  db.notifications = (db.notifications || []).filter(
    (n: any) => n.userId !== id && (!n.applicationRef || !removedAppRefs.has(n.applicationRef))
  );
  const removedVictims = Array.isArray(db.disasterVictims)
    ? db.disasterVictims.filter((v: any) => v.residentId === id)
    : [];
  if (Array.isArray(db.disasterVictims)) {
    db.disasterVictims = db.disasterVictims.filter((v: any) => v.residentId !== id);
  }
  if (Array.isArray(db.rankingClassifications)) {
    db.rankingClassifications = db.rankingClassifications.filter((rc: any) => rc.residentId !== id);
  }

  const archivedItem = createArchiveEntry(db, {
    title: targetUser.name,
    originalCategory: 'Resident Record',
    referenceCode: targetUser.residentIdNumber || targetUser.id,
    deletedBy: req.authUser?.email || 'Barangay Administrator',
    reasonForArchive: `Removed resident account ${targetUser.name} (${targetUser.email}) and ${removedApps.length} linked application(s).`,
    originalData: {
      ...targetUser,
      linkedApplications: removedApps,
      linkedVictims: removedVictims,
    },
  });

  persistAsync(deleteUserFromMySQL(id), 'user.delete');
  for (const appItem of removedApps) {
    persistAsync(deleteApplicationFromMySQL(appItem.id), 'application.cascadeUserDelete');
  }
  persistAsync(deleteNotificationFromMySQL(undefined, id), 'notification.cascadeUserDelete');

  const logEntry = {
    id: `act-${Date.now()}`,
    residentName: targetUser.name,
    residentIdNumber: targetUser.residentIdNumber || id,
    purok: targetUser.purok || 'Barangay Bugo',
    actionType: 'Status Updated',
    locationOrService: 'Citizen Registry',
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
    officerInCharge: req.authUser?.email || 'Barangay Administrator',
    status: 'Completed',
    details: `Removed resident account ${targetUser.name} (${targetUser.email}) and ${removedApps.length} linked application(s).`
  };
  db.activityLogs.unshift(logEntry);
  persistAsync(syncActivityLogToMySQL(logEntry), 'activityLog.residentDelete');

  markDeletedDefaultIds(db, [id]);
  saveDatabase(db);
  broadcastSystemUpdate('residents', 'delete', { deletedIds: [id] });
  broadcastSystemUpdate('archives', 'create', { id: archivedItem.id });

  res.json({
    success: true,
    deletedId: id,
    deletedName: targetUser.name,
    removedApplicationsCount: removedApps.length,
    archivedItem: sanitizeArchiveItem(archivedItem)
  });
});

// RESIDENTS: Bulk Delete Residents & Cascade Linked Records (Admin Only)
app.post('/api/residents/bulk-delete', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const rawIds = req.body?.ids;
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return res.status(400).json({ success: false, message: 'Please select at least one resident to delete.' });
  }

  const requestedIds = Array.from(
    new Set(
      rawIds
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .map(id => id.trim())
    )
  );
  const requestedSet = new Set(requestedIds);

  const deletableUsers = db.users.filter(
    u => requestedSet.has(u.id) && u.role !== 'admin' && u.id !== req.authUser?.sub
  );

  if (deletableUsers.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No eligible resident accounts found for deletion.'
    });
  }

  const deletedIdSet = new Set(deletableUsers.map(u => u.id));
  const deletedIds = Array.from(deletedIdSet);

  db.users = db.users.filter(u => !deletedIdSet.has(u.id));

  const removedApps = (db.applications || []).filter((a: any) => deletedIdSet.has(a.applicantId));
  const removedAppRefs = new Set(removedApps.map((a: any) => a.referenceCode));
  db.applications = (db.applications || []).filter((a: any) => !deletedIdSet.has(a.applicantId));
  db.notifications = (db.notifications || []).filter(
    (n: any) => !deletedIdSet.has(n.userId) && (!n.applicationRef || !removedAppRefs.has(n.applicationRef))
  );
  const removedVictims = Array.isArray(db.disasterVictims)
    ? db.disasterVictims.filter((v: any) => deletedIdSet.has(v.residentId))
    : [];
  if (Array.isArray(db.disasterVictims)) {
    db.disasterVictims = db.disasterVictims.filter((v: any) => !deletedIdSet.has(v.residentId));
  }
  if (Array.isArray(db.rankingClassifications)) {
    db.rankingClassifications = db.rankingClassifications.filter((rc: any) => !deletedIdSet.has(rc.residentId));
  }

  const archivedItems = deletableUsers.map((deletedUser: any) => {
    const userApps = removedApps.filter((a: any) => a.applicantId === deletedUser.id);
    const userVictims = removedVictims.filter((v: any) => v.residentId === deletedUser.id);
    return createArchiveEntry(db, {
      title: deletedUser.name,
      originalCategory: 'Resident Record',
      referenceCode: deletedUser.residentIdNumber || deletedUser.id,
      deletedBy: req.authUser?.email || 'Barangay Administrator',
      reasonForArchive: `Bulk removed resident account ${deletedUser.name} (${deletedUser.email}) and ${userApps.length} linked application(s).`,
      originalData: {
        ...deletedUser,
        linkedApplications: userApps,
        linkedVictims: userVictims,
      },
    });
  });

  for (const deletedId of deletedIds) {
    persistAsync(deleteUserFromMySQL(deletedId), 'user.bulkDelete');
    persistAsync(deleteNotificationFromMySQL(undefined, deletedId), 'notification.cascadeBulkUserDelete');
  }
  for (const appItem of removedApps) {
    persistAsync(deleteApplicationFromMySQL(appItem.id), 'application.cascadeBulkUserDelete');
  }

  const logEntry = {
    id: `act-${Date.now()}`,
    residentName: `${deletedIds.length} Resident(s)`,
    residentIdNumber: deletedIds.slice(0, 3).join(', '),
    purok: 'Barangay Bugo',
    actionType: 'Status Updated',
    locationOrService: 'Citizen Registry',
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
    officerInCharge: req.authUser?.email || 'Barangay Administrator',
    status: 'Completed',
    details: `Bulk removed ${deletedIds.length} resident account(s) and ${removedApps.length} linked application(s).`
  };
  db.activityLogs.unshift(logEntry);
  persistAsync(syncActivityLogToMySQL(logEntry), 'activityLog.residentBulkDelete');

  markDeletedDefaultIds(db, deletedIds);
  saveDatabase(db);
  broadcastSystemUpdate('residents', 'bulk_delete', { deletedIds });
  broadcastSystemUpdate('archives', 'create', { count: archivedItems.length });

  res.json({
    success: true,
    deletedIds,
    deletedCount: deletedIds.length,
    removedApplicationsCount: removedApps.length,
    archivedItems: archivedItems.map(sanitizeArchiveItem)
  });
});

// RESIDENTS: Submit Profile Information Edit Request (Pending Admin Approval)
app.post('/api/residents/:id/profile-change-request', authenticateJWT, requireSelfOrAdmin, (req, res) => {
  const { id } = req.params;
  const { changes } = req.body;

  const userIndex = db.users.findIndex(u => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: 'Resident not found.' });
  }

  if (!changes || typeof changes !== 'object') {
    return res.status(400).json({ success: false, message: 'Profile changes payload is required.' });
  }

  const allowedKeys = [
    'name',
    'email',
    'contactNumber',
    'nationality',
    'purok',
    'address',
    'householdIncome',
    'familyMembersCount',
    'occupation',
    'employmentStatus',
    'age',
    'gender',
    'voterStatus'
  ] as const;

  const currentUserRecord: any = db.users[userIndex];
  const filteredChanges: Record<string, any> = {};
  for (const key of allowedKeys) {
    if (changes[key] !== undefined && changes[key] !== currentUserRecord[key]) {
      filteredChanges[key] = key === 'email' ? normalizeAccountEmail(changes[key]) : changes[key];
    }
  }

  if (filteredChanges.email !== undefined) {
    if (!isAllowedAccountEmail(filteredChanges.email)) {
      return res.status(400).json({ success: false, message: ALLOWED_EMAIL_DOMAIN_MESSAGE });
    }
    if (db.users.some((u, idx) => idx !== userIndex && u.email.toLowerCase() === filteredChanges.email)) {
      return res.status(409).json({ success: false, message: 'Another account already uses this email address.' });
    }
  }

  if (Object.keys(filteredChanges).length === 0) {
    return res.status(400).json({ success: false, message: 'No changes detected in your profile details.' });
  }

  const requestRecord = {
    requestedAt: getExactFormattedDate(),
    status: 'Pending' as const,
    changes: filteredChanges
  };

  db.users[userIndex].pendingProfileUpdate = requestRecord;
  persistAsync(syncUserToMySQL(db.users[userIndex]), 'user.profileChangeRequest');

  addNotificationSafely(db, {
    userId: 'admin-juan-delacruz',
    title: 'Profile Edit Approval Required',
    message: `${currentUserRecord.name} requested changes to their profile details (${Object.keys(filteredChanges).join(', ')}).`,
    type: 'status_update',
    targetArea: 'settings'
  });

  saveDatabase(db);
  broadcastSystemUpdate('residents', 'profile_change_request', { id });
  const { passwordHash, ...safeUser } = db.users[userIndex];
  res.json({
    success: true,
    message: 'Profile changes submitted for admin approval.',
    user: safeUser
  });
});

// RESIDENTS: Cancel Pending Profile Edit Request
app.delete('/api/residents/:id/profile-change-request', authenticateJWT, requireSelfOrAdmin, (req, res) => {
  const { id } = req.params;
  const userIndex = db.users.findIndex(u => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: 'Resident not found.' });
  }

  delete db.users[userIndex].pendingProfileUpdate;
  persistAsync(syncUserToMySQL(db.users[userIndex]), 'user.cancelProfileChange');
  saveDatabase(db);
  broadcastSystemUpdate('residents', 'profile_change_cancel', { id });
  const { passwordHash, ...safeUser } = db.users[userIndex];
  res.json({ success: true, user: safeUser });
});

// RESIDENTS: Admin-Only Approval or Rejection of Profile Edit Request
app.post('/api/residents/:id/profile-change-decision', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { decision, rejectionReason } = req.body;

  const actingAdmin = db.users.find(u => u.id === req.authUser?.sub);
  if (!actingAdmin || actingAdmin.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Only administrators can approve or reject profile changes.'
    });
  }

  const userIndex = db.users.findIndex(u => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: 'Resident not found.' });
  }

  const targetUser = db.users[userIndex];
  const pending = targetUser.pendingProfileUpdate;
  if (!pending || pending.status !== 'Pending') {
    return res.status(400).json({ success: false, message: 'No pending profile changes found for this resident.' });
  }

  if (decision === 'approve') {
    const updatedUser = {
      ...targetUser,
      ...pending.changes,
      ...(pending.changes?.email ? { username: normalizeAccountEmail(pending.changes.email) } : {}),
    };
    delete updatedUser.pendingProfileUpdate;
    db.users[userIndex] = updatedUser;
    persistAsync(syncUserToMySQL(updatedUser), 'user.approveProfileChange');

    cascadeResidentUpdates(db, updatedUser);

    const logItem = {
      id: `act-${Date.now()}`,
      residentName: updatedUser.name,
      residentIdNumber: updatedUser.residentIdNumber || 'USER',
      purok: updatedUser.purok || 'Bugo',
      actionType: 'Status Updated',
      locationOrService: 'Citizen Registry',
      timestamp: getExactFormattedDate(),
      officerInCharge: actingAdmin.name,
      status: 'Completed',
      details: `Admin approved profile information updates for ${updatedUser.name}.`
    };
    db.activityLogs.unshift(logItem);
    persistAsync(syncActivityLogToMySQL(logItem), 'activityLog.profileChange');

    const approvedNotif = addNotificationSafely(db, {
      userId: targetUser.id,
      title: 'Profile Changes Approved',
      message: 'Your requested profile information changes have been approved by the Barangay Administrator.',
      type: 'status_update',
      targetArea: 'settings'
    });

    saveDatabase(db);
    broadcastSystemUpdate('residents', 'profile_change_approved', { id: updatedUser.id });
    const { passwordHash, ...safeUser } = db.users[userIndex];
    return res.json({
      success: true,
      message: 'Profile changes approved and applied.',
      user: safeUser,
      notification: approvedNotif,
      applications: db.applications,
      disasterVictims: db.disasterVictims || []
    });
  }

  if (decision === 'reject') {
    db.users[userIndex].pendingProfileUpdate = {
      ...pending,
      status: 'Rejected',
      reviewedAt: getExactFormattedDate(),
      reviewedBy: actingAdmin.name,
      rejectionReason: rejectionReason || 'Submitted profile changes could not be verified.'
    };
    persistAsync(syncUserToMySQL(db.users[userIndex]), 'user.rejectProfileChange');

    const rejectedNotif = addNotificationSafely(db, {
      userId: targetUser.id,
      title: 'Profile Changes Not Approved',
      message: `Your profile edit request was declined by ${actingAdmin.name}. Reason: ${db.users[userIndex].pendingProfileUpdate.rejectionReason}`,
      type: 'status_update',
      targetArea: 'settings'
    });

    saveDatabase(db);
    broadcastSystemUpdate('residents', 'profile_change_rejected', { id: targetUser.id });
    const { passwordHash, ...safeUser } = db.users[userIndex];
    return res.json({
      success: true,
      message: 'Profile changes rejected.',
      user: safeUser,
      notification: rejectedNotif
    });
  }

  return res.status(400).json({ success: false, message: 'Decision must be "approve" or "reject".' });
});

// CENSUS: Get & Update Community Census (POST Admin Only)
app.get('/api/census', (_req, res) => {
  if (!db.census) {
    db.census = initDefaultDatabase().census;
    saveDatabase(db);
  }
  res.json({ success: true, census: db.census });
});

app.post('/api/census', authenticateJWT, requireRole('admin'), (req, res) => {
  const { census } = req.body;
  if (!census) {
    return res.status(400).json({ success: false, message: 'Census data required.' });
  }
  db.census = {
    ...census,
    lastUpdated: new Date().toISOString().split('T')[0]
  };
  persistAsync(syncCensusToMySQL(db.census), 'census.update');
  saveDatabase(db);
  broadcastSystemUpdate('census', 'update');
  res.json({ success: true, census: db.census });
});

// SECRETARIAT DETAILS & ANNOUNCEMENTS ROUTES
app.put('/api/admin/secretariat-details', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { lguUnit, punongBarangay, currentPassword, verificationToken } = req.body || {};

  const adminUser = db.users.find(u => u.id === req.authUser?.sub && u.role === 'admin');
  if (!adminUser) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Only Barangay Administrators may edit Barangay Secretariat Details.',
    });
  }

  let isAuthorizedByPassword = false;
  if (typeof verificationToken === 'string' && verificationToken.trim()) {
    const tokenRecord = verifiedTokensMap.get(verificationToken.trim());
    if (tokenRecord && tokenRecord.userId === adminUser.id && tokenRecord.expiresAt > Date.now()) {
      isAuthorizedByPassword = true;
    }
  }
  if (!isAuthorizedByPassword && typeof currentPassword === 'string' && currentPassword.length > 0) {
    if (verifyPassword(currentPassword, adminUser.passwordHash)) {
      isAuthorizedByPassword = true;
    } else {
      return res.status(401).json({
        success: false,
        message: 'Incorrect admin password. Please enter your valid administrator password to save changes.',
      });
    }
  }
  if (!isAuthorizedByPassword) {
    return res.status(401).json({
      success: false,
      message: 'Admin password verification is required before editing Barangay Secretariat Details.',
    });
  }

  const nextLguUnit = String(lguUnit || '').trim();
  const nextPunongBarangay = String(punongBarangay || '').trim();

  if (!nextLguUnit || nextLguUnit.length > 160) {
    return res.status(400).json({
      success: false,
      message: 'LGU / Barangay Unit is required and must be 160 characters or fewer.',
    });
  }
  if (!nextPunongBarangay || nextPunongBarangay.length > 160) {
    return res.status(400).json({
      success: false,
      message: 'Punong Barangay (Captain) name is required and must be 160 characters or fewer.',
    });
  }

  if (typeof verificationToken === 'string' && verificationToken.trim()) {
    verifiedTokensMap.delete(verificationToken.trim());
  }

  const updatedDetails = {
    lguUnit: nextLguUnit,
    punongBarangay: nextPunongBarangay,
    updatedAt: new Date().toISOString(),
    updatedBy: adminUser.name,
  };
  db.secretariatDetails = updatedDetails;

  const logEntry = {
    id: `log-${Date.now()}`,
    residentName: adminUser.name,
    residentIdNumber: adminUser.residentIdNumber || 'BG-ADMIN-001',
    purok: 'Administrative Office',
    actionType: 'Status Updated',
    locationOrService: 'Barangay Secretariat Settings',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
    officerInCharge: adminUser.name,
    status: 'Completed',
    details: `Updated Barangay Secretariat Details: LGU Unit "${nextLguUnit}", Punong Barangay "${nextPunongBarangay}".`,
  };
  db.activityLogs.unshift(logEntry);
  persistAsync(syncActivityLogToMySQL(logEntry), 'activityLog.secretariatUpdate');

  saveDatabase(db);
  broadcastSystemUpdate('secretariat_details', 'update', updatedDetails);

  return res.json({
    success: true,
    secretariatDetails: updatedDetails,
    activityLog: logEntry,
    message: 'Barangay Secretariat Details updated successfully.',
  });
});

app.post('/api/announcements', authenticateJWT, requireRole('admin'), async (req, res) => {
  const annBody = req.body || {};
  const newAnn: any = {
    ...annBody,
    id: `ann-${Date.now()}`,
    viewsCount: 0,
    viewedBy: [],
    date: 'Today',
    status: 'Published'
  };
  db.announcements.unshift(newAnn);

  let createdNotifications: any[] = [];

  if (newAnn.targetAudienceType === 'Qualified Beneficiaries Only' && newAnn.targetProgramId) {
    const dispatchRes = await dispatchTargetedScheduleNotifications(db, newAnn);
    createdNotifications = dispatchRes.createdNotifications;
  } else {
    const matchedProgram = resolveProgramFromAnnouncementText(newAnn, db.programs || []);
    const matchedTargetArea = matchedProgram
      ? (isBarangayServiceApplicationItem(matchedProgram) ? 'services' : 'dashboard')
      : 'announcements';
    if (matchedProgram && !newAnn.targetProgramId) {
      newAnn.targetProgramId = matchedProgram.id;
      newAnn.targetProgramTitle = matchedProgram.title;
    }

    const isDisasterAnnouncement = String(newAnn.category || '').toLowerCase() === 'disaster';
    const announcementNotifTitle = isDisasterAnnouncement
      ? `Disaster Announcement: ${newAnn.title}`
      : `Announcement: ${newAnn.title}`;

    const activeResidents = (db.users || []).filter((u: any) => u.role === 'resident' && !u.isBanned);
    const signatory = getEffectiveSecretariatDetails(db).punongBarangay;
    const issueDate = getExactFormattedDate();
    const docPayload = {
      docType: isDisasterAnnouncement
        ? 'Barangay Bugo Disaster & Emergency Advisory'
        : 'Barangay Official Public Advisory',
      controlNumber: `ADV-2026-${newAnn.id.slice(-4)}`,
      issueDate,
      recipientName: 'To All Residents of Barangay Bugo',
      subject: newAnn.title,
      narrative: newAnn.description,
      venueOrOffice: newAnn.meetingVenue || 'Barangay Bugo Public Information Office',
      officialRemarks: `Category: ${newAnn.category || 'Public Advisory'}. Please be guided accordingly.`,
      signatoryName: signatory,
      signatoryRole: 'Punong Barangay'
    };

    if (activeResidents.length > 0) {
      for (const resident of activeResidents) {
        const resNotif = addNotificationSafely(db, {
          userId: resident.id,
          title: announcementNotifTitle,
          message: newAnn.description || 'Barangay Bugo official public bulletin update.',
          type: 'announcement',
          targetArea: matchedTargetArea,
          targetProgramId: matchedProgram?.id || newAnn.targetProgramId,
          targetProgramTitle: matchedProgram?.title || newAnn.targetProgramTitle,
          announcementId: newAnn.id,
          documentData: {
            ...docPayload,
            recipientName: resident.name
          }
        });
        if (resNotif) createdNotifications.push(resNotif);
      }
    } else {
      const publicNotif = addNotificationSafely(db, {
        userId: 'all',
        title: announcementNotifTitle,
        message: newAnn.description || 'Barangay Bugo official public bulletin update.',
        type: 'announcement',
        targetArea: matchedTargetArea,
        targetProgramId: matchedProgram?.id || newAnn.targetProgramId,
        targetProgramTitle: matchedProgram?.title || newAnn.targetProgramTitle,
        announcementId: newAnn.id,
        documentData: docPayload
      });
      if (publicNotif) createdNotifications.push(publicNotif);
    }
  }

  persistAsync(syncAnnouncementToMySQL(newAnn), 'announcement.create');
  saveDatabase(db);
  broadcastSystemUpdate('announcements', 'create', { id: newAnn.id });
  if (createdNotifications.length > 0) broadcastSystemUpdate('notifications', 'create', { announcementId: newAnn.id });

  res.json({
    success: true,
    announcement: newAnn,
    createdNotifications,
  });
});

app.patch('/api/announcements/:id', authenticateJWT, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const idx = db.announcements.findIndex(a => a.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Announcement not found.' });
  }

  const existing = db.announcements[idx];
  const body = req.body || {};
  const updatedAnn: any = {
    ...existing,
    ...(body.title !== undefined && String(body.title).trim() && { title: String(body.title).trim() }),
    ...(body.category !== undefined && { category: body.category }),
    ...(body.description !== undefined && { description: String(body.description).trim() }),
    ...(body.iconType !== undefined && { iconType: body.iconType }),
    ...(body.isPinned !== undefined && { isPinned: Boolean(body.isPinned) }),
    ...(body.status !== undefined && { status: body.status }),
    ...(body.targetAudienceType !== undefined && { targetAudienceType: body.targetAudienceType }),
    ...(body.targetProgramId !== undefined && { targetProgramId: body.targetProgramId }),
    ...(body.targetProgramTitle !== undefined && { targetProgramTitle: body.targetProgramTitle }),
    ...(body.releaseDate !== undefined && { releaseDate: body.releaseDate }),
    ...(body.meetingTime !== undefined && { meetingTime: body.meetingTime }),
    ...(body.meetingVenue !== undefined && { meetingVenue: body.meetingVenue }),
    ...(body.instructions !== undefined && { instructions: body.instructions })
  };

  db.announcements[idx] = updatedAnn;
  persistAsync(syncAnnouncementToMySQL(updatedAnn), 'announcement.update');

  // Update matching announcement notification if present
  const expectedCtrl = `ADV-2026-${id.slice(-4)}`;
  if (Array.isArray(db.notifications)) {
    const matchedUpdatedProgram = resolveProgramFromAnnouncementText(updatedAnn, db.programs || []);
    db.notifications = db.notifications.map((n: any) => {
      if (
        n.announcementId === id ||
        n.documentData?.controlNumber === expectedCtrl ||
        n.title === `Announcement: ${existing.title}` ||
        n.title === `Disaster Announcement: ${existing.title}`
      ) {
        const nextPrefix = n.title?.startsWith('Release Schedule:')
          ? 'Release Schedule'
          : String(updatedAnn.category || '').toLowerCase() === 'disaster'
            ? 'Disaster Announcement'
            : 'Announcement';
        return {
          ...n,
          title: `${nextPrefix}: ${updatedAnn.title}`,
          message: updatedAnn.description || n.message,
          ...(matchedUpdatedProgram ? {
            targetProgramId: matchedUpdatedProgram.id,
            targetProgramTitle: matchedUpdatedProgram.title,
            targetArea: isBarangayServiceApplicationItem(matchedUpdatedProgram) ? 'services' : 'dashboard',
          } : {}),
          ...(n.documentData ? {
            documentData: {
              ...n.documentData,
              subject: updatedAnn.title,
              narrative: updatedAnn.description
            }
          } : {})
        };
      }
      return n;
    });
  }

  saveDatabase(db);
  broadcastSystemUpdate('announcements', 'update', { id });
  res.json({
    success: true,
    announcement: updatedAnn,
    createdNotifications: [],
  });
});

app.delete('/api/announcements/:id', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const idx = db.announcements.findIndex(a => a.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Announcement not found.' });
  }

  const [removed] = db.announcements.splice(idx, 1);
  const expectedCtrl = `ADV-2026-${id.slice(-4)}`;
  if (Array.isArray(db.notifications)) {
    db.notifications = db.notifications.filter(
      (n: any) =>
        n.announcementId !== id &&
        n.documentData?.controlNumber !== expectedCtrl &&
        n.title !== `Announcement: ${removed.title}` &&
        n.title !== `Disaster Announcement: ${removed.title}` &&
        n.title !== `Release Schedule: ${removed.title}`
    );
  }

  const archivedItem = createArchiveEntry(db, {
    title: removed.title,
    originalCategory: 'Notice',
    referenceCode: removed.id,
    deletedBy: req.authUser?.email || 'Barangay Administrator',
    reasonForArchive: `Deleted announcement "${removed.title}" (${removed.category || 'Notice'}).`,
    originalData: removed,
  });

  persistAsync(deleteAnnouncementFromMySQL(id), 'announcement.delete');

  const logEntry = {
    id: `act-${Date.now()}`,
    residentName: removed.title,
    residentIdNumber: id,
    purok: 'Barangay Bugo',
    actionType: 'Status Updated',
    locationOrService: 'Public Advisories Bulletin',
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
    officerInCharge: req.authUser?.email || 'Barangay Administrator',
    status: 'Completed',
    details: `Deleted announcement "${removed.title}".`
  };
  db.activityLogs.unshift(logEntry);
  persistAsync(syncActivityLogToMySQL(logEntry), 'activityLog.announcementDelete');

  saveDatabase(db);
  broadcastSystemUpdate('announcements', 'delete', { id });
  broadcastSystemUpdate('archives', 'create', { id: archivedItem.id });
  res.json({ success: true, deletedId: id, deletedTitle: removed.title, archivedItem });
});

app.post('/api/announcements/:id/view', (req, res) => {
  const { id } = req.params;
  const annIndex = db.announcements.findIndex(a => a.id === id);
  if (annIndex === -1) {
    return res.status(404).json({ success: false, message: 'Announcement not found.' });
  }

  const ann = db.announcements[annIndex] as any;
  const existingViewedBy: string[] = Array.isArray(ann.viewedBy)
    ? Array.from(new Set(ann.viewedBy.map(String)))
    : [];
  const residentId = resolveOptionalResidentId(req);

  if (!residentId) {
    return res.json({
      success: true,
      viewsCount: existingViewedBy.length,
      viewedBy: existingViewedBy,
      counted: false,
    });
  }

  if (existingViewedBy.includes(residentId)) {
    if (ann.viewsCount !== existingViewedBy.length || !Array.isArray(ann.viewedBy)) {
      ann.viewedBy = existingViewedBy;
      ann.viewsCount = existingViewedBy.length;
      saveDatabase(db);
    }
    return res.json({
      success: true,
      viewsCount: existingViewedBy.length,
      viewedBy: existingViewedBy,
      counted: false,
    });
  }

  const nextViewedBy = [...existingViewedBy, residentId];
  ann.viewedBy = nextViewedBy;
  ann.viewsCount = nextViewedBy.length;
  persistAsync(syncAnnouncementToMySQL(ann), 'announcement.view');
  saveDatabase(db);
  broadcastSystemUpdate('announcements', 'update', { id: ann.id });
  return res.json({
    success: true,
    viewsCount: ann.viewsCount,
    viewedBy: nextViewedBy,
    counted: true,
  });
});

// NOTIFICATIONS: Create & Persist Notification
app.post('/api/notifications', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const { userId, title, message, type, applicationRef, targetArea, documentData } = req.body;
  if (!title || !message) {
    return res.status(400).json({ success: false, message: 'Notification title and message are required.' });
  }
  if (req.authUser?.role !== 'admin' && userId && userId !== req.authUser?.sub && userId !== 'admin-juan-delacruz') {
    return res.status(403).json({ success: false, message: 'Forbidden: Only administrators can dispatch alerts to other residents.' });
  }
  const created = addNotificationSafely(db, {
    userId,
    title,
    message,
    type: type || 'status_update',
    applicationRef,
    targetArea,
    documentData
  });
  saveDatabase(db);
  broadcastSystemUpdate('notifications', 'create', { userId });
  res.json({ success: true, notification: created, duplicate: created === null });
});

// NOTIFICATIONS: Qualification-module auto-notification is disabled (notifications only fire for new updates/announcements/programs/certifications/disasters)
app.post('/api/notifications/notify-all-qualified', authenticateJWT, requireRole('admin'), async (_req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    sentCount: 0,
    residentsNotifiedCount: 0,
    alreadyNotifiedCount: 0,
    createdNotifications: [],
    message: 'Qualification-module notifications are disabled; notifications are only sent for new programs, certifications, announcements, and disaster updates.'
  });
});

// NOTIFICATIONS: Mark Read
const handleNotificationRead = (req: AuthenticatedRequest, res: Response) => {
  const { id, all, userId } = req.body;
  if (!db.notifications) db.notifications = [];
  const actorId = req.authUser?.sub;
  const isAdmin = req.authUser?.role === 'admin';
  const addUserToList = (list: unknown, uid?: string): string[] => {
    const arr = Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
    if (uid && !arr.includes(uid)) arr.push(uid);
    return arr;
  };

  if (all) {
    const effectiveUserId = isAdmin ? (typeof userId === 'string' && userId ? userId : undefined) : actorId;
    db.notifications.forEach((n: any) => {
      const isBroadcast = !n.userId || n.userId === 'all';
      if (isAdmin && !effectiveUserId) {
        n.read = true;
        if (actorId) n.readBy = addUserToList(n.readBy, actorId);
      } else if (effectiveUserId) {
        if (n.userId === effectiveUserId) {
          n.read = true;
          n.readBy = addUserToList(n.readBy, effectiveUserId);
        } else if (isBroadcast) {
          n.readBy = addUserToList(n.readBy, effectiveUserId);
          if (isAdmin) n.read = true;
        }
      }
    });
    persistAsync(syncNotificationReadInMySQL({ all: true, userId: effectiveUserId }), 'notification.readAll');
  } else if (id) {
    const notif: any = db.notifications.find(n => n.id === id);
    if (notif) {
      const isBroadcast = !notif.userId || notif.userId === 'all';
      if (isAdmin || (!isBroadcast && notif.userId === actorId)) {
        notif.read = true;
      }
      if (actorId) {
        notif.readBy = addUserToList(notif.readBy, actorId);
      }
      persistAsync(syncNotificationReadInMySQL({ id }), 'notification.readOne');
    }
  }
  saveDatabase(db);
  broadcastSystemUpdate('notifications', 'read');
  res.json({ success: true });
};
app.patch('/api/notifications/read', authenticateJWT, handleNotificationRead);
app.post('/api/notifications/read', authenticateJWT, handleNotificationRead);

// NOTIFICATIONS: Delete single notification
app.delete('/api/notifications/:id', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!db.notifications) db.notifications = [];
  const target: any = db.notifications.find(n => n.id === id);
  const actorId = req.authUser?.sub;
  const isAdmin = req.authUser?.role === 'admin';

  if (target && !isAdmin) {
    if (!target.userId || target.userId === 'all') {
      if (actorId) {
        const dismissed = Array.isArray(target.dismissedBy) ? [...target.dismissedBy] : [];
        if (!dismissed.includes(actorId)) dismissed.push(actorId);
        target.dismissedBy = dismissed;
        const readBy = Array.isArray(target.readBy) ? [...target.readBy] : [];
        if (!readBy.includes(actorId)) readBy.push(actorId);
        target.readBy = readBy;
      }
      saveDatabase(db);
      broadcastSystemUpdate('notifications', 'delete', { id });
      return res.json({ success: true, message: 'Notification removed.', removed: true });
    }
    if (target.userId !== actorId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot delete another user notification.' });
    }
  }

  const initialLength = db.notifications.length;
  db.notifications = db.notifications.filter(n => n.id !== id);
  persistAsync(deleteNotificationFromMySQL(id), 'notification.delete');
  saveDatabase(db);
  broadcastSystemUpdate('notifications', 'delete', { id });
  res.json({ success: true, message: 'Notification removed.', removed: initialLength !== db.notifications.length });
});

// NOTIFICATIONS: Clear all notifications (or by user)
app.delete('/api/notifications', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const { userId } = req.query;
  if (!db.notifications) db.notifications = [];
  const isAdmin = req.authUser?.role === 'admin';
  const targetUserId = !isAdmin
    ? req.authUser!.sub
    : typeof userId === 'string' && userId.trim()
      ? userId.trim()
      : undefined;

  if (targetUserId) {
    db.notifications = db.notifications
      .filter((n: any) => n.userId !== targetUserId)
      .map((n: any) => {
        if (!n.userId || n.userId === 'all') {
          const dismissed = Array.isArray(n.dismissedBy) ? [...n.dismissedBy] : [];
          if (!dismissed.includes(targetUserId)) dismissed.push(targetUserId);
          const readBy = Array.isArray(n.readBy) ? [...n.readBy] : [];
          if (!readBy.includes(targetUserId)) readBy.push(targetUserId);
          return { ...n, dismissedBy: dismissed, readBy };
        }
        return n;
      });
    persistAsync(deleteNotificationFromMySQL(undefined, targetUserId), 'notification.clearUser');
  } else {
    db.notifications = [];
    persistAsync(deleteNotificationFromMySQL(), 'notification.clearAll');
  }
  saveDatabase(db);
  broadcastSystemUpdate('notifications', 'clear');
  res.json({ success: true, message: 'Notifications cleared.' });
});

// ACTIVITY LOGS
app.post('/api/logs', authenticateJWT, (req, res) => {
  const newLog = {
    ...req.body,
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
  };
  db.activityLogs.unshift(newLog);
  persistAsync(syncActivityLogToMySQL(newLog), 'activityLog.create');
  saveDatabase(db);
  res.json({ success: true, log: newLog });
});

// ARCHIVES (Admin Only)
app.post('/api/archives', authenticateJWT, requireRole('admin'), (req, res) => {
  const newArch = {
    ...req.body,
    id: `arch-${Date.now()}`,
    deletedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    status: 'Archived'
  };
  db.archivedItems.unshift(newArch);
  persistAsync(syncArchiveToMySQL(newArch), 'archive.create');
  saveDatabase(db);
  broadcastSystemUpdate('archives', 'create', { id: newArch.id });
  res.json({ success: true, item: newArch });
});

app.delete('/api/archives/:id', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const shouldRestore = String(req.query.restore || '').toLowerCase() === 'true';

  const item = db.archivedItems.find(a => a.id === id);
  db.archivedItems = db.archivedItems.filter(a => a.id !== id);
  persistAsync(deleteArchiveFromMySQL(id), 'archive.delete');

  if (shouldRestore && item) {
    unmarkDeletedDefaultId(db, item.referenceCode);
    const orig = item.originalData;
    if (orig && typeof orig === 'object') {
      unmarkDeletedDefaultId(db, orig.id);
      if (item.originalCategory === 'Resident Record') {
        const { linkedApplications, linkedVictims, ...restoredUserRaw } = orig;
        if (restoredUserRaw?.id && restoredUserRaw?.email) {
          unmarkDeletedDefaultId(db, restoredUserRaw.id);
          const emailLower = normalizeAccountEmail(restoredUserRaw.email);
          const alreadyExists = db.users.some(
            u => u.id === restoredUserRaw.id || u.email.toLowerCase() === emailLower
          );
          if (!alreadyExists) {
            const restoredUser: any = {
              ...restoredUserRaw,
              email: emailLower,
              username: emailLower,
              passwordHash: restoredUserRaw.passwordHash || hashPassword('Resident@Bugo2026!'),
            };
            db.users.unshift(restoredUser);
            persistAsync(syncUserToMySQL(restoredUser), 'user.restore');
          }
        }
        if (Array.isArray(linkedApplications)) {
          for (const linkedApp of linkedApplications) {
            if (linkedApp?.id && !db.applications.some(a => a.id === linkedApp.id)) {
              db.applications.unshift(linkedApp);
              persistAsync(syncApplicationToMySQL(linkedApp), 'application.restoreFromUser');
            }
          }
          broadcastSystemUpdate('applications', 'restore', { fromArchive: id });
        }
        if (Array.isArray(linkedVictims)) {
          if (!Array.isArray(db.disasterVictims)) db.disasterVictims = [];
          for (const linkedVictim of linkedVictims) {
            if (linkedVictim?.id && !db.disasterVictims.some(v => v.id === linkedVictim.id)) {
              db.disasterVictims.unshift(linkedVictim);
            }
          }
          broadcastSystemUpdate('disasterVictims', 'restore', { fromArchive: id });
        }
        broadcastSystemUpdate('residents', 'restore', { id: restoredUserRaw?.id });
      } else if (item.originalCategory === 'Service Application') {
        if (orig.id && !db.applications.some(a => a.id === orig.id)) {
          db.applications.unshift(orig);
          persistAsync(syncApplicationToMySQL(orig), 'application.restore');
          broadcastSystemUpdate('applications', 'restore', { id: orig.id });
        }
      } else if (item.originalCategory === 'Program / Service') {
        if (orig.id && !db.programs.some(p => p.id === orig.id)) {
          db.programs.push(orig);
          db.programs = sortProgramsAlphabetically(db.programs);
          persistAsync(syncProgramToMySQL(orig), 'program.restore');
          broadcastSystemUpdate('programs', 'restore', { id: orig.id });
        }
      } else if (item.originalCategory === 'Notice') {
        if (orig.id && !db.announcements.some(a => a.id === orig.id)) {
          db.announcements.unshift(orig);
          persistAsync(syncAnnouncementToMySQL(orig), 'announcement.restore');
          broadcastSystemUpdate('announcements', 'restore', { id: orig.id });
        }
      } else if (item.originalCategory === 'Disaster Victim') {
        if (!Array.isArray(db.disasterVictims)) db.disasterVictims = [];
        if (orig.id && !db.disasterVictims.some(v => v.id === orig.id)) {
          db.disasterVictims.unshift(orig);
          broadcastSystemUpdate('disasterVictims', 'restore', { id: orig.id });
        }
      } else if (item.originalCategory === 'Hazard Zone') {
        if (!Array.isArray(db.hazardZones)) db.hazardZones = [];
        if (orig.id && !db.hazardZones.some(z => z.id === orig.id)) {
          db.hazardZones.unshift(orig);
          broadcastSystemUpdate('hazardZones', 'restore', { id: orig.id });
        }
      }
    }

    const restoreLog = {
      id: `act-${Date.now()}`,
      residentName: item.title || 'Archived Record',
      residentIdNumber: item.referenceCode || 'ARCHIVED',
      purok: 'Admin Office',
      actionType: 'Status Updated',
      locationOrService: 'Archives Unit',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      officerInCharge: req.authUser?.email || 'Admin Staff',
      status: 'Completed',
      details: `Restored archived ${item.originalCategory} record "${item.title}".`
    };
    db.activityLogs.unshift(restoreLog);
    persistAsync(syncActivityLogToMySQL(restoreLog), 'activityLog.restoreArchive');
  }

  saveDatabase(db);
  broadcastSystemUpdate('archives', shouldRestore ? 'restore' : 'delete', { id });
  res.json({ success: true, restoredCategory: shouldRestore && item ? item.originalCategory : undefined });
});

// FILE UPLOAD: Strict Size & MIME Whitelist
app.post('/api/upload', authenticateJWT, (req, res) => {
  const { name, type, sizeBytes } = req.body;

  if (sizeBytes && sizeBytes > 5 * 1024 * 1024) {
    return res.status(400).json({ success: false, message: 'File exceeds 5MB limit.' });
  }

  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (type && !allowedTypes.includes(type.toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only PDF and JPG/PNG/WebP images are accepted.'
    });
  }

  const cleanName = (name || 'uploaded_doc').replace(/[^a-zA-Z0-9._-]/g, '_');

  res.json({
    success: true,
    file: {
      id: `doc-${Date.now()}`,
      name: cleanName,
      type: type && type.includes('pdf') ? 'PDF' : 'Image',
      size: `${((sizeBytes || 1024 * 1024) / (1024 * 1024)).toFixed(1)} MB`,
      uploadDate: new Date().toISOString().split('T')[0],
      verified: true
    }
  });
});

// ----------------------------------------------------
// DISASTER VICTIM RECORDS
// ----------------------------------------------------
app.get('/api/disaster-victims', (_req, res) => {
  res.json(db.disasterVictims || []);
});

app.post('/api/disaster-victims', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const body = req.body || {};
  const residentId = body.residentId ? String(body.residentId).trim() : '';
  const matchedResident = residentId
    ? db.users.find(u => u.id === residentId && u.role === 'resident')
    : undefined;

  if (residentId && !matchedResident) {
    return res.status(404).json({
      success: false,
      message: 'Selected resident was not found.'
    });
  }

  // Residents created via Admin "Add Resident" must have disaster victim info entered manually (not auto-filled).
  // Only residents created via "Create Account" pre-fill from their provided Create Account info.
  const isFromCreateAccount = Boolean(matchedResident && (matchedResident as any).accountSource !== 'admin_add_resident');

  const fullName = String(
    body.fullName || (isFromCreateAccount ? matchedResident?.name : '') || ''
  ).trim();
  const purok = String(
    body.purok || (isFromCreateAccount ? matchedResident?.purok : '') || ''
  ).trim();
  const disasterType = String(
    body.disasterType ||
    (isFromCreateAccount && (matchedResident as any)?.isDisasterAffected ? (matchedResident as any).disasterType : '') ||
    ''
  ).trim();
  const damageLevel = String(body.damageLevel || 'Moderate').trim() as any;

  if (!fullName || !purok || !disasterType) {
    return res.status(400).json({
      success: false,
      message: 'Full name, Purok/Zone, and disaster type are required.'
    });
  }

  if (!Array.isArray(db.disasterVictims)) db.disasterVictims = [];

  // Derive resident demographic tags ONLY from Create Account info when tags are not explicitly specified
  const derivedTags: string[] = [];
  if (isFromCreateAccount && matchedResident) {
    const profile = matchedResident as Record<string, any>;
    if (profile.isSenior || (matchedResident.age && matchedResident.age >= 60)) derivedTags.push('Senior');
    if (profile.isPwd) derivedTags.push('PWD');
    if (profile.isSoloParent) derivedTags.push('Solo Parent');
    if (matchedResident.age !== undefined && matchedResident.age < 18) derivedTags.push('Minor');
  }
  const vulnerabilityTags = Array.isArray(body.vulnerabilityTags)
    ? body.vulnerabilityTags
    : (isFromCreateAccount ? derivedTags : []);

  const rawRequestedIds: string[] = Array.isArray(body.enrolledProgramIds)
    ? body.enrolledProgramIds
        .filter((id: any) => id !== null && id !== undefined && String(id).trim() !== '' && String(id) !== 'null' && String(id) !== 'undefined')
        .map((id: any) => String(id).trim())
    : [];

  const requestedIds = rawRequestedIds.filter(pid => {
    const prog = (db.programs || []).find((p: any) => p.id === pid);
    return !prog || doesVictimQualifyForDisasterProgram(disasterType, prog);
  });

  if (rawRequestedIds.length > 0 && requestedIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: `Disaster type "${disasterType}" does not qualify for the selected program category.`
    });
  }

  const candidateProgramIds: string[] = Array.from(new Set(requestedIds));
  const incomingResKey = getVictimResidentKey({ residentId: matchedResident?.id, fullName });

  // Filter out any program where this resident already appears so there are zero duplicate names under a program
  const enrolledIds: string[] = candidateProgramIds.filter(pid => {
    const alreadyInProgram = (db.disasterVictims as any[]).some(
      v => getVictimResidentKey(v) === incomingResKey && Array.isArray(v.enrolledProgramIds) && v.enrolledProgramIds.includes(pid)
    );
    return !alreadyInProgram;
  });

  // Check if this resident already has a record for this exact disaster type
  const existingSameDisaster = (db.disasterVictims as any[]).find(
    v =>
      getVictimResidentKey(v) === incomingResKey &&
      String(v.disasterType || '').trim().toLowerCase() === disasterType.toLowerCase()
  );

  if (existingSameDisaster) {
    const existingIds: string[] = Array.isArray(existingSameDisaster.enrolledProgramIds) ? [...existingSameDisaster.enrolledProgramIds] : [];
    const newProgramIdsToAdd = enrolledIds.filter(pid => !existingIds.includes(pid));
    if (newProgramIdsToAdd.length === 0) {
      return res.status(409).json({
        success: false,
        message: `${fullName} is already recorded for ${disasterType} under this program.`
      });
    }
    const mergedIds = Array.from(new Set([...existingIds, ...newProgramIdsToAdd]));
    const mergedTitles = mergedIds.map(id => db.programs.find(p => p.id === id)?.title || id);
    existingSameDisaster.enrolledProgramIds = mergedIds;
    existingSameDisaster.enrolledProgramTitles = mergedTitles;
    const notifyTargetUser =
      matchedResident ||
      (existingSameDisaster.residentId
        ? db.users.find(u => u.id === existingSameDisaster.residentId && u.role === 'resident')
        : undefined) ||
      db.users.find(
        u =>
          u.role === 'resident' &&
          String(u.name || '').trim().toLowerCase() === fullName.toLowerCase()
      );
    let sentNotif = false;
    const isVictimQualified =
      existingSameDisaster.selectionStatus === 'Selected' || existingSameDisaster.selectionStatus === 'Distributed';
    if (notifyTargetUser && isVictimQualified) {
      for (const pid of newProgramIdsToAdd) {
        const targetProg = db.programs.find(p => p.id === pid);
        const progTitle = targetProg?.title || pid;
        const created = addNotificationSafely(db, {
          userId: notifyTargetUser.id,
          title: `Qualified: ${progTitle}`,
          message: `Barangay Admin marked you as Qualified under "${progTitle}" (${disasterType}).`,
          type: 'status_update',
          targetArea: 'dashboard'
        });
        if (created) sentNotif = true;
      }
    }
    saveDatabase(db);
    broadcastSystemUpdate('disasterVictims', 'update', { id: existingSameDisaster.id });
    if (sentNotif) {
      broadcastSystemUpdate('notifications', 'create', { userId: notifyTargetUser?.id });
    }
    return res.json({ success: true, victim: existingSameDisaster, updatedExisting: true });
  }

  // If caller explicitly targeted a program and resident is already enrolled in all requested programs, reject duplicate
  if (requestedIds.length > 0 && requestedIds.every(pid => !enrolledIds.includes(pid))) {
    return res.status(409).json({
      success: false,
      message: `${fullName} is already listed under this program.`
    });
  }

  const enrolledTitles: string[] = enrolledIds.map(id => {
    const prog = db.programs.find(p => p.id === id);
    return prog ? prog.title : id;
  });

  const selectionStatus = (['Waitlisted', 'Selected', 'Distributed'].includes(body.selectionStatus)
    ? body.selectionStatus
    : 'Waitlisted') as 'Waitlisted' | 'Selected' | 'Distributed';

  const resolvedAge =
    body.age !== undefined && body.age !== ''
      ? Number(body.age)
      : (isFromCreateAccount ? matchedResident?.age : undefined);
  const rawVictimContact = String(body.contactNumber || (isFromCreateAccount ? matchedResident?.contactNumber : '') || '').trim();
  let resolvedContact = 'N/A';
  if (rawVictimContact && rawVictimContact !== 'N/A') {
    const phoneCheck = normalizePhMobile(rawVictimContact);
    if (!phoneCheck.valid) {
      return res.status(400).json({
        success: false,
        message: phoneCheck.reason || 'Please enter a valid 11-digit Philippine mobile number (e.g. 0917 628 4915).'
      });
    }
    resolvedContact = phoneCheck.local09;
  }
  const resolvedAddress =
    String(body.address || (isFromCreateAccount ? matchedResident?.address : '') || '').trim() || `${purok}, Barangay Bugo`;
  const resolvedHouseholdSize = Math.max(
    1,
    Number(
      body.householdSize !== undefined && body.householdSize !== ''
        ? body.householdSize
        : (isFromCreateAccount ? matchedResident?.familyMembersCount : 1)
    ) || 1
  );
  const resolvedHouseholdIncome =
    String(body.householdIncome || (isFromCreateAccount ? matchedResident?.householdIncome : '') || '₱8,500.00 (Informal / Low Income)').trim();

  const newVictim = {
    id: `dv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    residentId: matchedResident?.id,
    victimCode: `DV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    fullName,
    age: resolvedAge,
    contactNumber: resolvedContact,
    purok,
    address: resolvedAddress,
    disasterType,
    incidentDate: String(body.incidentDate || new Date().toISOString().split('T')[0]),
    damageLevel,
    householdSize: resolvedHouseholdSize,
    householdIncome: resolvedHouseholdIncome,
    vulnerabilityTags,
    enrolledProgramIds: enrolledIds,
    enrolledProgramTitles: enrolledTitles,
    selectionStatus,
    recordedAt: new Date().toISOString(),
    notes: body.notes ? String(body.notes).trim() : ''
  };

  db.disasterVictims.unshift(newVictim);
  db.activityLogs.unshift({
    id: `act-${Date.now()}`,
    residentName: fullName,
    residentIdNumber: matchedResident?.residentIdNumber || newVictim.victimCode,
    purok,
    actionType: 'Status Updated',
    locationOrService: 'Disaster Relief Registry',
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
    officerInCharge: req.authUser?.email || 'Barangay Administrator',
    status: 'Completed',
    details: `Recorded ${disasterType} victim (${damageLevel} damage).`
  });
  const notifyNewTargetUser =
    matchedResident ||
    db.users.find(
      u =>
        u.role === 'resident' &&
        String(u.name || '').trim().toLowerCase() === fullName.toLowerCase()
    );
  let sentNewNotif = false;
  const isNewVictimQualified = selectionStatus === 'Selected' || selectionStatus === 'Distributed';
  if (notifyNewTargetUser && enrolledIds.length > 0 && isNewVictimQualified) {
    for (const pid of enrolledIds) {
      const targetProg = db.programs.find(p => p.id === pid);
      const progTitle = targetProg?.title || pid;
      const created = addNotificationSafely(db, {
        userId: notifyNewTargetUser.id,
        title: `Qualified: ${progTitle}`,
        message: `Barangay Admin marked you as Qualified under "${progTitle}" (${disasterType}).`,
        type: 'status_update',
        targetArea: 'dashboard'
      });
      if (created) sentNewNotif = true;
    }
  }
  saveDatabase(db);
  broadcastSystemUpdate('disasterVictims', 'create', { id: newVictim.id });
  if (sentNewNotif) {
    broadcastSystemUpdate('notifications', 'create', { userId: notifyNewTargetUser?.id });
  }
  res.json({ success: true, victim: newVictim });
});

app.patch('/api/disaster-victims/:id', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!Array.isArray(db.disasterVictims)) db.disasterVictims = [];
  const idx = db.disasterVictims.findIndex(v => v.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Victim record not found.' });
  }

  const existing = db.disasterVictims[idx] as any;
  const updates = req.body || {};
  const nextDisasterType = String(updates.disasterType || existing.disasterType).trim();
  const resKey = getVictimResidentKey({
    residentId: updates.residentId !== undefined ? updates.residentId : existing.residentId,
    fullName: updates.fullName || existing.fullName
  });

  const baseEnrolledIds: string[] = Array.isArray(updates.enrolledProgramIds)
    ? Array.from(
        new Set(
          updates.enrolledProgramIds
            .filter((pid: any) => pid !== null && pid !== undefined && String(pid).trim() !== '' && String(pid) !== 'null' && String(pid) !== 'undefined')
            .map((pid: any) => String(pid).trim())
        )
      )
    : [...(existing.enrolledProgramIds || [])];

  // Filter explicitly targeted programs against disasterType qualification & prevent duplicates across rows
  const enrolledIds = Array.from(new Set(baseEnrolledIds)).filter(pid => {
    const prog = (db.programs || []).find((p: any) => p.id === pid);
    if (prog && !doesVictimQualifyForDisasterProgram(nextDisasterType, prog)) {
      return false;
    }
    const duplicateInOtherRow = (db.disasterVictims as any[]).some(
      (other, oIdx) =>
        oIdx !== idx &&
        getVictimResidentKey(other) === resKey &&
        Array.isArray(other.enrolledProgramIds) &&
        other.enrolledProgramIds.includes(pid)
    );
    return !duplicateInOtherRow;
  });

  const enrolledTitles: string[] = enrolledIds.map(pid => {
    const prog = db.programs.find(p => p.id === pid);
    return prog ? prog.title : pid;
  });

  const nextStatus = updates.selectionStatus || existing.selectionStatus;
  const nextSize = updates.householdSize !== undefined ? Math.max(1, Number(updates.householdSize) || 1) : existing.householdSize;

  const updatedVictim = {
    ...existing,
    ...updates,
    id: existing.id,
    victimCode: existing.victimCode,
    disasterType: nextDisasterType,
    householdSize: nextSize,
    enrolledProgramIds: enrolledIds,
    enrolledProgramTitles: enrolledTitles,
    selectionStatus: nextStatus
  };

  db.disasterVictims[idx] = updatedVictim;
  const becameQualified =
    existing.selectionStatus !== 'Selected' &&
    existing.selectionStatus !== 'Distributed' &&
    (nextStatus === 'Selected' || nextStatus === 'Distributed');
  let sentQualNotif = false;
  if (becameQualified && enrolledIds.length > 0) {
    const notifyUser =
      (updatedVictim.residentId
        ? db.users.find(u => u.id === updatedVictim.residentId && u.role === 'resident')
        : undefined) ||
      db.users.find(
        u =>
          u.role === 'resident' &&
          String(u.name || '').trim().toLowerCase() === String(updatedVictim.fullName || '').trim().toLowerCase()
      );
    if (notifyUser) {
      for (const pid of enrolledIds) {
        const targetProg = db.programs.find(p => p.id === pid);
        const progTitle = targetProg?.title || pid;
        const created = addNotificationSafely(db, {
          userId: notifyUser.id,
          title: `Qualified: ${progTitle}`,
          message: `Barangay Admin marked you as Qualified under "${progTitle}" (${nextDisasterType}).`,
          type: 'status_update',
          targetArea: 'dashboard'
        });
        if (created) sentQualNotif = true;
      }
    }
  }
  saveDatabase(db);
  broadcastSystemUpdate('disasterVictims', 'update', { id });
  if (sentQualNotif) {
    broadcastSystemUpdate('notifications', 'create', { victimId: id });
  }
  res.json({ success: true, victim: updatedVictim });
});

app.delete('/api/disaster-victims/:id', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!Array.isArray(db.disasterVictims)) db.disasterVictims = [];
  const idx = db.disasterVictims.findIndex(v => v.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Victim record not found.' });
  }
  const [removed] = db.disasterVictims.splice(idx, 1);
  const archivedItem = createArchiveEntry(db, {
    title: removed.fullName,
    originalCategory: 'Disaster Victim',
    referenceCode: removed.victimCode || removed.id,
    deletedBy: req.authUser?.email || 'Barangay Administrator',
    reasonForArchive: `Deleted disaster victim record (${removed.disasterType} • ${removed.purok}).`,
    originalData: removed,
  });
  saveDatabase(db);
  broadcastSystemUpdate('disasterVictims', 'delete', { id });
  broadcastSystemUpdate('archives', 'create', { id: archivedItem.id });
  res.json({ success: true, deletedId: id, deletedName: removed.fullName, archivedItem });
});

// ----------------------------------------------------
// RANKING CLASSIFICATION (PRIORITY 1 CRITICAL - 5 NO DAMAGE)
// ----------------------------------------------------
const sortRankingList = (list: any[]) =>
  [...(list || [])].sort((a, b) => {
    if ((a.priority ?? 5) !== (b.priority ?? 5)) return (a.priority ?? 5) - (b.priority ?? 5);
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  });

app.get('/api/ranking-classifications', (_req, res) => {
  res.json(sortRankingList(db.rankingClassifications || []));
});

app.post('/api/ranking-classifications', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const residentId = String(req.body?.residentId || '').trim();
  const priority = Number(req.body?.priority);

  if (!residentId) {
    return res.status(400).json({ success: false, message: 'Resident selection is required.' });
  }
  if (![1, 2, 3, 4, 5].includes(priority)) {
    return res.status(400).json({ success: false, message: 'Priority must be between 1 and 5.' });
  }

  const resident = (db.users || []).find(u => u.id === residentId && u.role === 'resident');
  if (!resident) {
    return res.status(404).json({ success: false, message: 'Selected resident was not found.' });
  }

  if (!Array.isArray(db.rankingClassifications)) db.rankingClassifications = [];
  const nowIso = new Date().toISOString();
  const existingIdx = db.rankingClassifications.findIndex((item: any) => item.residentId === residentId);

  let savedEntry: any;
  if (existingIdx !== -1) {
    savedEntry = {
      ...db.rankingClassifications[existingIdx],
      residentName: resident.name,
      purok: resident.purok || 'Barangay Bugo',
      priority,
      updatedAt: nowIso
    };
    db.rankingClassifications[existingIdx] = savedEntry;
  } else {
    savedEntry = {
      id: `rc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      residentId: resident.id,
      residentName: resident.name,
      purok: resident.purok || 'Barangay Bugo',
      priority,
      updatedAt: nowIso
    };
    db.rankingClassifications.unshift(savedEntry);
  }

  const sorted = sortRankingList(db.rankingClassifications);
  db.rankingClassifications = sorted;
  saveDatabase(db);
  broadcastSystemUpdate('rankingClassifications', 'upsert', { id: savedEntry.id, residentId });
  res.json({ success: true, entry: savedEntry, rankingClassifications: sorted });
});

app.patch('/api/ranking-classifications/:id', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const priority = Number(req.body?.priority);

  if (![1, 2, 3, 4, 5].includes(priority)) {
    return res.status(400).json({ success: false, message: 'Priority must be between 1 and 5.' });
  }
  if (!Array.isArray(db.rankingClassifications)) db.rankingClassifications = [];
  const idx = db.rankingClassifications.findIndex((item: any) => item.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Ranking entry not found.' });
  }

  const existing = db.rankingClassifications[idx];
  const resident = (db.users || []).find(u => u.id === existing.residentId);
  const updatedEntry = {
    ...existing,
    residentName: resident?.name || existing.residentName,
    purok: resident?.purok || existing.purok,
    priority,
    updatedAt: new Date().toISOString()
  };

  db.rankingClassifications[idx] = updatedEntry;
  const sorted = sortRankingList(db.rankingClassifications);
  db.rankingClassifications = sorted;
  saveDatabase(db);
  broadcastSystemUpdate('rankingClassifications', 'update', { id });
  res.json({ success: true, entry: updatedEntry, rankingClassifications: sorted });
});

app.delete('/api/ranking-classifications/:id', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!Array.isArray(db.rankingClassifications)) db.rankingClassifications = [];
  const idx = db.rankingClassifications.findIndex((item: any) => item.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Ranking entry not found.' });
  }

  db.rankingClassifications.splice(idx, 1);
  const sorted = sortRankingList(db.rankingClassifications);
  db.rankingClassifications = sorted;
  saveDatabase(db);
  broadcastSystemUpdate('rankingClassifications', 'delete', { id });
  res.json({ success: true, deletedId: id, rankingClassifications: sorted });
});

app.post('/api/ranking-classifications/bulk', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const priority = Number(req.body?.priority);
  const selectAll = Boolean(req.body?.selectAll);
  const zone = String(req.body?.zone || '').trim();
  const residentIds = Array.isArray(req.body?.residentIds)
    ? req.body.residentIds.map((id: any) => String(id || '').trim()).filter(Boolean)
    : [];

  if (![1, 2, 3, 4, 5].includes(priority)) {
    return res.status(400).json({ success: false, message: 'Priority must be between 1 and 5.' });
  }

  const normalizeShortZone = (val?: string) => String(val || '').split(' - ')[0].trim().toLowerCase();
  const targetZoneNorm = zone && zone.toLowerCase() !== 'all' ? normalizeShortZone(zone) : '';

  const activeResidents = (db.users || []).filter(
    (u: any) => u.role === 'resident' && !u.isBanned && u.registrationStatus !== 'Rejected'
  );

  let matchedResidents: any[] = [];
  if (residentIds.length > 0) {
    const idSet = new Set(residentIds);
    matchedResidents = activeResidents.filter((u: any) => idSet.has(u.id));
  } else if (selectAll || targetZoneNorm) {
    matchedResidents = targetZoneNorm
      ? activeResidents.filter((u: any) => normalizeShortZone(u.purok) === targetZoneNorm)
      : activeResidents;
  } else {
    return res.status(400).json({ success: false, message: 'Select residents, a zone, or Select All.' });
  }

  if (matchedResidents.length === 0) {
    return res.status(404).json({ success: false, message: 'No matching active residents found.' });
  }

  if (!Array.isArray(db.rankingClassifications)) db.rankingClassifications = [];
  const nowIso = new Date().toISOString();
  const existingByResidentId = new Map<string, number>();
  db.rankingClassifications.forEach((item: any, idx: number) => {
    if (item?.residentId) existingByResidentId.set(item.residentId, idx);
  });

  matchedResidents.forEach((resident: any, i: number) => {
    const existingIdx = existingByResidentId.get(resident.id);
    if (existingIdx !== undefined) {
      db.rankingClassifications[existingIdx] = {
        ...db.rankingClassifications[existingIdx],
        residentName: resident.name,
        purok: resident.purok || 'Barangay Bugo',
        priority,
        updatedAt: nowIso
      };
    } else {
      const createdEntry = {
        id: `rc-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        residentId: resident.id,
        residentName: resident.name,
        purok: resident.purok || 'Barangay Bugo',
        priority,
        updatedAt: nowIso
      };
      db.rankingClassifications.unshift(createdEntry);
    }
  });

  const sorted = sortRankingList(db.rankingClassifications);
  db.rankingClassifications = sorted;
  saveDatabase(db);
  broadcastSystemUpdate('rankingClassifications', 'bulk-upsert', {
    count: matchedResidents.length,
    zone: zone || 'all',
    priority,
  });
  res.json({
    success: true,
    updatedCount: matchedResidents.length,
    rankingClassifications: sorted
  });
});

app.post('/api/ranking-classifications/bulk-delete', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids.map((id: any) => String(id || '').trim()).filter(Boolean)
    : [];

  if (ids.length === 0) {
    return res.status(400).json({ success: false, message: 'No ranking entries selected to remove.' });
  }

  if (!Array.isArray(db.rankingClassifications)) db.rankingClassifications = [];
  const idSet = new Set(ids);
  const beforeCount = db.rankingClassifications.length;
  db.rankingClassifications = db.rankingClassifications.filter((item: any) => !idSet.has(item.id));
  const deletedCount = beforeCount - db.rankingClassifications.length;

  const sorted = sortRankingList(db.rankingClassifications);
  db.rankingClassifications = sorted;
  saveDatabase(db);
  broadcastSystemUpdate('rankingClassifications', 'bulk-delete', { deletedCount });
  res.json({ success: true, deletedCount, rankingClassifications: sorted });
});

// ----------------------------------------------------
// BUGO DISASTER HAZARD MAP ZONES
// ----------------------------------------------------
app.get('/api/hazard-zones', (_req, res) => {
  res.json(db.hazardZones || []);
});

app.post('/api/hazard-zones', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const disasterType = String(body.disasterType || 'Flood').trim();
  const riskLevel = String(body.riskLevel || 'Moderate').trim();
  const purok = stripZoneName(body.purok) || 'Zone 1';
  const lat = Number(body.lat);
  const lng = Number(body.lng);

  if (!name || Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({
      success: false,
      message: 'Zone name and valid coordinates (lat, lng) are required.'
    });
  }

  if (!Array.isArray(db.hazardZones)) db.hazardZones = [];

  const newZone = {
    id: `hz-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name,
    disasterType,
    riskLevel,
    purok,
    lat,
    lng,
    radiusMeters: Math.max(50, Math.min(2000, Number(body.radiusMeters) || 180)),
    description: String(body.description || '').trim() || `${disasterType} hazard area in ${purok}.`,
    affectedHouseholdsEst: body.affectedHouseholdsEst ? Number(body.affectedHouseholdsEst) : undefined,
    updatedAt: new Date().toISOString().split('T')[0]
  };

  db.hazardZones.unshift(newZone);

  const createdNotifications: any[] = [];
  if (Array.isArray(db.users)) {
    const activeResidents = db.users.filter((u: any) => u.role === 'resident' && !u.isBanned);
    const signatory = getEffectiveSecretariatDetails(db).punongBarangay;
    const issueDate = getExactFormattedDate();
    for (const resident of activeResidents) {
      const created = addNotificationSafely(db, {
        userId: resident.id,
        title: `Disaster Alert: ${newZone.name}`,
        message: `${newZone.riskLevel} ${newZone.disasterType} hazard zone added in ${newZone.purok}. ${newZone.description}`,
        type: 'announcement',
        targetArea: 'hazard-map',
        documentData: {
          docType: 'Barangay Bugo Disaster Hazard Advisory',
          controlNumber: `HZ-2026-${newZone.id.slice(-4).toUpperCase()}`,
          issueDate,
          recipientName: resident.name,
          subject: `${newZone.name} (${newZone.disasterType} - ${newZone.riskLevel} Risk)`,
          narrative: newZone.description,
          venueOrOffice: `${newZone.purok}, Barangay Bugo`,
          officialRemarks: `Please exercise caution and monitor the Barangay Bugo Disaster Hazard Map for evacuation guidance.`,
          signatoryName: signatory,
          signatoryRole: 'Punong Barangay'
        }
      });
      if (created) createdNotifications.push(created);
    }
  }

  saveDatabase(db);
  broadcastSystemUpdate('hazardZones', 'create', { id: newZone.id });
  if (createdNotifications.length > 0) {
    broadcastSystemUpdate('notifications', 'create', { hazardZoneId: newZone.id });
  }
  res.json({ success: true, zone: newZone, createdNotifications });
});

app.patch('/api/hazard-zones/:id', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!Array.isArray(db.hazardZones)) db.hazardZones = [];
  const idx = db.hazardZones.findIndex(z => z.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Hazard zone not found.' });
  }
  const existing = db.hazardZones[idx];
  const updates = req.body || {};
  const updated = {
    ...existing,
    ...updates,
    id: existing.id,
    lat: updates.lat !== undefined ? Number(updates.lat) : existing.lat,
    lng: updates.lng !== undefined ? Number(updates.lng) : existing.lng,
    radiusMeters: updates.radiusMeters !== undefined ? Math.max(50, Math.min(2000, Number(updates.radiusMeters))) : existing.radiusMeters,
    updatedAt: new Date().toISOString().split('T')[0]
  };
  db.hazardZones[idx] = updated;
  saveDatabase(db);
  broadcastSystemUpdate('hazardZones', 'update', { id });
  res.json({ success: true, zone: updated });
});

app.delete('/api/hazard-zones/:id', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!Array.isArray(db.hazardZones)) db.hazardZones = [];
  const idx = db.hazardZones.findIndex(z => z.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Hazard zone not found.' });
  }
  const [removed] = db.hazardZones.splice(idx, 1);
  const archivedItem = createArchiveEntry(db, {
    title: removed.name,
    originalCategory: 'Hazard Zone',
    referenceCode: removed.id,
    deletedBy: req.authUser?.email || 'Barangay Administrator',
    reasonForArchive: `Deleted hazard zone "${removed.name}" (${removed.disasterType} • ${removed.riskLevel}).`,
    originalData: removed,
  });
  saveDatabase(db);
  broadcastSystemUpdate('hazardZones', 'delete', { id });
  broadcastSystemUpdate('archives', 'create', { id: archivedItem.id });
  res.json({ success: true, deletedId: id, archivedItem });
});

app.patch('/api/hazard-summaries/:category/:id', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const category = String(req.params.category || '').trim().toLowerCase() as 'flood' | 'landslide' | 'earthquake' | 'fire' | 'other';
  const id = String(req.params.id || '').trim();
  const validCategories = new Set(['flood', 'landslide', 'earthquake', 'fire', 'other']);
  if (!validCategories.has(category)) {
    return res.status(400).json({ success: false, message: 'Invalid hazard category.' });
  }

  const defaultSummaries = createDefaultHazardSummaries();
  if (!db.hazardSummaries || typeof db.hazardSummaries !== 'object') {
    db.hazardSummaries = defaultSummaries;
  }
  if (!Array.isArray(db.hazardSummaries[category]) || db.hazardSummaries[category].length === 0) {
    db.hazardSummaries[category] = defaultSummaries[category];
  }

  const list = db.hazardSummaries[category];
  const idx = list.findIndex((item: any) => item.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Hazard area record not found.' });
  }

  const existing = list[idx];
  const body = req.body || {};
  const allowedRiskLevels = new Set(['Low', 'Moderate', 'High']);
  const nextRiskLevel = typeof body.riskLevel === 'string' && allowedRiskLevels.has(body.riskLevel.trim())
    ? body.riskLevel.trim()
    : existing.riskLevel;
  const nextPurok = typeof body.purok === 'string' && body.purok.trim()
    ? stripZoneName(body.purok) || existing.purok
    : existing.purok;
  const nextLat = body.lat !== undefined && !Number.isNaN(Number(body.lat)) ? Number(body.lat) : existing.lat;
  const nextLng = body.lng !== undefined && !Number.isNaN(Number(body.lng)) ? Number(body.lng) : existing.lng;

  let updated: any;
  if (category === 'flood') {
    updated = {
      ...existing,
      areaName: typeof body.areaName === 'string' && body.areaName.trim() ? body.areaName.trim().slice(0, 140) : existing.areaName,
      purok: nextPurok,
      riskLevel: nextRiskLevel,
      peakDepthEst: typeof body.peakDepthEst === 'string' && body.peakDepthEst.trim() ? body.peakDepthEst.trim().slice(0, 60) : existing.peakDepthEst,
      exposedHouseholds: body.exposedHouseholds !== undefined && !Number.isNaN(Number(body.exposedHouseholds)) ? Math.max(0, Math.round(Number(body.exposedHouseholds))) : existing.exposedHouseholds,
      primaryTrigger: typeof body.primaryTrigger === 'string' && body.primaryTrigger.trim() ? body.primaryTrigger.trim().slice(0, 300) : existing.primaryTrigger,
      evacuationSite: typeof body.evacuationSite === 'string' && body.evacuationSite.trim() ? body.evacuationSite.trim().slice(0, 140) : existing.evacuationSite,
      drainageStatus: typeof body.drainageStatus === 'string' && body.drainageStatus.trim() ? body.drainageStatus.trim().slice(0, 300) : existing.drainageStatus,
      lat: nextLat,
      lng: nextLng
    };
  } else if (category === 'landslide') {
    updated = {
      ...existing,
      sectorName: typeof body.sectorName === 'string' && body.sectorName.trim() ? body.sectorName.trim().slice(0, 140) : existing.sectorName,
      purok: nextPurok,
      riskLevel: nextRiskLevel,
      slopeGrade: typeof body.slopeGrade === 'string' && body.slopeGrade.trim() ? body.slopeGrade.trim().slice(0, 80) : existing.slopeGrade,
      exposedHouseholds: body.exposedHouseholds !== undefined && !Number.isNaN(Number(body.exposedHouseholds)) ? Math.max(0, Math.round(Number(body.exposedHouseholds))) : existing.exposedHouseholds,
      soilAndTrigger: typeof body.soilAndTrigger === 'string' && body.soilAndTrigger.trim() ? body.soilAndTrigger.trim().slice(0, 300) : existing.soilAndTrigger,
      safeAssemblySite: typeof body.safeAssemblySite === 'string' && body.safeAssemblySite.trim() ? body.safeAssemblySite.trim().slice(0, 140) : existing.safeAssemblySite,
      mitigationNotes: typeof body.mitigationNotes === 'string' && body.mitigationNotes.trim() ? body.mitigationNotes.trim().slice(0, 300) : existing.mitigationNotes,
      lat: nextLat,
      lng: nextLng
    };
  } else if (category === 'earthquake') {
    updated = {
      ...existing,
      sectorName: typeof body.sectorName === 'string' && body.sectorName.trim() ? body.sectorName.trim().slice(0, 140) : existing.sectorName,
      purok: nextPurok,
      riskLevel: nextRiskLevel,
      soilProfile: typeof body.soilProfile === 'string' && body.soilProfile.trim() ? body.soilProfile.trim().slice(0, 300) : existing.soilProfile,
      peisIntensityEstimate: typeof body.peisIntensityEstimate === 'string' && body.peisIntensityEstimate.trim() ? body.peisIntensityEstimate.trim().slice(0, 60) : existing.peisIntensityEstimate,
      faultProximityKm: body.faultProximityKm !== undefined && !Number.isNaN(Number(body.faultProximityKm)) ? Math.max(0, Number(Number(body.faultProximityKm).toFixed(1))) : existing.faultProximityKm,
      exposedHouseholds: body.exposedHouseholds !== undefined && !Number.isNaN(Number(body.exposedHouseholds)) ? Math.max(0, Math.round(Number(body.exposedHouseholds))) : existing.exposedHouseholds,
      safeAssemblySite: typeof body.safeAssemblySite === 'string' && body.safeAssemblySite.trim() ? body.safeAssemblySite.trim().slice(0, 140) : existing.safeAssemblySite,
      notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 300) : existing.notes,
      lat: nextLat,
      lng: nextLng
    };
  } else if (category === 'fire') {
    updated = {
      ...existing,
      areaName: typeof body.areaName === 'string' && body.areaName.trim() ? body.areaName.trim().slice(0, 140) : existing.areaName,
      purok: nextPurok,
      riskLevel: nextRiskLevel,
      frequencyLabel: typeof body.frequencyLabel === 'string' && body.frequencyLabel.trim() ? body.frequencyLabel.trim().slice(0, 60) : existing.frequencyLabel,
      incidentsLast3Years: body.incidentsLast3Years !== undefined && !Number.isNaN(Number(body.incidentsLast3Years)) ? Math.max(0, Math.round(Number(body.incidentsLast3Years))) : existing.incidentsLast3Years,
      affectedStructuresEst: body.affectedStructuresEst !== undefined && !Number.isNaN(Number(body.affectedStructuresEst)) ? Math.max(0, Math.round(Number(body.affectedStructuresEst))) : existing.affectedStructuresEst,
      primaryCauses: typeof body.primaryCauses === 'string' && body.primaryCauses.trim() ? body.primaryCauses.trim().slice(0, 300) : existing.primaryCauses,
      accessConstraint: typeof body.accessConstraint === 'string' && body.accessConstraint.trim() ? body.accessConstraint.trim().slice(0, 200) : existing.accessConstraint,
      hydrantStatus: typeof body.hydrantStatus === 'string' && body.hydrantStatus.trim() ? body.hydrantStatus.trim().slice(0, 200) : existing.hydrantStatus,
      lat: nextLat,
      lng: nextLng
    };
  } else {
    updated = {
      ...existing,
      areaName: typeof body.areaName === 'string' && body.areaName.trim() ? body.areaName.trim().slice(0, 140) : existing.areaName,
      purok: nextPurok,
      hazardSubtype: typeof body.hazardSubtype === 'string' && body.hazardSubtype.trim() ? body.hazardSubtype.trim().slice(0, 100) : existing.hazardSubtype,
      riskLevel: nextRiskLevel,
      exposedHouseholds: body.exposedHouseholds !== undefined && !Number.isNaN(Number(body.exposedHouseholds)) ? Math.max(0, Math.round(Number(body.exposedHouseholds))) : existing.exposedHouseholds,
      description: typeof body.description === 'string' && body.description.trim() ? body.description.trim().slice(0, 300) : existing.description,
      contingencyAction: typeof body.contingencyAction === 'string' && body.contingencyAction.trim() ? body.contingencyAction.trim().slice(0, 300) : existing.contingencyAction,
      lat: nextLat,
      lng: nextLng
    };
  }

  db.hazardSummaries[category][idx] = updated;
  saveDatabase(db);
  broadcastSystemUpdate('hazardSummaries', 'update', { category, id });
  res.json({ success: true, item: updated, hazardSummaries: db.hazardSummaries });
});

// ----------------------------------------------------
// ADMIN IMPORT & EXPORT RECORDS
// ----------------------------------------------------
function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '';
  const str = Array.isArray(val) ? val.join('; ') : typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(rows: any[]): string {
  if (!rows || rows.length === 0) return '';
  const headers: string[] = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row || {}).forEach(k => set.add(k));
      return set;
    }, new Set<string>())
  );
  const headerLine = headers.map(escapeCsvCell).join(',');
  const lines = rows.map(row => headers.map(h => escapeCsvCell((row || {})[h])).join(','));
  return [headerLine, ...lines].join('\n');
}

app.get('/api/admin/export-records', authenticateJWT, requireRole('admin'), (req, res) => {
  const type = String(req.query.type || 'all');
  const format = String(req.query.format || 'json').toLowerCase();
  const programId = String(req.query.programId || '').trim();
  const targetProgram = programId ? db.programs.find(p => p.id === programId) : undefined;

  const rawVictims = (db.disasterVictims || []).filter((v: any) =>
    !programId || (Array.isArray(v.enrolledProgramIds) && v.enrolledProgramIds.includes(programId))
  );

  const enrichedVictims = rawVictims.map((v: any) => {
    const resident = db.users.find(
      u => u.role === 'resident' && (u.id === v.residentId || u.name.toLowerCase() === String(v.fullName || '').toLowerCase())
    ) as Record<string, any> | undefined;

    return {
      victimCode: v.victimCode,
      residentId: resident?.id || v.residentId || '',
      residentIdNumber: resident?.residentIdNumber || '',
      fullName: resident?.name || v.fullName,
      email: resident?.email || '',
      contactNumber: resident?.contactNumber || v.contactNumber || 'N/A',
      purok: resident?.purok || v.purok || '',
      address: resident?.address || v.address || '',
      householdSize: resident?.familyMembersCount ?? v.householdSize ?? 1,
      householdIncome: resident?.householdIncome || v.householdIncome || '',
      vulnerabilityTags: v.vulnerabilityTags || [],
      disasterType: v.disasterType,
      damageLevel: v.damageLevel,
      incidentDate: v.incidentDate,
      selectionStatus: v.selectionStatus,
      ...(targetProgram
        ? { programId: targetProgram.id, programTitle: targetProgram.title }
        : { enrolledProgramIds: v.enrolledProgramIds || [], enrolledProgramTitles: v.enrolledProgramTitles || [] }),
      recordedAt: v.recordedAt
    };
  });

  const datasets: Record<string, any[]> = {
    victims: enrichedVictims,
    hazards: db.hazardZones || [],
    applications: db.applications || [],
    programs: db.programs || [],
    announcements: db.announcements || []
  };

  const fileSlug = programId && targetProgram
    ? `victims_${targetProgram.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28)}`
    : type;

  if (format === 'csv' && type !== 'all') {
    const rows = datasets[type] || [];
    const csv = rowsToCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bugo_${fileSlug}_${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(csv);
  }

  const payload = type === 'all'
    ? {
        exportedAt: new Date().toISOString(),
        system: 'Barangay Bugo Citizen & Disaster Records',
        ...datasets
      }
    : {
        exportedAt: new Date().toISOString(),
        type,
        ...(targetProgram ? { programId: targetProgram.id, programTitle: targetProgram.title } : {}),
        records: datasets[type] || []
      };

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="bugo_${fileSlug}_${new Date().toISOString().slice(0, 10)}.json"`);
  res.send(JSON.stringify(payload, null, 2));
});

app.post('/api/admin/import-records', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { recordType, mode, records, programId } = req.body || {};
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid records provided for import.' });
  }
  const replaceMode = mode === 'replace';
  let importedCount = 0;

  if (recordType === 'victims') {
    if (!Array.isArray(db.disasterVictims)) db.disasterVictims = [];
    const scopedProgramId = programId ? String(programId).trim() : '';
    const scopedProgram = scopedProgramId ? db.programs.find(p => p.id === scopedProgramId) : undefined;

    const normalized = records
      .filter((r: any) => r && String(r.fullName || r.name || r.residentId || r.email || '').trim())
      .map((r: any, idx: number) => {
        const lookupName = String(r.fullName || r.name || '').trim().toLowerCase();
        const lookupEmail = String(r.email || '').trim().toLowerCase();
        const lookupId = String(r.residentId || '').trim();
        const lookupIdNum = String(r.residentIdNumber || '').trim().toLowerCase();

        const matchedResident = db.users.find(u =>
          u.role === 'resident' && (
            (lookupId && u.id === lookupId) ||
            (lookupIdNum && String(u.residentIdNumber || '').toLowerCase() === lookupIdNum) ||
            (lookupEmail && u.email.toLowerCase() === lookupEmail) ||
            (lookupName && u.name.toLowerCase() === lookupName)
          )
        ) as Record<string, any> | undefined;

        const damageLevel = (['Minor', 'Moderate', 'Severe', 'Total Loss'].includes(r.damageLevel) ? r.damageLevel : 'Moderate') as any;
        const status = (['Waitlisted', 'Selected', 'Distributed'].includes(r.selectionStatus) ? r.selectionStatus : 'Waitlisted') as any;
        const householdIncome = String(matchedResident?.householdIncome || r.householdIncome || '₱8,500.00');

        const derivedTags: string[] = [];
        if (matchedResident) {
          if (matchedResident.isSenior || (matchedResident.age && matchedResident.age >= 60)) derivedTags.push('Senior');
          if (matchedResident.isPwd) derivedTags.push('PWD');
          if (matchedResident.isSoloParent) derivedTags.push('Solo Parent');
          if (matchedResident.age !== undefined && matchedResident.age < 18) derivedTags.push('Minor');
        }

        const vulnerabilityTags = Array.isArray(r.vulnerabilityTags) && r.vulnerabilityTags.length > 0
          ? r.vulnerabilityTags
          : typeof r.vulnerabilityTags === 'string' && r.vulnerabilityTags.trim()
            ? r.vulnerabilityTags.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean)
            : derivedTags;

        const householdSize = Math.max(1, Number(matchedResident?.familyMembersCount ?? r.householdSize) || 1);
        const scopedDisasterDefault =
          scopedProgram && SPECIFIC_DISASTER_CATEGORY_SET.has(String(scopedProgram.category || '').trim().toLowerCase())
            ? scopedProgram.category
            : 'Flood';
        const itemDisasterType = String(r.disasterType || scopedDisasterDefault).trim();

        const parsedProgramIds: string[] = Array.isArray(r.enrolledProgramIds)
          ? r.enrolledProgramIds.map((pid: any) => String(pid))
          : typeof r.enrolledProgramIds === 'string' && r.enrolledProgramIds.trim()
            ? r.enrolledProgramIds.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean)
            : [];
        if (
          scopedProgramId &&
          !parsedProgramIds.includes(scopedProgramId) &&
          doesVictimQualifyForDisasterProgram(itemDisasterType, scopedProgram)
        ) {
          parsedProgramIds.push(scopedProgramId);
        }

        const filteredProgramIds = Array.from(new Set(parsedProgramIds)).filter(pid => {
          const prog = (db.programs || []).find((p: any) => p.id === pid);
          return !prog || doesVictimQualifyForDisasterProgram(itemDisasterType, prog);
        });

        const enrolledProgramTitles = filteredProgramIds.map((id: string) => db.programs.find(p => p.id === id)?.title || (id === scopedProgramId && scopedProgram?.title) || id);

        return {
          id: String(r.id || `dv-imp-${Date.now()}-${idx}`),
          residentId: matchedResident?.id || (r.residentId ? String(r.residentId) : undefined),
          victimCode: String(r.victimCode || `DV-2026-${Math.floor(1000 + Math.random() * 9000)}`),
          fullName: String(matchedResident?.name || r.fullName || r.name).trim(),
          age: matchedResident?.age ?? (r.age ? Number(r.age) : undefined),
          contactNumber: String(matchedResident?.contactNumber || r.contactNumber || 'N/A'),
          purok: stripZoneName(matchedResident?.purok || r.purok) || 'Zone 1',
          address: String(matchedResident?.address || r.address || 'Barangay Bugo, CDO'),
          disasterType: itemDisasterType,
          incidentDate: String(r.incidentDate || new Date().toISOString().split('T')[0]),
          damageLevel,
          householdSize,
          householdIncome,
          vulnerabilityTags,
          enrolledProgramIds: filteredProgramIds,
          enrolledProgramTitles,
          selectionStatus: status,
          recordedAt: String(r.recordedAt || new Date().toISOString()),
          notes: r.notes ? String(r.notes) : ''
        };
      })
      // Deduplicate incoming rows by resident when scoped to a program (or resident + disaster globally)
      .filter((item: any, idx: number, arr: any[]) => {
        const resKey = getVictimResidentKey(item);
        const dupKey = scopedProgramId ? resKey : `${resKey}::${String(item.disasterType || '').toLowerCase()}`;
        return arr.findIndex(other => {
          const oKey = getVictimResidentKey(other);
          return (scopedProgramId ? oKey : `${oKey}::${String(other.disasterType || '').toLowerCase()}`) === dupKey;
        }) === idx;
      });

    if (replaceMode && scopedProgramId) {
      // Remove scopedProgramId from existing victims, keeping records belonging to other programs
      db.disasterVictims = (db.disasterVictims as any[])
        .map(v => {
          const hadProgram = Array.isArray(v.enrolledProgramIds) && v.enrolledProgramIds.includes(scopedProgramId);
          if (!hadProgram) return v;
          const nextIds = v.enrolledProgramIds.filter((pid: string) => pid !== scopedProgramId);
          const nextTitles = scopedProgram
            ? (v.enrolledProgramTitles || []).filter((t: string) => t !== scopedProgram.title)
            : (v.enrolledProgramTitles || []);
          return nextIds.length > 0 ? { ...v, enrolledProgramIds: nextIds, enrolledProgramTitles: nextTitles } : null;
        })
        .filter(Boolean);
      db.disasterVictims = [...normalized, ...db.disasterVictims];
    } else if (replaceMode) {
      db.disasterVictims = normalized;
    } else {
      const existingByCode = new Map((db.disasterVictims as any[]).map(v => [v.victimCode, v]));
      const toAdd: any[] = [];
      for (const item of normalized) {
        const itemResKey = getVictimResidentKey(item);
        const existingSameResidentInProgram = scopedProgramId
          ? (db.disasterVictims as any[]).find(
              v => getVictimResidentKey(v) === itemResKey && Array.isArray(v.enrolledProgramIds) && v.enrolledProgramIds.includes(scopedProgramId)
            )
          : undefined;
        if (existingSameResidentInProgram) {
          continue;
        }
        const existing =
          existingByCode.get(item.victimCode) ||
          (db.disasterVictims as any[]).find(
            v =>
              v.id === item.id ||
              (getVictimResidentKey(v) === itemResKey &&
                String(v.disasterType || '').trim().toLowerCase() === String(item.disasterType || '').trim().toLowerCase())
          );
        if (existing && scopedProgramId && doesVictimQualifyForDisasterProgram(existing.disasterType, scopedProgram)) {
          if (!existing.enrolledProgramIds.includes(scopedProgramId)) {
            existing.enrolledProgramIds.push(scopedProgramId);
          }
          if (scopedProgram && !existing.enrolledProgramTitles.includes(scopedProgram.title)) {
            existing.enrolledProgramTitles.push(scopedProgram.title);
          }
        } else if (!existing) {
          toAdd.push(item);
        }
      }
      db.disasterVictims = [...toAdd, ...db.disasterVictims];
    }
    importedCount = normalized.length;
  } else if (recordType === 'hazards') {
    if (!Array.isArray(db.hazardZones)) db.hazardZones = [];
    const normalized = records
      .filter((r: any) => r && String(r.name || '').trim() && !Number.isNaN(Number(r.lat)) && !Number.isNaN(Number(r.lng)))
      .map((r: any, idx: number) => ({
        id: String(r.id || `hz-imp-${Date.now()}-${idx}`),
        name: String(r.name).trim(),
        disasterType: (['Earthquake', 'Flood', 'Landslide', 'Fire', 'Other'].includes(r.disasterType) ? r.disasterType : 'Other'),
        riskLevel: (['Low', 'Moderate', 'High'].includes(r.riskLevel) ? r.riskLevel : 'Moderate'),
        purok: stripZoneName(r.purok) || 'Zone 1',
        lat: Number(r.lat),
        lng: Number(r.lng),
        radiusMeters: Math.max(50, Math.min(2000, Number(r.radiusMeters) || 180)),
        description: String(r.description || 'Imported hazard zone'),
        affectedHouseholdsEst: r.affectedHouseholdsEst ? Number(r.affectedHouseholdsEst) : undefined,
        updatedAt: new Date().toISOString().split('T')[0]
      }));

    if (replaceMode) {
      db.hazardZones = normalized;
    } else {
      const existingIds = new Set(db.hazardZones.map(z => z.id));
      const newOnes = normalized.filter(z => !existingIds.has(z.id));
      db.hazardZones = [...newOnes, ...db.hazardZones];
    }
    importedCount = normalized.length;
  } else if (recordType === 'programs') {
    const normalized = records
      .filter((r: any) => r && String(r.title || '').trim())
      .map((r: any, idx: number) => ({
        id: String(r.id || `prog-imp-${Date.now()}-${idx}`),
        title: String(r.title).trim(),
        category: String(r.category || 'Community and Emergency Services'),
        tagline: String(r.tagline || r.description || 'Barangay Assistance Program'),
        description: String(r.description || 'Imported Barangay assistance service'),
        imageUrl: String(r.imageUrl || '/assets/services/real_barangay_hall_1788172230992.jpg'),
        status: (['Active', 'Open', 'Closed'].includes(r.status) ? r.status : 'Active'),
        badgeText: String(r.badgeText || 'Imported Program'),
        deadline: String(r.deadline || 'Year-Round Service'),
        targetAudience: String(r.targetAudience || 'All Bugo Residents'),
        processingTime: String(r.processingTime || '1 - 3 Business Days'),
        requirements: Array.isArray(r.requirements) ? r.requirements : ['Valid Government ID'],
        eligibilityCriteria: Array.isArray(r.eligibilityCriteria) ? r.eligibilityCriteria : ['Resident of Barangay Bugo'],
        maxBenefitAmount: String(r.maxBenefitAmount || 'Barangay Assistance')
      }));

    const existingIds = new Set(db.programs.map(p => p.id));
    const newOnes = normalized.filter(p => !existingIds.has(p.id));
    db.programs = sortProgramsAlphabetically(replaceMode ? normalized : [...newOnes, ...db.programs]);
    importedCount = normalized.length;
  } else {
    return res.status(400).json({ success: false, message: 'Unsupported recordType for import.' });
  }

  db.activityLogs.unshift({
    id: `act-${Date.now()}`,
    residentName: `Imported ${importedCount} ${recordType}`,
    residentIdNumber: 'ADMIN-IMPORT',
    purok: 'Barangay Bugo',
    actionType: 'Status Updated',
    locationOrService: 'Records Import & Export',
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
    officerInCharge: req.authUser?.email || 'Barangay Administrator',
    status: 'Completed',
    details: `Imported ${importedCount} ${recordType} records (${replaceMode ? 'replace' : 'merge'} mode).`
  });

  saveDatabase(db);
  broadcastSystemUpdate(recordType, 'import', { importedCount });
  res.json({
    success: true,
    importedCount,
    recordType,
    disasterVictims: db.disasterVictims,
    hazardZones: db.hazardZones,
    programs: db.programs
  });
});

// Global API Error Handler (sanitized in production)
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  logServerError('express_error', err, { method: req.method, path: req.path });
  const status = err?.status || 500;
  res.status(status).json({
    success: false,
    message: IS_PROD ? 'Internal server error occurred.' : (err?.message || 'Internal server error.'),
  });
});

// ----------------------------------------------------
// 7. Persistence Hydration, Vite Integration & Server Startup
// ----------------------------------------------------
async function startServer() {
  if (isMySqlConfigured()) {
    try {
      const mysqlDb = await loadDatabaseFromMySQL(initDefaultDatabase().census);
      if (mysqlDb && mysqlDb.users.length > 0 && mysqlDb.programs.length > 0) {
        db = {
          ...mysqlDb,
          disasterVictims: db.disasterVictims || [],
          hazardZones: db.hazardZones || [...DEFAULT_BUGO_HAZARD_ZONES],
          hazardSummaries: db.hazardSummaries || createDefaultHazardSummaries()
        };
        if (ensureRecoveredAccounts(db)) {
          const kylene = db.users.find(u => u.email.toLowerCase() === 'polinar.kylenekae@gmail.com');
          if (kylene) persistAsync(syncUserToMySQL(kylene), 'user.recover');
        }
        activePersistenceMode = 'mysql-prisma';
        logInfo('database_initialized', {
          mode: 'mysql-prisma',
          users: db.users.length,
          programs: db.programs.length,
          applications: db.applications.length,
        });
      } else {
        activePersistenceMode = 'mysql-prisma';
        logInfo('database_mysql_empty_seed_recommended', {
          hint: 'Run "npx prisma migrate deploy && npm run prisma:seed" to populate MySQL tables.',
        });
      }
    } catch (err) {
      logServerError('mysql_startup_fallback', err);
      activePersistenceMode = 'json-local';
    }
  } else {
    activePersistenceMode = 'json-local';
    logInfo('database_initialized', {
      mode: 'json-local',
      note: 'DATABASE_URL not set; running with data/db.json persistence.',
    });
  }

  app.get('/favicon.ico', (_req, res) => {
    const svgPath = path.resolve(process.cwd(), 'public', 'favicon.svg');
    if (fs.existsSync(svgPath)) {
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.sendFile(svgPath);
    }
    res.status(204).end();
  });

  app.use('/sample-documents', express.static(path.resolve(process.cwd(), 'sample-documents')));
  app.use('/pdf-standard-fonts', express.static(path.resolve(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts')));

  app.all('/api/*', (_req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found.' });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null
      },
      appType: 'spa'
    });
    if (vite.ws) {
      vite.ws.on('error', () => {
        // Suppress websocket HMR errors in iframe dev environment
      });
    }
    if (process.env.DISABLE_HMR === 'true') {
      app.get('/@vite/client', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(`const sheetsMap = new Map();
if (typeof document !== "undefined") {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
const cspNonce = typeof document !== "undefined" ? document.querySelector("meta[property=csp-nonce]")?.nonce : void 0;
let lastInsertedStyle;
function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (cspNonce) {
      style.setAttribute("nonce", cspNonce);
    }
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => {
        lastInsertedStyle = void 0;
      }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
    sheetsMap.delete(id);
  }
}
function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {}
  };
}
function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") {
    return url;
  }
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return pathname + "?" + queryToInject + (search ? "&" + search.slice(1) : "") + (hash || "");
}
class ErrorOverlay extends HTMLElement {
  close() {
    this.remove();
  }
}
export { ErrorOverlay, createHotContext, injectQuery, removeStyle, updateStyle };
`);
      });
    }
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    logInfo('server_started', {
      url: `http://0.0.0.0:${PORT}`,
      environment: NODE_ENV,
      persistenceMode: activePersistenceMode,
    });
  });

  server.on('error', (err: any) => {
    logServerError('server_listen_error', err);
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${PORT} is busy, awaiting available socket.`);
    }
  });

  const shutdown = async () => {
    try {
      await disconnectPrisma();
      server.close(() => {
        process.exit(0);
      });
    } catch {
      process.exit(0);
    }
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch(err => {
  logServerError('startServer_fatal', err);
  process.exit(1);
});
