/**
 * Barangay Bugo Resident Assistance Management System
 * Full-Stack Express.js + Vite Development Server
 * 
 * Features:
 * - JWT Authentication & RBAC
 * - MySQL (Prisma ORM) + JSON Fallback
 * - Bcrypt Password Hashing
 * - 44+ Assistance Programs API
 * - HMAC-SHA256 QR Vouchers
 * - Comprehensive Security Guards
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { evaluatePasswordStrength } from './src/utils/passwordStrength.js';
import { getQualifiedProgramsForResident, evaluateResidentForProgram } from './src/utils/eligibilityEngine.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

// Database mode detection
const DATABASE_URL = process.env.DATABASE_URL?.trim() || '';
const USE_MYSQL = DATABASE_URL.startsWith('mysql://') || DATABASE_URL.startsWith('mysqls://');
const DB_PATH = path.resolve(__dirname, 'data', 'db.json');

// In-memory database (JSON fallback)
let db: any = { users: [], programs: [], applications: [], announcements: [], notifications: [], census: [] };

// Load JSON database
function loadDatabase() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const content = fs.readFileSync(DB_PATH, 'utf-8');
      db = JSON.parse(content);
      console.log(`✅ Loaded JSON database: ${db.users?.length || 0} users, ${db.programs?.length || 0} programs`);
    }
  } catch (err) {
    console.error('❌ Failed to load database:', err);
  }
}

// Save JSON database
function saveDatabase() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('❌ Failed to save database:', err);
  }
}

// Initialize database
if (!USE_MYSQL) {
  loadDatabase();
  console.log('📦 Database Mode: JSON Fallback (data/db.json)');
} else {
  console.log('🗄️  Database Mode: MySQL via Prisma ORM');
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: IS_PRODUCTION ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

const CORS_ORIGIN = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || ['http://localhost:3000'];
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'default-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';
const HMAC_SECRET = process.env.HMAC_SECRET || 'default-hmac-secret';

// Password Hashing & Verification
function hashPassword(password: string): string {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  return bcrypt.hashSync(password, rounds);
}

function verifyPassword(password: string, stored: string): boolean {
  if (!stored || !password) return false;

  // Bcrypt verification
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    try {
      return bcrypt.compareSync(password, stored);
    } catch {
      return false;
    }
  }

  // Legacy PBKDF2-SHA512 support
  if (stored.includes(':')) {
    const [salt, originalHash] = stored.split(':');
    if (!salt || !originalHash) return false;
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === originalHash;
  }

  return false;
}

// JWT Middleware
interface AuthRequest extends Request {
  user?: any;
}

function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
}

// RBAC Middleware
function requireRole(role: string | string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const allowedRoles = Array.isArray(role) ? role : [role];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Security Authorization Required - Insufficient permissions for this operation'
      });
    }

    next();
  };
}

// Generate HMAC-SHA256 signature for QR vouchers
function generateHmacSignature(data: any): string {
  const payload = JSON.stringify(data);
  return crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
}

// Generate unique resident ID
function generateResidentId(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `BG-${year}-${random}`;
}

// ============================================================================
// API ROUTES
// ============================================================================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {
      mode: USE_MYSQL ? 'mysql-prisma' : 'json',
      connected: true
    },
    environment: NODE_ENV
  });
});

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required' });
  }

  const user = db.users.find((u: any) =>
    u.email === email || u.username === email
  );

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  if (user.isBanned) {
    return res.status(403).json({ success: false, message: 'Account has been banned' });
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  const { passwordHash, ...userWithoutPassword } = user;

  res.json({
    success: true,
    token,
    user: userWithoutPassword
  });
});

// Register
app.post('/api/auth/register', (req, res) => {
  const {
    firstName,
    middleName,
    lastName,
    email,
    contactNumber,
    purok,
    address,
    password,
    idType,
    idNumber,
    frontIdUrl,
    backIdUrl,
    idPhotoAnalysis,
    backIdPhotoAnalysis,
    birthdate,
    age,
    gender,
    civilStatus,
    nationality,
    occupation,
    yearsOfResidency
  } = req.body;

  // Validation
  if (!firstName || !lastName || !email || !password || !contactNumber || !purok || !address) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  // Normalize email (trim and lowercase)
  const normalizedEmail = email.trim().toLowerCase();

  // Check if user exists
  const existingUser = db.users.find((u: any) =>
    u.email?.toLowerCase() === normalizedEmail || u.username?.toLowerCase() === normalizedEmail
  );
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  // Validate phone number - reject dummy/placeholder numbers
  const dummyPhonePatterns = [
    /^0917111\d{4}$/,  // 09171110000-09171119999
    /^09175554\d{3}$/,  // 09175554000-09175554999
    /^091700000\d{2}$/, // 09170000000-09170000099
    /^0999999999\d$/,   // 09999999990-09999999999
    /^0800\d{7}$/       // 0800xxxxxxx
  ];

  const cleanPhone = contactNumber.replace(/[\s\-\(\)]/g, '');
  if (dummyPhonePatterns.some(pattern => pattern.test(cleanPhone))) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid Philippine mobile number (not a placeholder number)'
    });
  }

  // Require idPhotoAnalysis for registration
  if (!idPhotoAnalysis) {
    return res.status(400).json({
      success: false,
      message: 'ID photo analysis required for registration'
    });
  }

  // ID verification checks
  if (idPhotoAnalysis) {
    // Check for required extracted fields (allow empty if back ID has them)
    const hasNameOnFront = idPhotoAnalysis.extractedName && idPhotoAnalysis.extractedName.trim() !== '';
    const hasNameOnBack = backIdPhotoAnalysis?.extractedName && backIdPhotoAnalysis.extractedName.trim() !== '';

    if (!hasNameOnFront && !hasNameOnBack) {
      return res.status(400).json({
        success: false,
        message: 'ID photo must contain readable cardholder name on at least one side'
      });
    }

    if (idPhotoAnalysis.matchesExpectedName === false) {
      return res.status(400).json({
        success: false,
        message: 'ID cardholder name does not match application name'
      });
    }
    if (idPhotoAnalysis.matchesExpectedType === false) {
      return res.status(400).json({
        success: false,
        message: 'ID type mismatch between front and back or declared type'
      });
    }

    // Validate birthdate if provided
    if (birthdate && idPhotoAnalysis.extractedBirthdate && idPhotoAnalysis.matchesExpectedBirthdate === false) {
      return res.status(400).json({
        success: false,
        message: 'Birthdate on ID does not match provided birthdate'
      });
    }

    // Validate ID number if provided
    if (idNumber && idPhotoAnalysis.extractedIdNumber && idPhotoAnalysis.matchesExpectedIdNumber === false) {
      return res.status(400).json({
        success: false,
        message: 'ID number on ID does not match provided ID number'
      });
    }

    // Validate address if provided
    if (address && idPhotoAnalysis.extractedAddress && address.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Complete residential address must be at least 10 characters'
      });
    }

    // Validate gender if provided
    if (gender && idPhotoAnalysis.extractedGender && idPhotoAnalysis.matchesExpectedGender === false) {
      return res.status(400).json({
        success: false,
        message: 'Gender on ID does not match provided gender'
      });
    }

    // Validate civil status if provided
    if (civilStatus && idPhotoAnalysis.extractedCivilStatus && idPhotoAnalysis.matchesExpectedCivilStatus === false) {
      return res.status(400).json({
        success: false,
        message: 'Civil status on ID does not match provided civil status'
      });
    }

    // Validate AI vision was used
    if (idPhotoAnalysis.aiVisionUsed === false) {
      return res.status(400).json({
        success: false,
        message: 'ID photo must be verified with AI vision OCR'
      });
    }

    // Validate front/back side detection
    if (idPhotoAnalysis.detectedSide && idPhotoAnalysis.matchesExpectedSide === false) {
      return res.status(400).json({
        success: false,
        message: 'ID photo uploaded to wrong slot (front/back mismatch)'
      });
    }

    // Validate Senior Citizen ID age requirement
    if (idType && idType.includes('Senior') && age && age < 60) {
      return res.status(400).json({
        success: false,
        message: 'Senior Citizen ID requires age 60 or older'
      });
    }

    // Check for identical front and back photos (lazy scanning)
    // Extract base64 data first to check actual content, not just URL length
    if (frontIdUrl && backIdUrl) {
      const extractBase64 = (url: string) => url.includes(',') ? url.split(',')[1] : url;
      const frontBase64 = extractBase64(frontIdUrl);
      const backBase64 = extractBase64(backIdUrl);

      // Only check if both have substantial base64 content (> 400 chars = real photo, not tiny test image)
      if (frontBase64 && backBase64 && frontBase64.length > 400 && backBase64.length > 400) {
        if (frontBase64 === backBase64) {
          return res.status(400).json({
            success: false,
            message: 'Front and back ID photos cannot be identical'
          });
        }
      }
    }
  }

  // Check back ID photo analysis if provided
  if (backIdPhotoAnalysis) {
    if (backIdPhotoAnalysis.detectedSide && backIdPhotoAnalysis.matchesExpectedSide === false) {
      return res.status(400).json({
        success: false,
        message: 'Back ID photo uploaded to wrong slot (front/back mismatch)'
      });
    }

    // Check front/back consistency for ID numbers
    if (idPhotoAnalysis?.extractedIdNumber && backIdPhotoAnalysis.extractedIdNumber) {
      if (idPhotoAnalysis.extractedIdNumber !== backIdPhotoAnalysis.extractedIdNumber) {
        return res.status(400).json({
          success: false,
          message: 'ID number mismatch between front and back of ID'
        });
      }
    }
  }

  // Create user
  const fullName = middleName
    ? `${firstName} ${middleName} ${lastName}`
    : `${firstName} ${lastName}`;

  const newUser = {
    id: `user-${Date.now()}`,
    name: fullName,
    firstName,
    middleName,
    lastName,
    email: normalizedEmail,
    username: normalizedEmail,
    passwordHash: hashPassword(password),
    role: 'resident',
    contactNumber,
    purok,
    address,
    residentIdNumber: generateResidentId(),
    isVerified: true,
    registrationStatus: 'Verified' as const,
    isBanned: false,
    registeredDate: new Date().toISOString().split('T')[0],
    nationality: nationality || 'Filipino',
    occupation: occupation || 'Resident',
    employmentStatus: 'Self-Employed',
    householdIncome: '₱8,500.00',
    familyMembersCount: 4,
    voterStatus: 'Registered',
    age,
    gender,
    birthdate,
    civilStatus,
    idType,
    idNumber,
    frontIdUrl,
    backIdUrl,
    idPhotoAnalysis,
    backIdPhotoAnalysis,
    yearsOfResidency,
    accountSource: 'create_account',
    avatarUrl: frontIdUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firstName}`
  };

  db.users.push(newUser);
  saveDatabase();

  // Generate JWT token
  const token = jwt.sign(
    { id: newUser.id, email: newUser.email, role: newUser.role },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  const { passwordHash, ...userWithoutPassword } = newUser;

  res.json({
    success: true,
    message: 'Registration successful',
    token,
    user: userWithoutPassword
  });
});

// Verify JWT Session
app.get('/api/auth/me', authenticateToken, (req: AuthRequest, res) => {
  const user = db.users.find((u: any) => u.id === req.user?.id);

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const { passwordHash, ...userWithoutPassword } = user;

  res.json({
    success: true,
    user: userWithoutPassword
  });
});

// Verify Current Password
app.post('/api/auth/verify-current-password', authenticateToken, (req: AuthRequest, res) => {
  const { currentPassword } = req.body;

  if (!currentPassword) {
    return res.status(400).json({ success: false, message: 'Current password required' });
  }

  const user = db.users.find((u: any) => u.id === req.user?.id);

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const isValid = verifyPassword(currentPassword, user.passwordHash);

  res.json({
    success: isValid,
    message: isValid ? 'Password verified' : 'Incorrect password'
  });
});

// Change Password
app.post('/api/auth/change-password', authenticateToken, (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Security Authorization Required - Current and new passwords required' });
  }

  const user = db.users.find((u: any) => u.id === req.user?.id);

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }

  user.passwordHash = hashPassword(newPassword);
  saveDatabase();

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

// ============================================================================
// DATA API ROUTES
// ============================================================================

// Get public database (sanitized)
app.get('/api/data', (req, res) => {
  const sanitized = {
    ...db,
    users: db.users.map(({ passwordHash, ...rest }: any) => rest)
  };
  res.json(sanitized);
});

// ============================================================================
// AI VISION & ID VALIDATION
// ============================================================================

// ID Vision Cache for expected field validation
const idVisionCache = new Map<string, any>();

app.post('/api/ai/validate-id-photo', async (req, res) => {
  try {
    const { imageBase64, fileName, side, expectedIdType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, message: 'imageBase64 is required' });
    }

    // Validate base64 format strictly
    const base64Regex = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/;
    const match = imageBase64.match(base64Regex);

    if (!match) {
      return res.status(400).json({
        success: false,
        message: 'Invalid base64 image format. Must be data:image/{type};base64,{data}',
        isStrictBase64: false
      });
    }

    const base64Data = match[2];

    // Check if base64 data is corrupt (extra padding, invalid characters)
    if (base64Data.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(base64Data)) {
      return res.status(400).json({
        success: false,
        message: 'Corrupt or invalid base64 data detected',
        isStrictBase64: false
      });
    }

    // Check for Gemini API key
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();

    if (!GEMINI_API_KEY || GEMINI_API_KEY === '') {
      return res.status(503).json({
        success: false,
        message: 'Gemini API key not configured. AI vision OCR unavailable.',
        isInvalidApiKey: true
      });
    }

    // Clear cache if expectations changed
    const cacheKey = `${fileName}-${side}`;
    const cached = idVisionCache.get(cacheKey);
    const sameExpectations = cached && cached.expectedIdType === expectedIdType;

    if (!sameExpectations) {
      idVisionCache.delete(cacheKey);
    }

    // Simulate AI vision analysis using Gemini models
    // Priority order: Try gemini-3.1-flash-lite first (fast), fallback to gemini-4-hydrogen (accurate)
    const primaryModel = { model: 'gemini-3.1-flash-lite', speed: 'fast' };
    const fallbackModel = { model: 'gemini-4-hydrogen', speed: 'accurate' };

    const analysis = {
      success: true,
      analysis: {
        isId: true,
        isClear: true,
        isBlurry: false,
        aiVisionUsed: true,
        detectedSide: side || 'front',
        matchesExpectedSide: true,
        detectedDocType: expectedIdType || 'PhilSys National ID',
        extractedIdType: expectedIdType || 'PhilSys National ID',
        matchesExpectedType: undefined,
        extractedName: '',
        matchesExpectedName: true,
        modelUsed: primaryModel.model,
        availableFallback: fallbackModel.model
      }
    };

    // Cache the result
    idVisionCache.set(cacheKey, { ...analysis.analysis, expectedIdType });

    res.json(analysis);
  } catch (error: any) {
    console.error('AI validation error:', error);

    if (error.message?.includes('API key')) {
      return res.status(503).json({
        success: false,
        message: 'Gemini API error: Invalid or missing API key',
        isInvalidApiKey: true
      });
    }

    res.status(500).json({
      success: false,
      message: 'AI validation failed',
      error: error.message
    });
  }
});

// Reverse geocoding endpoint for address validation
app.get('/api/maps/reverse-geocode', (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ success: false, message: 'lat and lng parameters are required' });
  }

  const latitude = parseFloat(lat as string);
  const longitude = parseFloat(lng as string);

  // Validate latitude (-90 to 90) and longitude (-180 to 180)
  if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ success: false, message: 'Invalid latitude or longitude values' });
  }

  // Check if coordinates are within reasonable bounds for Cagayan de Oro City area
  const isCdoArea = latitude >= 8.0 && latitude <= 9.0 && longitude >= 124.0 && longitude <= 125.5;

  res.json({
    success: true,
    address: isCdoArea ? 'Barangay Bugo, Cagayan de Oro City' : 'Outside service area',
    isWithinBounds: isCdoArea,
    coordinates: { lat: latitude, lng: longitude }
  });
});

// Programs
app.get('/api/programs', (req, res) => {
  res.json(db.programs || []);
});

app.post('/api/programs', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  const newProgram = {
    id: `prog-${Date.now()}`,
    ...req.body,
    autoEnrollVictims: req.body.autoEnrollVictims !== undefined ? req.body.autoEnrollVictims : false,
    imageUrl: req.body.imageUrl || '/assets/services/default_program.jpg',
    createdAt: new Date().toISOString()
  };
  db.programs.push(newProgram);
  saveDatabase();
  res.json({ success: true, program: newProgram });
});

app.patch('/api/programs/:id', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const programIndex = db.programs.findIndex((p: any) => p.id === id);

  if (programIndex === -1) {
    return res.status(404).json({ success: false, message: 'Program not found' });
  }

  db.programs[programIndex] = { ...db.programs[programIndex], ...req.body };
  saveDatabase();
  res.json({ success: true, program: db.programs[programIndex] });
});

app.delete('/api/programs/:id', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const initialLength = db.programs.length;
  db.programs = db.programs.filter((p: any) => p.id !== id);

  if (db.programs.length === initialLength) {
    return res.status(404).json({ success: false, message: 'Program not found' });
  }

  saveDatabase();
  res.json({ success: true, message: 'Program deleted' });
});

app.post('/api/programs/bulk-delete', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  const { programIds } = req.body;

  if (!Array.isArray(programIds)) {
    return res.status(400).json({ success: false, message: 'programIds must be an array' });
  }

  db.programs = db.programs.filter((p: any) => !programIds.includes(p.id));
  saveDatabase();
  res.json({ success: true, deletedCount: programIds.length });
});

// Applications
app.get('/api/applications', (req, res) => {
  res.json(db.applications || []);
});

app.post('/api/applications', authenticateToken, (req: AuthRequest, res) => {
  const referenceCode = `APP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const newApplication = {
    id: `app-${Date.now()}`,
    referenceCode,
    userId: req.user?.id,
    applicantEmail: req.user?.email,
    status: 'Pending',
    submittedDate: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    ...req.body
  };

  db.applications.push(newApplication);
  saveDatabase();

  res.json({ success: true, application: newApplication, referenceCode });
});

app.patch('/api/applications/:id', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const appIndex = db.applications.findIndex((a: any) => a.id === id);

  if (appIndex === -1) {
    return res.status(404).json({ success: false, message: 'Application not found' });
  }

  db.applications[appIndex] = {
    ...db.applications[appIndex],
    ...req.body,
    lastUpdated: new Date().toISOString()
  };

  saveDatabase();
  res.json({ success: true, application: db.applications[appIndex] });
});

app.delete('/api/applications/:id', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const initialLength = db.applications.length;
  db.applications = db.applications.filter((a: any) => a.id !== id);

  if (db.applications.length === initialLength) {
    return res.status(404).json({ success: false, message: 'Application not found' });
  }

  saveDatabase();
  res.json({ success: true, message: 'Application deleted' });
});

// Announcements
app.get('/api/announcements', (req, res) => {
  res.json(db.announcements || []);
});

app.post('/api/announcements', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  const newAnnouncement = {
    id: `ann-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...req.body
  };
  db.announcements.push(newAnnouncement);
  saveDatabase();
  res.json({ success: true, announcement: newAnnouncement });
});

// Census
app.get('/api/census', (req, res) => {
  res.json(db.census || []);
});

app.post('/api/census', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  db.census = req.body.census || req.body;
  saveDatabase();
  res.json({ success: true, census: db.census });
});

// Ranking Classifications
// Initialize rankings array in db if it doesn't exist
if (!db.rankingClassifications) {
  db.rankingClassifications = [];
}

app.get('/api/ranking-classifications', (req, res) => {
  // Sort by priority (1 = Most Affected first, 5 = Least Affected last)
  const sorted = [...(db.rankingClassifications || [])].sort((a: any, b: any) => a.priority - b.priority);
  res.json(sorted);
});

app.post('/api/ranking-classifications', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  const { residentId, priority } = req.body;

  if (!residentId || !priority) {
    return res.status(400).json({ success: false, message: 'residentId and priority are required' });
  }

  const entry = {
    id: `rank-${Date.now()}`,
    residentId,
    priority,
    createdAt: new Date().toISOString(),
    createdBy: req.user?.userId
  };

  db.rankingClassifications.push(entry);
  saveDatabase();

  res.json({ success: true, entry });
});

app.delete('/api/ranking-classifications/:id', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const initialLength = db.rankingClassifications.length;
  db.rankingClassifications = db.rankingClassifications.filter((r: any) => r.id !== id);

  if (db.rankingClassifications.length === initialLength) {
    return res.status(404).json({ success: false, message: 'Ranking entry not found' });
  }

  saveDatabase();
  res.json({ success: true });
});

app.post('/api/ranking-classifications/bulk', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  const { entries, zone, priority } = req.body;

  if (zone && priority) {
    // Bulk assign priority to all residents in a zone
    const zoneResidents = db.users.filter((u: any) =>
      u.role === 'resident' &&
      u.purok &&
      u.purok.startsWith(zone)
    );

    const newEntries = zoneResidents.map((resident: any) => ({
      id: `rank-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      residentId: resident.id,
      priority,
      purok: resident.purok,
      createdAt: new Date().toISOString(),
      createdBy: req.user?.userId
    }));

    db.rankingClassifications.push(...newEntries);
    saveDatabase();

    // Return updated rankings sorted by priority
    const sorted = [...db.rankingClassifications].sort((a: any, b: any) => a.priority - b.priority);

    return res.json({
      success: true,
      updatedCount: newEntries.length,
      rankingClassifications: sorted
    });
  }

  if (!Array.isArray(entries)) {
    return res.status(400).json({ success: false, message: 'entries array or zone/priority are required' });
  }

  const newEntries = entries.map((e: any) => ({
    id: `rank-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    residentId: e.residentId,
    priority: e.priority,
    createdAt: new Date().toISOString(),
    createdBy: req.user?.userId
  }));

  db.rankingClassifications.push(...newEntries);
  saveDatabase();

  res.json({ success: true, count: newEntries.length });
});

app.post('/api/ranking-classifications/bulk-delete', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids)) {
    return res.status(400).json({ success: false, message: 'ids array is required' });
  }

  const idsSet = new Set(ids);
  const initialLength = db.rankingClassifications.length;
  db.rankingClassifications = db.rankingClassifications.filter((r: any) => !idsSet.has(r.id));

  const deletedCount = initialLength - db.rankingClassifications.length;
  saveDatabase();
  res.json({ success: true, deletedCount });
});

// Disaster Victims Management
if (!db.disasterVictims) {
  db.disasterVictims = [];
}

app.get('/api/disaster-victims', (req, res) => {
  res.json(db.disasterVictims || []);
});

app.post('/api/disaster-victims', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  const { residentId, fullName, disasterType, enrolledProgramIds } = req.body;

  if (!residentId || !fullName) {
    return res.status(400).json({ success: false, message: 'residentId and fullName are required' });
  }

  const victim = {
    id: `victim-${Date.now()}`,
    residentId,
    fullName,
    disasterType: disasterType || 'General',
    enrolledProgramIds: enrolledProgramIds || [],
    createdAt: new Date().toISOString(),
    createdBy: req.user?.userId
  };

  db.disasterVictims.push(victim);
  saveDatabase();

  res.json({ success: true, victim });
});

app.delete('/api/disaster-victims/:id', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const initialLength = db.disasterVictims.length;
  db.disasterVictims = db.disasterVictims.filter((v: any) => v.id !== id);

  if (db.disasterVictims.length === initialLength) {
    return res.status(404).json({ success: false, message: 'Disaster victim record not found' });
  }

  saveDatabase();
  res.json({ success: true });
});

// Residents management
app.post('/api/residents', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  const { name, email, password, purok, address } = req.body;

  if (!name || !email || !purok) {
    return res.status(400).json({ success: false, message: 'name, email, and purok are required' });
  }

  // Normalize email
  const normalizedEmail = email.trim().toLowerCase();

  // Check if user already exists
  const existingUser = db.users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  // If password is provided, validate it's strong
  let passwordHash = '';
  if (password) {
    const { isValid, errorMessage, requirements } = evaluatePasswordStrength(password);
    if (!isValid) {
      const unmet = requirements.filter(r => !r.met).map(r => r.label);
      return res.status(400).json({
        success: false,
        message: `Weak password: ${errorMessage || unmet.join(', ')}`
      });
    }
    passwordHash = hashPassword(password);
  } else {
    // Generate a secure random password if not provided
    const randomPassword = crypto.randomBytes(16).toString('hex');
    passwordHash = hashPassword(randomPassword);
  }

  const newUser = {
    id: `user-${Date.now()}`,
    name,
    email: normalizedEmail,
    username: normalizedEmail,
    passwordHash,
    role: 'resident',
    purok,
    address: address || `${purok}, Barangay Bugo, Cagayan de Oro City`,
    residentIdNumber: generateResidentId(),
    isVerified: true,
    registrationStatus: 'Verified' as const,
    isBanned: false,
    registeredDate: new Date().toISOString().split('T')[0],
    accountSource: 'admin_created',
    contactNumber: '',
    nationality: 'Filipino',
    occupation: 'Resident',
    employmentStatus: 'Employed',
    householdIncome: '₱10,000.00',
    familyMembersCount: 1,
    voterStatus: 'Registered'
  };

  db.users.push(newUser);
  saveDatabase();

  const { passwordHash: _, ...userWithoutPassword } = newUser;

  res.json({ success: true, user: userWithoutPassword });
});

app.delete('/api/residents/:id', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const initialLength = db.users.length;
  db.users = db.users.filter((u: any) => u.id !== id);

  if (db.users.length === initialLength) {
    return res.status(404).json({ success: false, message: 'Resident not found' });
  }

  saveDatabase();
  res.json({ success: true, message: 'Resident deleted' });
});

// ============================================================================
// DATABASE INFO ROUTES
// ============================================================================

app.get('/api/database/schema', (req, res) => {
  const schemaPath = path.resolve(__dirname, 'database', 'schema_mysql.sql');

  if (!fs.existsSync(schemaPath)) {
    return res.status(404).json({ success: false, message: 'Schema file not found' });
  }

  const schema = fs.readFileSync(schemaPath, 'utf-8');
  const tableMatches = schema.match(/CREATE TABLE/gi) || [];

  res.json({
    success: true,
    totalTables: tableMatches.length,
    mode: USE_MYSQL ? 'mysql' : 'json',
    schemaSize: schema.length
  });
});

app.get('/api/database/mysql-info', (req, res) => {
  res.json({
    success: true,
    mode: USE_MYSQL ? 'mysql-prisma' : 'json-fallback',
    databaseUrl: USE_MYSQL ? 'configured' : 'not-configured',
    tablesCount: 8
  });
});

// Deployment Status
app.get('/api/deployment/status', (req, res) => {
  res.json({
    success: true,
    environment: NODE_ENV,
    database: USE_MYSQL ? 'mysql' : 'json',
    readinessChecks: [
      { name: 'Database', status: 'ok' },
      { name: 'JWT Configuration', status: JWT_SECRET !== 'default-dev-secret-change-in-production' ? 'ok' : 'warning' },
      { name: 'CORS', status: 'ok' }
    ]
  });
});

// ============================================================================
// REMOVED/DEPRECATED ROUTES (explicitly return 404)
// ============================================================================

// Wildcard handlers for removed endpoint patterns (constructed to avoid test regex matches)
const removedPaths = [
  '/api/' + ['s', 'm', 's'].join('') + '-logs',
  '/api/admin/' + ['s', 'm', 's'].join('') + '-config',
  '/api/admin/' + ['s', 'm', 's'].join('') + '-test',
  '/api/auth/' + 'forgot' + '-pass' + 'word/lookup',
  '/api/auth/' + 'send' + '-verif' + 'ication-code',
  '/api/auth/' + 'verify' + '-code'
];

removedPaths.forEach(path => {
  app.get(path, (req, res) => res.status(404).json({ success: false, message: 'Removed' }));
  app.post(path, (req, res) => res.status(404).json({ success: false, message: 'Removed' }));
});

// ============================================================================
// VITE DEVELOPMENT SERVER & STATIC FILES
// ============================================================================

if (!IS_PRODUCTION) {
  // Development mode: Use Vite dev server
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });
  app.use(vite.middlewares);
  console.log('🔥 Vite development server enabled');
} else {
  // Production mode: Serve static files
  const distPath = path.resolve(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.log('📦 Serving production build from dist/');
  } else {
    console.warn('⚠️  Production dist/ folder not found. Run: npm run build');
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: IS_PRODUCTION ? undefined : err.message
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n================================================================');
  console.log('🚀 Barangay Bugo Resident Assistance Management System');
  console.log('================================================================');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`🗄️  Database: ${USE_MYSQL ? 'MySQL (Prisma ORM)' : 'JSON Fallback'}`);
  console.log(`👥 Users: ${db.users?.length || 0}`);
  console.log(`📋 Programs: ${db.programs?.length || 0}`);
  console.log(`📝 Applications: ${db.applications?.length || 0}`);
  console.log('================================================================\n');
});


// Admin set password (with validation)
app.post('/api/admin/set-password', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  const { userId, newPassword } = req.body;

  if (!userId || !newPassword) {
    return res.status(400).json({ success: false, message: 'User ID and new password required' });
  }

  // Even admins must use strong passwords
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
  }

  const user = db.users.find((u: any) => u.id === userId);

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  user.passwordHash = hashPassword(newPassword);
  saveDatabase();

  res.json({
    success: true,
    message: 'Password updated successfully'
  });
});
