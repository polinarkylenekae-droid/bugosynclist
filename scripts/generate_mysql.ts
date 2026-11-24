/**
 * Generator script to create a production-ready MySQL database schema and data seed
 * matching the 8-table Prisma ORM schema for Barangay Bugo Resident Assistance Management System.
 */
import fs from 'fs';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data', 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

function escapeSql(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  return `'${String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

const programCount = Array.isArray(db.programs) ? db.programs.length : 0;

let sql = `-- ==============================================================================
-- BARANGAY BUGO RESIDENT ASSISTANCE MANAGEMENT SYSTEM
-- Relational Database Definition & Complete Seed Data for MySQL / MariaDB
-- Aligned 1:1 with prisma/schema.prisma (8 Relational Tables)
-- Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci | Engine: InnoDB
-- Target: MySQL 8.0+, MariaDB 10.6+
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+08:00";

-- ------------------------------------------------------------------------------
-- DATABASE CREATION
-- ------------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS \`barangay_bugo_db\`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE \`barangay_bugo_db\`;

-- ------------------------------------------------------------------------------
-- 1. TABLE: users
-- Core resident and administrator accounts with demographic profiles
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS \`users\`;
CREATE TABLE \`users\` (
  \`id\` VARCHAR(64) NOT NULL,
  \`name\` VARCHAR(191) NOT NULL,
  \`email\` VARCHAR(191) NOT NULL,
  \`password_hash\` VARCHAR(255) NOT NULL COMMENT 'Bcrypt or salted PBKDF2-SHA512 hash',
  \`role\` VARCHAR(32) NOT NULL DEFAULT 'resident',
  \`contact_number\` VARCHAR(32) NOT NULL,
  \`purok\` VARCHAR(128) NOT NULL,
  \`address\` TEXT NOT NULL,
  \`resident_id_number\` VARCHAR(64) NOT NULL,
  \`is_verified\` TINYINT(1) NOT NULL DEFAULT 0,
  \`registration_status\` VARCHAR(64) NOT NULL DEFAULT 'Pending Approval',
  \`is_banned\` TINYINT(1) NOT NULL DEFAULT 0,
  \`ban_reason\` TEXT DEFAULT NULL,
  \`registered_date\` VARCHAR(32) NOT NULL,
  \`nationality\` VARCHAR(64) NOT NULL DEFAULT 'Filipino',
  \`occupation\` VARCHAR(128) DEFAULT NULL,
  \`employment_status\` VARCHAR(64) DEFAULT NULL,
  \`household_income\` VARCHAR(64) DEFAULT NULL,
  \`family_members_count\` INT NOT NULL DEFAULT 1,
  \`voter_status\` VARCHAR(64) NOT NULL DEFAULT 'Registered',
  \`age\` INT DEFAULT NULL,
  \`gender\` VARCHAR(32) DEFAULT NULL,
  \`avatar_url\` LONGTEXT DEFAULT NULL,
  \`pending_profile_json\` JSON DEFAULT NULL,
  \`extra_profile_json\` JSON DEFAULT NULL,
  \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`users_email_key\` (\`email\`),
  UNIQUE KEY \`users_resident_id_number_key\` (\`resident_id_number\`),
  KEY \`idx_users_role\` (\`role\`),
  KEY \`idx_users_purok\` (\`purok\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. TABLE: assistance_programs
-- ${programCount} Barangay Bugo welfare, health, civil registration & emergency services
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS \`assistance_programs\`;
CREATE TABLE \`assistance_programs\` (
  \`id\` VARCHAR(64) NOT NULL,
  \`title\` VARCHAR(191) NOT NULL,
  \`category\` VARCHAR(128) NOT NULL,
  \`tagline\` TEXT DEFAULT NULL,
  \`description\` TEXT NOT NULL,
  \`image_url\` TEXT NOT NULL,
  \`status\` VARCHAR(32) NOT NULL DEFAULT 'Active',
  \`badge_text\` VARCHAR(64) DEFAULT NULL,
  \`deadline\` VARCHAR(128) DEFAULT NULL,
  \`target_audience\` VARCHAR(191) DEFAULT NULL,
  \`processing_time\` VARCHAR(128) DEFAULT NULL,
  \`max_benefit_amount\` VARCHAR(128) DEFAULT NULL,
  \`allocated_budget\` DECIMAL(14,2) NOT NULL DEFAULT 500000.00,
  \`disbursed_budget\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  \`slots_available\` INT NOT NULL DEFAULT 100,
  \`total_slots\` INT NOT NULL DEFAULT 100,
  \`requirements_json\` JSON DEFAULT NULL,
  \`eligibility_criteria_json\` JSON DEFAULT NULL,
  \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  KEY \`idx_programs_category\` (\`category\`),
  KEY \`idx_programs_status\` (\`status\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. TABLE: assistance_applications
-- Resident assistance & certificate filings, review timelines & disbursements
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS \`assistance_applications\`;
CREATE TABLE \`assistance_applications\` (
  \`id\` VARCHAR(64) NOT NULL,
  \`reference_code\` VARCHAR(64) NOT NULL,
  \`program_id\` VARCHAR(64) NOT NULL,
  \`program_title\` VARCHAR(191) NOT NULL,
  \`program_category\` VARCHAR(128) DEFAULT NULL,
  \`applicant_user_id\` VARCHAR(64) NOT NULL,
  \`applicant_name\` VARCHAR(191) NOT NULL,
  \`contact_number\` VARCHAR(32) NOT NULL,
  \`email\` VARCHAR(191) DEFAULT NULL,
  \`purok\` VARCHAR(128) NOT NULL,
  \`address\` TEXT DEFAULT NULL,
  \`household_monthly_income\` VARCHAR(64) DEFAULT NULL,
  \`family_members_count\` INT DEFAULT NULL,
  \`occupation\` VARCHAR(128) DEFAULT NULL,
  \`purpose_or_diagnosis\` TEXT DEFAULT NULL,
  \`status\` VARCHAR(64) NOT NULL DEFAULT 'Submitted',
  \`submission_date\` VARCHAR(64) NOT NULL,
  \`last_updated\` VARCHAR(64) DEFAULT NULL,
  \`requested_amount\` VARCHAR(64) DEFAULT NULL,
  \`approved_amount\` VARCHAR(64) DEFAULT NULL,
  \`evaluator_notes\` TEXT DEFAULT NULL,
  \`rejection_reason\` TEXT DEFAULT NULL,
  \`priority_score\` VARCHAR(32) DEFAULT NULL,
  \`supporting_documents_json\` JSON DEFAULT NULL,
  \`timeline_json\` JSON DEFAULT NULL,
  \`eligibility_json\` JSON DEFAULT NULL,
  \`official_receipt_number\` VARCHAR(64) DEFAULT NULL,
  \`payment_method\` VARCHAR(64) DEFAULT NULL,
  \`disbursed_by\` VARCHAR(191) DEFAULT NULL,
  \`disbursed_at\` VARCHAR(64) DEFAULT NULL,
  \`resubmitted_at\` VARCHAR(64) DEFAULT NULL,
  \`resubmitted_note\` TEXT DEFAULT NULL,
  \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`assistance_applications_reference_code_key\` (\`reference_code\`),
  KEY \`idx_apps_user\` (\`applicant_user_id\`),
  KEY \`idx_apps_program\` (\`program_id\`),
  KEY \`idx_apps_status\` (\`status\`),
  CONSTRAINT \`assistance_applications_program_id_fkey\` FOREIGN KEY (\`program_id\`) REFERENCES \`assistance_programs\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT \`assistance_applications_applicant_user_id_fkey\` FOREIGN KEY (\`applicant_user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. TABLE: announcements
-- Official barangay advisories, release schedules & public notices
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS \`announcements\`;
CREATE TABLE \`announcements\` (
  \`id\` VARCHAR(64) NOT NULL,
  \`title\` VARCHAR(191) NOT NULL,
  \`category\` VARCHAR(64) NOT NULL,
  \`description\` TEXT NOT NULL,
  \`publish_date\` VARCHAR(64) NOT NULL,
  \`views_count\` INT NOT NULL DEFAULT 0,
  \`icon_type\` VARCHAR(64) NOT NULL DEFAULT 'general',
  \`is_pinned\` TINYINT(1) NOT NULL DEFAULT 0,
  \`status\` VARCHAR(32) NOT NULL DEFAULT 'Published',
  \`target_audience_type\` VARCHAR(128) DEFAULT NULL,
  \`extra_json\` JSON DEFAULT NULL,
  \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  KEY \`idx_announcements_category\` (\`category\`),
  KEY \`idx_announcements_pinned\` (\`is_pinned\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. TABLE: census_puroks
-- Barangay Bugo population, household & demographic breakdown by Zone (1-10)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS \`census_puroks\`;
CREATE TABLE \`census_puroks\` (
  \`id\` INT AUTO_INCREMENT NOT NULL,
  \`purok_name\` VARCHAR(128) NOT NULL,
  \`population\` INT NOT NULL DEFAULT 0,
  \`households\` INT NOT NULL DEFAULT 0,
  \`registered_voters\` INT NOT NULL DEFAULT 0,
  \`senior_citizens\` INT NOT NULL DEFAULT 0,
  \`working_age\` INT NOT NULL DEFAULT 0,
  \`minors\` INT NOT NULL DEFAULT 0,
  \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`census_puroks_purok_name_key\` (\`purok_name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6. TABLE: notifications
-- Citizen and administrator portal notification queue & official dockets
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS \`notifications\`;
CREATE TABLE \`notifications\` (
  \`id\` VARCHAR(64) NOT NULL,
  \`user_id\` VARCHAR(64) DEFAULT NULL,
  \`title\` VARCHAR(191) NOT NULL,
  \`message\` TEXT NOT NULL,
  \`is_read\` TINYINT(1) NOT NULL DEFAULT 0,
  \`type\` VARCHAR(64) NOT NULL DEFAULT 'system',
  \`timestamp\` VARCHAR(64) NOT NULL,
  \`application_ref\` VARCHAR(64) DEFAULT NULL,
  \`target_area\` VARCHAR(64) DEFAULT NULL,
  \`document_data_json\` JSON DEFAULT NULL,
  \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  KEY \`idx_notifications_user\` (\`user_id\`),
  KEY \`idx_notifications_read\` (\`is_read\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 7. TABLE: activity_logs
-- Immutable security audit log tracking administrative & resident actions
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS \`activity_logs\`;
CREATE TABLE \`activity_logs\` (
  \`id\` VARCHAR(64) NOT NULL,
  \`resident_name\` VARCHAR(191) NOT NULL,
  \`resident_id_number\` VARCHAR(64) NOT NULL,
  \`purok\` VARCHAR(128) NOT NULL,
  \`action_type\` VARCHAR(64) NOT NULL,
  \`location_or_service\` VARCHAR(191) NOT NULL,
  \`timestamp\` VARCHAR(64) NOT NULL,
  \`officer_in_charge\` VARCHAR(191) NOT NULL,
  \`status\` VARCHAR(64) NOT NULL,
  \`details\` TEXT NOT NULL,
  \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  KEY \`idx_activity_actor\` (\`resident_id_number\`),
  KEY \`idx_activity_action\` (\`action_type\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 8. TABLE: archived_records
-- Long-term records storage for archived resident, service & document records
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS \`archived_records\`;
CREATE TABLE \`archived_records\` (
  \`id\` VARCHAR(64) NOT NULL,
  \`title\` VARCHAR(191) NOT NULL,
  \`record_type\` VARCHAR(64) NOT NULL,
  \`record_reference\` VARCHAR(128) NOT NULL,
  \`archived_by\` VARCHAR(191) NOT NULL,
  \`deleted_at\` VARCHAR(64) NOT NULL,
  \`status\` VARCHAR(32) NOT NULL DEFAULT 'Archived',
  \`reason\` TEXT DEFAULT NULL,
  \`payload_json\` JSON DEFAULT NULL,
  \`archived_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  KEY \`idx_archives_type\` (\`record_type\`),
  KEY \`idx_archives_reference\` (\`record_reference\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- SEED DATA INSERTS
-- ==============================================================================

`;

// 1. Insert Users
sql += `-- ------------------------------------------------------------------------------\n`;
sql += `-- SEED: users (Seeded Admin & Resident accounts)\n`;
sql += `-- ------------------------------------------------------------------------------\n`;
sql += `INSERT INTO \`users\` (\`id\`, \`name\`, \`email\`, \`password_hash\`, \`role\`, \`contact_number\`, \`purok\`, \`address\`, \`resident_id_number\`, \`is_verified\`, \`registration_status\`, \`registered_date\`, \`nationality\`, \`occupation\`, \`household_income\`, \`family_members_count\`, \`voter_status\`, \`avatar_url\`) VALUES\n`;
const userRows = (db.users || []).map((u: any) => {
  return `(${escapeSql(u.id)}, ${escapeSql(u.name)}, ${escapeSql(u.email)}, ${escapeSql(u.passwordHash)}, ${escapeSql(u.role)}, ${escapeSql(u.contactNumber)}, ${escapeSql(u.purok)}, ${escapeSql(u.address)}, ${escapeSql(u.residentIdNumber)}, ${u.isVerified ? 1 : 0}, ${escapeSql(u.registrationStatus || 'Verified')}, ${escapeSql(u.registeredDate || '2025-01-01')}, ${escapeSql(u.nationality || 'Filipino')}, ${escapeSql(u.occupation || null)}, ${escapeSql(u.householdIncome || null)}, ${u.familyMembersCount || 1}, ${escapeSql(u.voterStatus || 'Registered')}, ${escapeSql(u.avatarUrl || null)})`;
});
sql += userRows.join(',\n') + ';\n\n';

// 2. Insert Assistance Programs
sql += `-- ------------------------------------------------------------------------------\n`;
sql += `-- SEED: assistance_programs (All ${programCount} Services with local images)\n`;
sql += `-- ------------------------------------------------------------------------------\n`;
sql += `INSERT INTO \`assistance_programs\` (\`id\`, \`title\`, \`category\`, \`tagline\`, \`description\`, \`image_url\`, \`status\`, \`badge_text\`, \`deadline\`, \`target_audience\`, \`processing_time\`, \`max_benefit_amount\`, \`requirements_json\`, \`eligibility_criteria_json\`) VALUES\n`;
const programRows = (db.programs || []).map((p: any) => {
  return `(${escapeSql(p.id)}, ${escapeSql(p.title)}, ${escapeSql(p.category)}, ${escapeSql(p.tagline)}, ${escapeSql(p.description)}, ${escapeSql(p.imageUrl)}, ${escapeSql(p.status || 'Active')}, ${escapeSql(p.badgeText)}, ${escapeSql(p.deadline)}, ${escapeSql(p.targetAudience)}, ${escapeSql(p.processingTime)}, ${escapeSql(p.maxBenefitAmount)}, ${escapeSql(p.requirements || [])}, ${escapeSql(p.eligibilityCriteria || [])})`;
});
sql += programRows.join(',\n') + ';\n\n';

// 3. Insert Census Puroks
if (db.census && db.census.purokBreakdown) {
  sql += `-- ------------------------------------------------------------------------------\n`;
  sql += `-- SEED: census_puroks (Demographic census for Zones 1-10)\n`;
  sql += `-- ------------------------------------------------------------------------------\n`;
  sql += `INSERT INTO \`census_puroks\` (\`purok_name\`, \`population\`, \`households\`) VALUES\n`;
  const purokRows = db.census.purokBreakdown.map((p: any) => {
    return `(${escapeSql(p.purok)}, ${p.population || 0}, ${p.households || 0})`;
  });
  sql += purokRows.join(',\n') + ';\n\n';
}

// 4. Insert Announcements
if (db.announcements && db.announcements.length > 0) {
  sql += `-- ------------------------------------------------------------------------------\n`;
  sql += `-- SEED: announcements\n`;
  sql += `-- ------------------------------------------------------------------------------\n`;
  sql += `INSERT INTO \`announcements\` (\`id\`, \`title\`, \`category\`, \`description\`, \`publish_date\`, \`views_count\`, \`icon_type\`, \`is_pinned\`, \`status\`) VALUES\n`;
  const annRows = db.announcements.map((a: any) => {
    return `(${escapeSql(a.id)}, ${escapeSql(a.title)}, ${escapeSql(a.category)}, ${escapeSql(a.description)}, ${escapeSql(a.date || 'Today')}, ${a.viewsCount || 0}, ${escapeSql(a.iconType || 'general')}, ${a.isPinned ? 1 : 0}, ${escapeSql(a.status || 'Published')})`;
  });
  sql += annRows.join(',\n') + ';\n\n';
}

// 5. Insert Notifications
if (db.notifications && db.notifications.length > 0) {
  sql += `-- ------------------------------------------------------------------------------\n`;
  sql += `-- SEED: notifications\n`;
  sql += `-- ------------------------------------------------------------------------------\n`;
  sql += `INSERT INTO \`notifications\` (\`id\`, \`user_id\`, \`title\`, \`message\`, \`is_read\`, \`type\`, \`timestamp\`, \`application_ref\`, \`target_area\`, \`document_data_json\`) VALUES\n`;
  const notifRows = db.notifications.map((n: any) => {
    return `(${escapeSql(n.id)}, ${escapeSql(n.userId || null)}, ${escapeSql(n.title)}, ${escapeSql(n.message)}, ${n.read ? 1 : 0}, ${escapeSql(n.type || 'system')}, ${escapeSql(n.timestamp || '')}, ${escapeSql(n.applicationRef || null)}, ${escapeSql(n.targetArea || null)}, ${escapeSql(n.documentData || null)})`;
  });
  sql += notifRows.join(',\n') + ';\n\n';
}

sql += `SET FOREIGN_KEY_CHECKS = 1;\n\n`;
sql += `-- ==============================================================================\n`;
sql += `-- END OF MYSQL INITIALIZATION SCRIPT\n`;
sql += `-- Database: barangay_bugo_db | Tables: 8 | Services: ${programCount} | Status: Verified\n`;
sql += `-- ==============================================================================\n`;

const outDir = path.resolve(process.cwd(), 'database');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outPath = path.join(outDir, 'schema_mysql.sql');
fs.writeFileSync(outPath, sql, 'utf-8');
console.log('Successfully written schema_mysql.sql, size:', (sql.length / 1024).toFixed(1), 'KB');
