-- ==============================================================================
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
CREATE DATABASE IF NOT EXISTS `barangay_bugo_db`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `barangay_bugo_db`;

-- ------------------------------------------------------------------------------
-- 1. TABLE: users
-- Core resident and administrator accounts with demographic profiles
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'Bcrypt or salted PBKDF2-SHA512 hash',
  `role` VARCHAR(32) NOT NULL DEFAULT 'resident',
  `contact_number` VARCHAR(32) NOT NULL,
  `purok` VARCHAR(128) NOT NULL,
  `address` TEXT NOT NULL,
  `resident_id_number` VARCHAR(64) NOT NULL,
  `is_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `registration_status` VARCHAR(64) NOT NULL DEFAULT 'Pending Approval',
  `is_banned` TINYINT(1) NOT NULL DEFAULT 0,
  `ban_reason` TEXT DEFAULT NULL,
  `registered_date` VARCHAR(32) NOT NULL,
  `nationality` VARCHAR(64) NOT NULL DEFAULT 'Filipino',
  `occupation` VARCHAR(128) DEFAULT NULL,
  `employment_status` VARCHAR(64) DEFAULT NULL,
  `household_income` VARCHAR(64) DEFAULT NULL,
  `family_members_count` INT NOT NULL DEFAULT 1,
  `voter_status` VARCHAR(64) NOT NULL DEFAULT 'Registered',
  `age` INT DEFAULT NULL,
  `gender` VARCHAR(32) DEFAULT NULL,
  `avatar_url` LONGTEXT DEFAULT NULL,
  `pending_profile_json` JSON DEFAULT NULL,
  `extra_profile_json` JSON DEFAULT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`),
  UNIQUE KEY `users_resident_id_number_key` (`resident_id_number`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_purok` (`purok`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. TABLE: assistance_programs
-- 44 Barangay Bugo welfare, health, civil registration & emergency services
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `assistance_programs`;
CREATE TABLE `assistance_programs` (
  `id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `category` VARCHAR(128) NOT NULL,
  `tagline` TEXT DEFAULT NULL,
  `description` TEXT NOT NULL,
  `image_url` TEXT NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'Active',
  `badge_text` VARCHAR(64) DEFAULT NULL,
  `deadline` VARCHAR(128) DEFAULT NULL,
  `target_audience` VARCHAR(191) DEFAULT NULL,
  `processing_time` VARCHAR(128) DEFAULT NULL,
  `max_benefit_amount` VARCHAR(128) DEFAULT NULL,
  `allocated_budget` DECIMAL(14,2) NOT NULL DEFAULT 500000.00,
  `disbursed_budget` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `slots_available` INT NOT NULL DEFAULT 100,
  `total_slots` INT NOT NULL DEFAULT 100,
  `requirements_json` JSON DEFAULT NULL,
  `eligibility_criteria_json` JSON DEFAULT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_programs_category` (`category`),
  KEY `idx_programs_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. TABLE: assistance_applications
-- Resident assistance & certificate filings, review timelines & disbursements
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `assistance_applications`;
CREATE TABLE `assistance_applications` (
  `id` VARCHAR(64) NOT NULL,
  `reference_code` VARCHAR(64) NOT NULL,
  `program_id` VARCHAR(64) NOT NULL,
  `program_title` VARCHAR(191) NOT NULL,
  `program_category` VARCHAR(128) DEFAULT NULL,
  `applicant_user_id` VARCHAR(64) NOT NULL,
  `applicant_name` VARCHAR(191) NOT NULL,
  `contact_number` VARCHAR(32) NOT NULL,
  `email` VARCHAR(191) DEFAULT NULL,
  `purok` VARCHAR(128) NOT NULL,
  `address` TEXT DEFAULT NULL,
  `household_monthly_income` VARCHAR(64) DEFAULT NULL,
  `family_members_count` INT DEFAULT NULL,
  `occupation` VARCHAR(128) DEFAULT NULL,
  `purpose_or_diagnosis` TEXT DEFAULT NULL,
  `status` VARCHAR(64) NOT NULL DEFAULT 'Submitted',
  `submission_date` VARCHAR(64) NOT NULL,
  `last_updated` VARCHAR(64) DEFAULT NULL,
  `requested_amount` VARCHAR(64) DEFAULT NULL,
  `approved_amount` VARCHAR(64) DEFAULT NULL,
  `evaluator_notes` TEXT DEFAULT NULL,
  `rejection_reason` TEXT DEFAULT NULL,
  `priority_score` VARCHAR(32) DEFAULT NULL,
  `supporting_documents_json` JSON DEFAULT NULL,
  `timeline_json` JSON DEFAULT NULL,
  `eligibility_json` JSON DEFAULT NULL,
  `official_receipt_number` VARCHAR(64) DEFAULT NULL,
  `payment_method` VARCHAR(64) DEFAULT NULL,
  `disbursed_by` VARCHAR(191) DEFAULT NULL,
  `disbursed_at` VARCHAR(64) DEFAULT NULL,
  `resubmitted_at` VARCHAR(64) DEFAULT NULL,
  `resubmitted_note` TEXT DEFAULT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `assistance_applications_reference_code_key` (`reference_code`),
  KEY `idx_apps_user` (`applicant_user_id`),
  KEY `idx_apps_program` (`program_id`),
  KEY `idx_apps_status` (`status`),
  CONSTRAINT `assistance_applications_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `assistance_programs` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `assistance_applications_applicant_user_id_fkey` FOREIGN KEY (`applicant_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. TABLE: announcements
-- Official barangay advisories, release schedules & public notices
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `announcements`;
CREATE TABLE `announcements` (
  `id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `category` VARCHAR(64) NOT NULL,
  `description` TEXT NOT NULL,
  `publish_date` VARCHAR(64) NOT NULL,
  `views_count` INT NOT NULL DEFAULT 0,
  `icon_type` VARCHAR(64) NOT NULL DEFAULT 'general',
  `is_pinned` TINYINT(1) NOT NULL DEFAULT 0,
  `status` VARCHAR(32) NOT NULL DEFAULT 'Published',
  `target_audience_type` VARCHAR(128) DEFAULT NULL,
  `extra_json` JSON DEFAULT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_announcements_category` (`category`),
  KEY `idx_announcements_pinned` (`is_pinned`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. TABLE: census_puroks
-- Barangay Bugo population, household & demographic breakdown by Zone (1-10)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `census_puroks`;
CREATE TABLE `census_puroks` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `purok_name` VARCHAR(128) NOT NULL,
  `population` INT NOT NULL DEFAULT 0,
  `households` INT NOT NULL DEFAULT 0,
  `registered_voters` INT NOT NULL DEFAULT 0,
  `senior_citizens` INT NOT NULL DEFAULT 0,
  `working_age` INT NOT NULL DEFAULT 0,
  `minors` INT NOT NULL DEFAULT 0,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `census_puroks_purok_name_key` (`purok_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6. TABLE: notifications
-- Citizen and administrator portal notification queue & official dockets
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) DEFAULT NULL,
  `title` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `type` VARCHAR(64) NOT NULL DEFAULT 'system',
  `timestamp` VARCHAR(64) NOT NULL,
  `application_ref` VARCHAR(64) DEFAULT NULL,
  `target_area` VARCHAR(64) DEFAULT NULL,
  `document_data_json` JSON DEFAULT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user` (`user_id`),
  KEY `idx_notifications_read` (`is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 7. TABLE: activity_logs
-- Immutable security audit log tracking administrative & resident actions
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `activity_logs`;
CREATE TABLE `activity_logs` (
  `id` VARCHAR(64) NOT NULL,
  `resident_name` VARCHAR(191) NOT NULL,
  `resident_id_number` VARCHAR(64) NOT NULL,
  `purok` VARCHAR(128) NOT NULL,
  `action_type` VARCHAR(64) NOT NULL,
  `location_or_service` VARCHAR(191) NOT NULL,
  `timestamp` VARCHAR(64) NOT NULL,
  `officer_in_charge` VARCHAR(191) NOT NULL,
  `status` VARCHAR(64) NOT NULL,
  `details` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_activity_actor` (`resident_id_number`),
  KEY `idx_activity_action` (`action_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 8. TABLE: archived_records
-- Long-term records storage for archived resident, service & document records
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `archived_records`;
CREATE TABLE `archived_records` (
  `id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `record_type` VARCHAR(64) NOT NULL,
  `record_reference` VARCHAR(128) NOT NULL,
  `archived_by` VARCHAR(191) NOT NULL,
  `deleted_at` VARCHAR(64) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'Archived',
  `reason` TEXT DEFAULT NULL,
  `payload_json` JSON DEFAULT NULL,
  `archived_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_archives_type` (`record_type`),
  KEY `idx_archives_reference` (`record_reference`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- SEED DATA INSERTS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SEED: users (Seeded Admin & Resident accounts)
-- ------------------------------------------------------------------------------
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `contact_number`, `purok`, `address`, `resident_id_number`, `is_verified`, `registration_status`, `registered_date`, `nationality`, `occupation`, `household_income`, `family_members_count`, `voter_status`, `avatar_url`) VALUES
('admin-juan-delacruz', 'Brgy. Bugo Admin', 'admin@bugo.gov.ph', '907df8442fc3dd8a02092ef62a38bf51:82c036dd8dc08d596fbcc001ec5d5dfbdd7403b93e01b4108bd06c7ebaa07ba16f67cd734d8c8fb53ef379e1b84efe52578d60d8c2410894ecaa879d83c50169', 'admin', '09171110000', 'Zone 1', 'Barangay Bugo Administrative Complex, Cagayan de Oro City', 'BG-ADMIN-001', 1, 'Verified', '2020-01-01', 'Filipino', 'Barangay Administrator & Secretary', NULL, 1, 'Registered', 'https://api.dicebear.com/7.x/avataaars/svg?seed=AdminCapitan&top=shortRound&facialHair=moustacheMagnum&clothing=blazerAndShirt&backgroundColor=d1d4f9'),
('user-maria-santos', 'Joshua Abella Laurio', 'resident@bugo.gov.ph', '38247eea29307a771c40d23a8700346e:81b3d69fad009b4683b4ab077e76ef4c7707ad2c8cf326ddc6cf1a4e6f8ef7fa1a3cb44e232273cfdb9c248400217f6bf559c19e96f90c7ad16df1e2bdc65e57', 'resident', '+639944772143', 'Zone 3', 'Block 4 Lot 12, Zone 3, Barangay Bugo, Cagayan de Oro City', 'BG-2026-04829', 1, 'Verified', '2025-03-14', 'Filipino', 'Self-Employed / Market Vendor', '₱8,500.00 (Informal / Low Income)', 4, 'Registered', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Joshua&top=shortFlat&facialHair=beardLight&clothing=collarAndSweater&backgroundColor=b6e3f4');

-- ------------------------------------------------------------------------------
-- SEED: assistance_programs (All 44 Services with local images)
-- ------------------------------------------------------------------------------
INSERT INTO `assistance_programs` (`id`, `title`, `category`, `tagline`, `description`, `image_url`, `status`, `badge_text`, `deadline`, `target_audience`, `processing_time`, `max_benefit_amount`, `requirements_json`, `eligibility_criteria_json`) VALUES
('prog-barangay-clearance', 'Issuance of Barangay Clearance', 'Barangay Administrative Services', 'Official certification certifying residency, good character, and clean barangay record.', 'Universal administrative document required for employment, passport application, bank account opening, postal ID, and government transactions in Cagayan de Oro City.', '/assets/services/brgy_clearance_cert_1794197711166.jpg', 'Active', 'Instant Pipeline', 'Year-Round Service', 'All Registered Bugo Residents', 'Same Day (1-2 Hours)', 'Standard Fee: ₱50.00 (Waived for Indigents)', '["Valid Government ID or Student ID","Community Tax Certificate (Cedula)","Proof of Residency (Zone 1 to 10 of Bugo)"]', '["Bona fide resident of Barangay Bugo for at least 6 months","Verified Barangay Bugo resident in good community standing"]'),
('prog-admin-residency', 'Certificate of Residency', 'Barangay Administrative Services', 'Formal proof of physical residence within the territorial jurisdiction of Barangay Bugo.', 'Official certification verifying that the individual currently resides in a specific Purok/Zone of Bugo. Commonly needed for court filings, electric/water utility meter applications, and school enrollments.', '/assets/services/brgy_clearance_cert_1794197711166.jpg', 'Active', 'Express Release', 'Ongoing Availability', 'Homeowners, Renters, and Bugo Dwellers', '1 - 2 Business Hours', 'Standard Certification', '["Valid Government ID with Bugo address","Purok Leader Endorsement / Sitio Clearance","Proof of Billing or House Rental Contract"]', '["Currently living in Barangay Bugo","Minimum residence duration of 3 months"]'),
('prog-admin-indigency', 'Certificate of Indigency', 'Barangay Administrative Services', 'Affidavit of indigent economic status for legal aid, medical fee waivers, and government relief.', 'Free official certification confirming that the family belongs to the low-income bracket. Used to request medical subsidy at Northern Mindanao Medical Center (NMMC), JR Borja General Hospital, PAO legal services, and DSWD assistance.', '/assets/services/brgy_senior_pension_1794197712463.jpg', 'Active', '100% Free', 'Year-Round Service', 'Low-income and indigent families', 'Within 24 Hours', 'Fee Exemption Granted', '["Valid Resident ID or Voter Certification","Endorsement from Purok / Zone Chairman","Affidavit of Low Income or Certificate of Non-Filing of ITR"]', '["Household monthly income at or below statutory poverty threshold","Resident of Barangay Bugo"]'),
('prog-admin-good-moral', 'Certificate of Good Moral Character', 'Barangay Administrative Services', 'Attestation of good civic behavior, community standing, and law-abiding citizenship.', 'Documentary proof required by universities, scholarship foundations, security agencies, and prospective employers confirming the applicant possesses exemplary community conduct.', '/assets/services/brgy_clearance_cert_1794197711166.jpg', 'Active', 'Verified Conduct', 'Continuous', 'Students, Job Applicants, and Professionals', '1 - 2 Business Days', 'Official Endorsement', '["Valid Government ID","Barangay Clearance copy","2 Character Reference sign-offs from neighbors or Purok Officer"]', '["Clean barangay record with no administrative sanctions or peace violations","Verified resident of Barangay Bugo"]'),
('prog-admin-first-job', 'First-Time Job Seeker Certification', 'Barangay Administrative Services', 'Republic Act 11261 waiver granting 100% free government clearances and certificates for new graduates.', 'Under the First-Time Jobseekers Assistance Act, this certification waives fees for NBI Clearance, Police Clearance, Barangay Clearance, Medical Certificates, and Birth Certificates when seeking first-time employment.', '/assets/services/brgy_clearance_cert_1794197711166.jpg', 'Active', 'RA 11261 Mandated', 'Valid for 1 Year from Issuance', 'Recent Graduates & First-Time Job Seekers', 'Same Day Issuance', 'Full Fee Exemption', '["School Diploma, Transcript, or Certificate of Graduation","Barangay Resident ID or Proof of Bugo Address","Signed Oath of Undertaking for First-Time Job Seekers"]', '["First-time entrant to the formal job market","Resident of Barangay Bugo"]'),
('prog-admin-business-permit', 'Business Permit Endorsement', 'Barangay Administrative Services', 'Barangay commercial clearance endorsement required for City Hall Mayor’s Business Permit.', 'Administrative assessment and environmental clearance inspection for sari-sari stores, retail enterprises, food stalls, and commercial establishments operating within Bugo.', '/assets/services/real_barangay_hall_1788172230992.jpg', 'Active', 'Commercial Clearance', 'Annual Renewal & New Registrations', 'Micro, Small, & Medium Enterprise Owners', '2 - 3 Business Days', 'Official Regulatory Clearance', '["DTI Business Name Registration or SEC Certificate","Lease Contract or Proof of Property Ownership","Fire Safety Inspection and Sanitation Endorsement"]', '["Business establishment located within Barangay Bugo","Compliance with local zoning and environmental waste disposal ordinances"]'),
('prog-cert-solo-parent', 'Solo Parent Barangay Certification (RA 11861)', 'Barangay Administrative Services', 'Official certification certifying Solo Parent status under the Expanded Solo Parents Welfare Act.', 'Mandatory certificate needed to claim the ₱1,000 monthly city cash subsidy, 7-day parental leave, education scholarship priorities, and government relief for solo mothers and fathers.', '/assets/services/brgy_senior_pension_1794197712463.jpg', 'Active', 'RA 11861 Welfare', 'Year-Round Intake', 'Solo / Single Parents Parenting Dependents in Bugo', 'Same Day Issuance', 'Official RA 11861 Certification', '["Affidavit of Solo Parenting (detailing abandonment, separation, or widowhood)","Birth Certificate of dependent children (unmarried & below 22)","Valid Government ID or Barangay Resident ID"]', '["Sole financial and physical custody of minor or dependent children","Registered resident of Barangay Bugo","Household income not exceeding statutory threshold"]'),
('prog-cert-senior-citizen', 'Senior Citizen Barangay Endorsement & Certification', 'Barangay Administrative Services', 'Formal endorsement and certification of elderly status for OSCA ID and social pension benefits.', 'Barangay certification attesting that the resident is aged 60 and above, residing within Bugo. Used for OSCA Booklet issuance, PhilHealth senior lifetime membership, and local birthday cash gifts.', '/assets/services/brgy_senior_pension_1794197712463.jpg', 'Active', 'Senior Citizen OSCA', 'Continuous Registration', 'Senior Citizens (Aged 60+)', 'Same Day Issuance', 'Official OSCA Endorsement', '["PSA Birth Certificate or Proof of Age (60 years old and above)","Barangay Resident ID Card or Voter Certification","2 copies 2x2 recent ID photos"]', '["Filipino citizen residing in Barangay Bugo","Must be 60 years of age or older"]'),
('prog-cert-pwd', 'PWD Barangay Endorsement & Certification (RA 10754)', 'Barangay Administrative Services', 'Official certification endorsing Persons with Disabilities for National PWD ID and discounts.', 'Official attestation confirming the applicant has a permanent physical, sensory, or psychosocial impairment and resides in Bugo. Required for City Social Welfare PWD ID card issuance and 20% discount booklet.', '/assets/services/brgy_pwd_wheelchair_1794197737143.jpg', 'Active', 'RA 10754 Mandated', 'Continuous Enrollment', 'Children and Adults with Disabilities', 'Same Day (1-2 Hours)', 'Official PWD Certification', '["Medical Certificate with Disability Assessment from a licensed physician","Barangay Resident ID or Proof of Bugo Address","2 copies 2x2 recent ID photos"]', '["Diagnosed with physical, sensory, cognitive, or psychological disability","Resident of Barangay Bugo"]'),
('prog-cert-student-grant', 'Student Barangay Certification & Fee Waiver Endorsement', 'Barangay Administrative Services', 'Official certification certifying active student status for fee waivers and academic grants.', 'Documentary certification required by tertiary institutions, TESDA academies, and CHED scholarship boards to verify active student residency in Bugo for student fare discounts and educational stipends.', '/assets/services/brgy_daycare_learning_1794197756426.jpg', 'Active', 'Student Clearance', 'Continuous Semester Processing', 'Elementary, High School, College, & Vocational Students', 'Same Day Issuance', 'Free Student Endorsement', '["Valid School ID or Certificate of Registration (COR)","Barangay Resident ID or Proof of Address","Latest Report Card or Transcript of Records"]', '["Currently enrolled in an accredited public or private school/college","Bona fide resident of Barangay Bugo"]'),
('prog-health-consultation', 'Free Medical Consultations', 'Health and Medical Services', 'Walk-in and scheduled medical consultations with Bugo Health Center physicians and nurses.', 'Comprehensive general outpatient clinical consultations, physical examinations, vital checks, prescription generation, and diagnostic referrals provided at zero cost to residents.', '/assets/services/brgy_medical_clinic_1794197711940.jpg', 'Active', 'Free Clinical Care', 'Mon-Fri 8:00 AM - 5:00 PM', 'All Bugo Residents & Dependents', 'Same Day Consultation', 'Free Consultation', '["Barangay Resident ID or Family Health Card","Previous Medical Records / Prescriptions (if any)"]', '["Registered resident of Barangay Bugo","Non-emergency outpatient medical needs"]'),
('prog-health-checkup', 'Basic Health Checkups', 'Health and Medical Services', 'Routine blood pressure monitoring, random blood sugar screening, and vital signs assessment.', 'Preventive cardiovascular and metabolic health screenings conducted by barangay health workers (BHWs). Early detection for hypertension, diabetes, and lifestyle illnesses.', '/assets/services/brgy_medical_clinic_1794197711940.jpg', 'Active', 'Daily Walk-in', 'Daily Health Desk', 'Adults, Seniors, and High-Risk Patients', '15 - 30 Minutes', 'Free Screening', '["Valid Resident ID or Senior Citizen ID","Personal Health Monitoring Logbook (optional)"]', '["Open to all residents of Barangay Bugo"]'),
('prog-health-free-medicines', 'Free Medicines (Subject to Availability)', 'Health and Medical Services', 'Free pharmacy dispensing of maintenance medicines, antibiotics, and vitamins.', 'Barangay Bugo health dispensary stocks vital medications for hypertension (Losartan, Amlodipine), diabetes (Metformin), pediatric antibiotics, paracetamol, and vitamins sourced from City Health Department.', '/assets/services/brgy_medical_clinic_1794197711940.jpg', 'Active', 'City Health Stock', 'Continuous While Stocks Last', 'Seniors, Indigents, and Pediatric Patients', 'Immediate Dispensing', 'Free Essential Medication', '["Valid Doctor’s Prescription (issued within the last 60 days)","Barangay Resident ID or Indigency Slip","Senior Citizen OSCA ID or PWD ID (for maintenance)"]', '["Resident of Barangay Bugo","Valid doctor prescription matching pharmacy inventory"]'),
('prog-health-immunization', 'Immunization and Vaccination', 'Health and Medical Services', 'National Expanded Program on Immunization (EPI) vaccines for infants, toddlers, and seniors.', 'Complete childhood vaccine protection including BCG, Hepatitis B, Pentavalent, Oral Polio, Measles-Rubella, as well as annual seasonal Flu and Pneumococcal vaccines for senior citizens.', '/assets/services/brgy_vaccine_child_1794197736182.jpg', 'Active', 'DOH Certified Vaccines', 'Wednesdays: Infant EPI | Seasonal: Senior Flu', 'Infants (0-12 mos), Children, and Seniors', 'Scheduled Clinic Sessions', '100% Free DOH Vaccines', '["Child Baby Health Book / Immunization Card","Parent or Guardian Valid Resident ID","Senior Citizen ID (for Senior Flu shots)"]', '["Age-appropriate vaccine schedule under DOH guidelines","Resident of Barangay Bugo"]'),
('prog-health-maternal', 'Maternal and Prenatal Care', 'Health and Medical Services', 'Safe motherhood prenatal checkups, tetanus toxoid, iron supplements, and birth planning.', 'Comprehensive maternal health services supporting expectant mothers through every trimester. Includes fetal heartbeat monitoring, prenatal vitamins, laboratory referrals, and delivery facility coordination.', '/assets/services/brgy_vaccine_child_1794197736182.jpg', 'Active', 'Maternal Wellness', 'Weekly Prenatal Clinic', 'Expectant Mothers in Barangay Bugo', 'Continuous Care Management', 'Free Prenatal Package', '["Mother & Child Health Book (Pink Card)","Valid ID of Expectant Mother","Previous ultrasound or laboratory findings (if available)"]', '["Pregnant resident residing in Bugo Zones 1-10","Commitment to regular prenatal follow-ups"]'),
('prog-health-family-planning', 'Family Planning Services', 'Health and Medical Services', 'Responsible parenthood counseling, oral contraceptives, DMPA injectables, and IUD insertion referrals.', 'Free reproductive health education, supply of oral contraceptive pills, condoms, quarterly injectable DMPA, and referrals for bilateral tubal ligation and vasectomy.', '/assets/services/brgy_medical_clinic_1794197711940.jpg', 'Active', 'Reproductive Health', 'Year-Round Service', 'Couples and Individuals of Reproductive Age', 'Immediate Consultation', 'Free Contraceptives & Counseling', '["Family Planning Client Card / Resident ID","Brief health assessment with midwife"]', '["Resident of Barangay Bugo","Voluntary enrollment in family planning methods"]'),
('prog-health-nutrition', 'Nutrition Programs', 'Health and Medical Services', 'Supplementary feeding for malnourished children, micronutrient powders, and growth monitoring.', 'Barangay Nutrition Scholar (BNS) program conducting Operation Timbang Plus, hot nutritious daily meal feeding for wasted/stunted toddlers, and vitamin A supplementation.', '/assets/services/brgy_daycare_learning_1794197756426.jpg', 'Active', 'Child Nutrition Grant', 'Ongoing 120-Day Feeding Cycles', 'Underweight Toddlers & Malnourished Children', 'Intake Assessment', 'Free Supplementary Feeding', '["Child Growth Monitoring Record","Parent Resident ID","Barangay Health Center Indigency slip"]', '["Children aged 6 to 59 months identified as underweight or stunted","Resident of Barangay Bugo"]'),
('prog-health-tb-dots', 'Tuberculosis (TB-DOTS) Services', 'Health and Medical Services', 'Free sputum microscopy, GeneXpert testing, chest X-ray vouchers, and full 6-month anti-TB treatment.', 'Directly Observed Treatment Short-Course (TB-DOTS) clinic providing confidential diagnosis, daily medication management, and contact tracing to eradicate tuberculosis in the community.', '/assets/services/brgy_medical_clinic_1794197711940.jpg', 'Active', 'DOH DOTS Accredited', 'Daily Treatment Monitoring', 'Presumptive & Diagnosed TB Patients', 'Same Day Treatment Initiation', '100% Free Complete TB Regimen', '["Sputum specimen for laboratory examination","Valid Resident ID","Chest X-Ray referral film (if existing)"]', '["Presumptive TB cases or confirmed positive TB patients","Commitment to complete 6-month regimen"]'),
('prog-health-dental', 'Dental Services and Tooth Extraction', 'Health and Medical Services', 'Free tooth extraction, oral health consultation, fluoride treatment, and emergency relief.', 'Visiting City Health Dentist clinics providing dental checkups, tooth extractions for decayed teeth, pain relief medication, and pediatric fluoride varnishing for Bugo youth.', '/assets/services/brgy_dental_clinic_1794197757496.jpg', 'Active', 'Free Dental Clinic', 'Weekly Scheduled Dental Missions', 'Children, Adults, and Senior Citizens', 'Appointment / Queue on Dental Day', 'Free Oral Health Care', '["Valid Barangay Resident ID or School ID","Blood pressure screening prior to extraction","Signed Medical History / Consent Form"]', '["Resident of Barangay Bugo","Clinically cleared for dental extraction"]'),
('prog-health-circumcision', 'Circumcision Services', 'Health and Medical Services', 'Annual free minor surgical circumcision (Operation Tuli) with sterile equipment and antibiotic kit.', 'Safe clinical circumcision performed by registered medical doctors and nurses during summer breaks. Includes free local anesthesia, sterile surgical sets, post-op antibiotics, and dressing kits.', '/assets/services/brgy_dental_clinic_1794197757496.jpg', 'Active', 'Annual Operation Tuli', 'Summer Season Outreach & Scheduled Slots', 'Young Boys & Adolescents (Ages 9-15)', 'Scheduled Batch Outreaches', 'Free Minor Surgery & Med Kit', '["Signed Parental Consent and Waiver Form","Child Birth Certificate or Student ID","Parent / Guardian Valid Resident ID"]', '["Resident of Barangay Bugo aged 9 years old and above","No bleeding disorders or contraindicating medical conditions"]'),
('prog-social-seniors', 'Assistance for Senior Citizens', 'Social Welfare Services', 'Office of Senior Citizens Affairs (OSCA) booklet, social pensions, and centenarian benefits.', 'Comprehensive welfare facilitation for elderly residents aged 60 and above. Includes OSCA identification cards, 20% discount booklets, facilitation of DSWD Social Pension for indigent seniors, and annual local cash gifts.', '/assets/services/brgy_senior_pension_1794197712463.jpg', 'Active', 'Senior Citizen OSCA', 'Continuous Registration', 'Senior Citizens (Aged 60+)', '3 - 5 Business Days', 'Monthly Pension & Discount Privileges', '["PSA Birth Certificate or Valid ID showing Birthdate (Age 60+)","Barangay Certificate of Residency in Bugo","2 copies of 2x2 recent ID photos"]', '["Filipino citizen residing in Barangay Bugo","Must be 60 years of age or older"]'),
('prog-social-pwd', 'Assistance for Persons with Disabilities (PWD)', 'Social Welfare Services', 'PWD ID issuance, 20% discount booklets, assistive mobility devices, and quarterly welfare aid.', 'Advocacy and benefits program protecting Bugo residents with long-term physical, mental, intellectual, or sensory impairments under Republic Act 10754.', '/assets/services/brgy_pwd_wheelchair_1794197737143.jpg', 'Active', 'RA 10754 Mandated', 'Continuous Enrollment', 'Children and Adults with Disabilities', '3 - 5 Business Days', 'Disability ID & Welfare Subsidies', '["Medical Certificate with Disability Assessment from licensed physician","Barangay Certificate of Residency in Bugo","2 copies of 2x2 ID photos with white background"]', '["Diagnosed with permanent physical, cognitive, visual, hearing, or psychological disability","Resident of Barangay Bugo"]'),
('prog-social-solo-parent', 'Solo Parent Assistance', 'Social Welfare Services', 'Expanded Solo Parents Welfare Act (RA 11861) ID processing, ₱1,000 monthly cash subsidy, and leave benefits.', 'Registration and support for single mothers and fathers parenting dependents alone. Grants access to 7-day parental leave, education scholarships, and priority in government housing and livelihood assistance.', '/assets/services/brgy_senior_pension_1794197712463.jpg', 'Active', 'RA 11861 Welfare', 'Year-Round Intake', 'Single Parents & Legal Guardians in Bugo', '5 - 7 Business Days', 'Solo Parent ID & Monthly Grant', '["Affidavit of Solo Parenting detailing circumstance (abandonment, separation, death)","Birth Certificate of dependent child/children (below 22 years old if unmarried/unemployed)","Death Certificate of spouse (if applicable)","Barangay Indigency or Income Tax Return"]', '["Sole custody and financial provider for minor or dependent children","Resident of Barangay Bugo for at least 6 months"]'),
('prog-medical-aid', 'Financial and Medical Assistance Referrals', 'Social Welfare Services', 'Official referral and endorsement for DSWD AICS, City Mayor’s Office, and PCSO funds.', 'Fast-track endorsement for emergency cash assistance to cover hospitalization bills, dialysis sessions, chemotherapy, specialized laboratory scans, and funeral expenses through government safety nets.', '/assets/services/brgy_senior_pension_1794197712463.jpg', 'Active', 'DSWD AICS Referral', 'Immediate Emergency Processing', 'Families Facing Medical Emergencies', '24 - 48 Hours', 'Referral for up to ₱50,000.00 Grant', '["Original Clinical Abstract or Doctor’s Prescription","Hospital Billing Statement or Funeral Contract","Barangay Certificate of Indigency","Valid Government ID of Applicant & Patient"]', '["Indigent patient or dependent residing in Barangay Bugo","Active medical treatment or recent bereavement"]'),
('prog-social-wheelchair', 'Wheelchair Assistance', 'Social Welfare Services', 'Free donation of orthopedic wheelchairs, walkers, and crutches for mobility-impaired residents.', 'Direct provision of mobility aids procured through barangay health development funds and civic organization donations to restore independence to bedridden, senior, and injured Bugo constituents.', '/assets/services/brgy_pwd_wheelchair_1794197737143.jpg', 'Active', 'Mobility Equipment', 'Subject to Inventory Allocation', 'Paraplegic, Amputee, and Frail Elderly Residents', '2 - 3 Business Days', 'Free Wheelchair Unit', '["Physician recommendation for mobility aid","Barangay Indigency Certification","PWD ID or Senior ID of recipient"]', '["Documented medical requirement for wheelchair or walking aid","Low-income resident of Barangay Bugo unable to purchase privately"]'),
('prog-educational-assistance', 'Scholarship Assistance and Inquiries', 'Social Welfare Services', 'Barangay Bugo College Financial Grant and facilitation of Cagayan de Oro City College scholarships.', 'Semester cash subsidy providing tuition and textbook support to deserving tertiary, vocational (TESDA), and senior high school students maintaining passing academic records.', '/assets/services/brgy_youth_sports_1794197737990.jpg', 'Active', '₱5,000.00 Grant', 'December 15, 2026', 'College, University, & Vocational Students', '3 - 5 Business Days', '₱5,000.00 / Semester', '["Certificate of Registration (COR) / Enrollment Form","Certificate of Indigency from Barangay Bugo","Valid School ID","Latest Semester Grades (GWA 83% or above with no failing grades)"]', '["Enrolled in an accredited CHED/TESDA university or technical institute","Household monthly income not exceeding ₱15,000.00","Resident of Barangay Bugo for at least 1 year"]'),
('prog-social-low-income', 'Assistance for Low-Income Families', 'Social Welfare Services', 'Emergency grocery subsidies, calamity relief packs, and social protection safety nets.', 'Direct distribution of staple foods (rice, canned goods, milk), seasonal assistance, and targeted interventions for ultra-poor families residing in informal settlements across Bugo.', '/assets/services/brgy_senior_pension_1794197712463.jpg', 'Active', 'Relief & Subsidy', 'Continuous Monitoring & Distribution', 'Indigent Families & Informal Settlers', 'Immediate Dispatch upon Verification', 'Food Packs & Emergency Relief', '["Barangay Indigency Certification","Family Composition & Purok Registration","Valid Resident ID"]', '["Household monthly income below ₱8,500.00","Bona fide family resident of Bugo"]'),
('prog-civil-late-birth', 'Late Birth Registration Assistance', 'Civil Registration Services', 'Delayed birth registration endorsements, negative PSA certificate verification, and affidavits.', 'Legal document assistance for individuals whose births were never registered with the Philippine Statistics Authority (PSA). Essential for obtaining National ID, passports, and school enrollment.', '/assets/services/brgy_clearance_cert_1794197711166.jpg', 'Active', 'Delayed Registry Aid', 'Year-Round Service', 'Unregistered Youth and Adults', '5 - 7 Business Days', 'Document Packaging & Endorsement', '["PSA Negative Certification of Birth","Joint Affidavit of Two Disinterested Persons who witnessed birth","Baptismal Certificate or Elementary School Form 137","Barangay Certificate of Residency"]', '["Born in Barangay Bugo without an existing PSA birth record","Resident of Bugo"]'),
('prog-civil-marriage', 'Marriage Registration Assistance', 'Civil Registration Services', 'Pre-marriage counseling compliance, marriage license filing, and Kasalang Bayan coordination.', 'Assistance for engaged couples seeking civil marriage license documentation, compliance with Pre-Marriage Orientation and Counseling (PMOC), and enrollment in mass wedding ceremonies.', '/assets/services/brgy_civil_wedding_1794197758046.jpg', 'Active', 'Marriage Registry', 'Ongoing & Kasalang Bayan Cycles', 'Engaged Couples Residing in Bugo', '3 - 5 Business Days', 'Endorsement & Kasalang Bayan Access', '["PSA Birth Certificates of both partners","Certificate of No Marriage Record (CENOMAR) from PSA","Pre-Marriage Counseling (PMC) Certificate","Barangay Certificate of Residency for both parties"]', '["At least one party must be a legal resident of Barangay Bugo","Legal capacity to contract marriage under Philippine Family Code"]'),
('prog-civil-death', 'Death Registration Assistance', 'Civil Registration Services', 'Certificate of Death processing, municipal cemetery burial clearance, and mortuary assistance.', 'Expedited processing of Certificate of Death with the local civil registrar, issuance of barangay burial permit, and coordination with local cemeteries and mortuary financial aid programs.', '/assets/services/brgy_clearance_cert_1794197711166.jpg', 'Active', 'Immediate Civil Filing', 'Within 48 Hours of Passing', 'Bereaved Families in Bugo', 'Same Day Expedited', 'Burial Permit & Mortuary Referral', '["Certificate of Death signed by attending physician or City Health Officer","Valid ID of Informant / Immediate Family Member","Barangay Certificate of Residency of the deceased"]', '["Deceased was a resident of Barangay Bugo or passing occurred in Bugo","Authorized surviving relative filing report"]'),
('prog-live-job-assistance', 'Job Application Assistance', 'Livelihood and Employment Services', 'Free resume encoding and printing, PESO registration, and government clearance preparation.', 'Empower job hunters with professional CV formatting, digital portal applications, PhilJobNet profile registration, and document compilation to fast-track employment.', '/assets/services/brgy_clearance_cert_1794197711166.jpg', 'Active', 'Free Career Help', 'Year-Round Service', 'Unemployed Youth & Job Seekers', 'Same Day Desk Assistance', 'Free Printing & Portal Registration', '["Draft biodata or educational records","Barangay Resident ID","2x2 Formal ID Picture"]', '["Resident of Barangay Bugo seeking active employment","At least 18 years of age (or 15-17 with special permit)"]'),
('prog-live-employment-referral', 'Employment Referrals', 'Livelihood and Employment Services', 'Direct endorsement to Cagayan de Oro industrial locators, Del Monte cannery, and local businesses.', 'Barangay PESO coordinator endorsements connecting verified local residents directly with hiring managers at food processing plants, logistics centers, supermarkets, and industrial zones in Bugo.', '/assets/services/real_barangay_hall_1788172230992.jpg', 'Active', 'Direct Industry Link', 'Ongoing Open Job Vacancies', 'Skilled, Semi-Skilled, & High School/College Grads', '2 - 3 Business Days', 'Official Barangay Employment Endorsement', '["Updated Resume / Curriculum Vitae","Barangay Clearance for Employment","Police or NBI Clearance","TESDA NC II Certificate (for technical roles)"]', '["Bona fide resident of Barangay Bugo","Meets educational and physical criteria of hiring partner"]'),
('prog-live-business-processing', 'Business Permit Processing Assistance', 'Livelihood and Employment Services', 'Technical guidance for micro-enterprises on DTI registration, BIR TIN, and business compliance.', 'Consultation desk helping local entrepreneurs, market vendors, and sari-sari store owners navigate regulatory permits, BMBE (Barangay Micro Business Enterprise) tax exemptions, and food handling certificates.', '/assets/services/real_barangay_hall_1788172230992.jpg', 'Active', 'MSME Business Desk', 'Continuous Business Support', 'Sari-Sari Store Owners, Vendors, & Startups', '1 - 2 Business Days', 'Free Technical Guidance & Forms', '["Proposed Business Name and Location","Valid Resident ID of Business Owner","Sketch of Business Location within Bugo"]', '["Business located within Barangay Bugo","Filipino citizen enterprise owner"]'),
('prog-live-agricultural-assistance', 'Agricultural Assistance', 'Livelihood and Employment Services', 'Technical farming extension, organic fertilizer access, and soil fertility advisory.', 'Programs supporting hillside and lowland farmers in Bugo Zones 3, 6, and 7 with sustainable farming techniques, pest management consultations, and organic compost distribution.', '/assets/services/brgy_agriculture_seeds_1794197712913.jpg', 'Active', 'Agri-Extension', 'Planting Season Cycles', 'Smallholder Farmers & Urban Gardeners', 'Scheduled Field Visits', 'Free Technical Agricultural Advisory', '["RSBSA (Registry System for Basic Sectors in Agriculture) ID or Registration","Barangay Certificate of Residency","Proof of Farm Land Stewardship or Tillage"]', '["Active farmer or agrarian beneficiary in Bugo","Practicing crop cultivation or livestock raising"]'),
('prog-live-seed-distribution', 'Distribution of Agricultural Seeds', 'Livelihood and Employment Services', 'Free high-yield certified vegetable seed packets for backyard gardening and food security.', 'Barangay and Department of Agriculture partnership providing seed packs of eggplant (talong), tomato (kamatis), bitter gourd (ampalaya), string beans (sitaw), and okra to promote household food self-sufficiency.', '/assets/services/brgy_agriculture_seeds_1794197712913.jpg', 'Active', 'Free Seed Packets', 'Ongoing While Seed Stocks Last', 'Households, Schools, & Urban Gardeners', 'Immediate Release at Agri Desk', 'Free Certified Seed Kits', '["Barangay Resident ID","Backyard Food Security Pledge Commitment"]', '["Open to all Bugo households with space for gardening or container farming"]'),
('prog-live-farming-support', 'Livelihood and Farming Support', 'Livelihood and Employment Services', 'Livelihood starter kits, food processing training, and cooperative financing linkups.', 'Empowers low-income families and women cooperatives with vocational livelihood skills (meat processing, pastry baking, soap making, swine raising) and small starter grants to achieve sustainable household incomes.', '/assets/services/brgy_agriculture_seeds_1794197712913.jpg', 'Active', 'Cooperative Grants', 'Quarterly Cohort Enrollments', 'Women Associations, Fisherfolk, & Farmers', '5 - 10 Business Days', 'Livelihood Starter Kit & Micro-Grant', '["Certificate of Indigency or Low Income","Barangay Resident ID","Livelihood Group or Cooperative Membership Form"]', '["Resident of Barangay Bugo","Demonstrated willingness to maintain livelihood enterprise"]'),
('prog-legal-notarization', 'Free Notarization During Government Outreach', 'Legal Services', 'Pro-bono notarization of affidavits of loss, indigency, parental consent, and undertakings.', 'Regular legal outreach clinics conducted in partnership with the Public Attorney’s Office (PAO) and the Integrated Bar of the Philippines (IBP) offering free notarial seals for low-income constituents.', '/assets/services/brgy_clearance_cert_1794197711166.jpg', 'Active', 'Pro-Bono Notarization', 'Scheduled Outreach Days', 'Indigent Residents & Public Scholars', 'Same Day on Outreach Date', 'Free Notarial Seal & Signature', '["Unsigned Document / Affidavit in 2 duplicate copies","Two (2) Valid Government IDs with photo and signature","Barangay Certificate of Indigency"]', '["Document strictly for personal or indigent assistance use","Bona fide resident of Barangay Bugo"]'),
('prog-legal-consultation', 'Legal Consultation', 'Legal Services', 'Confidential legal advice on civil disputes, family relations, property rights, and labor rights.', 'Free initial legal consultations with visiting volunteer attorneys and paralegals. Get expert counsel on land tenure issues, child custody, domestic violence, debt settlement, and labor exploitation.', '/assets/services/real_barangay_hall_1788172230992.jpg', 'Active', 'Free Legal Advice', 'Every Thursday Legal Clinic', 'Residents with Unresolved Legal Questions', 'Consultation by Appointment', 'Free 30-Minute Attorney Counseling', '["Barangay Resident ID","Summary narrative of legal issue","Copies of relevant contracts, affidavits, or legal documents"]', '["Resident of Barangay Bugo","Unable to afford private legal representation"]'),
('prog-legal-doc-assistance', 'Assistance with Legal Documents', 'Legal Services', 'Drafting assistance for Affidavits of Loss, Undertakings, Special Power of Attorney, and Certifications.', 'Barangay paralegal desk assists residents in properly formatting and drafting standard legal affidavits required for lost IDs, SIM registration, school undertakings, and senior pension claims.', '/assets/services/brgy_clearance_cert_1794197711166.jpg', 'Active', 'Paralegal Drafting', 'Year-Round Service', 'All Residents in Need of Legal Templates', '1 - 2 Business Hours', 'Free Legal Document Drafting', '["Valid Resident ID","Details of lost item (ID number, date lost, circumstance) or transaction"]', '["Resident of Barangay Bugo","Affidavit must be truthful and compliant with Philippine law"]'),
('prog-emergency-disaster-prep', 'Disaster Preparedness and Response', 'Community and Emergency Services', 'BDRRMC typhoon monitoring, flood alert sirens, emergency rescue dispatch, and risk mapping.', 'Barangay Disaster Risk Reduction and Management Council (BDRRMC) 24/7 command operation coordinating emergency communications, flood monitoring for Bugo river waterways, and swift water rescue dispatch.', '/assets/services/brgy_disaster_rescue_1794197713383.jpg', 'Active', '24/7 BDRRMC Alert', '24/7 Emergency Dispatch', 'All Bugo Puroks, Coastal & Riverine Zones', 'Immediate Response', 'Emergency Rescue & First Aid', '["Emergency location and contact person","Nature of emergency (Flood, Landslide, Fire, Medical)"]', '["Any emergency or disaster incident within Barangay Bugo"]'),
('prog-emergency-evacuation', 'Evacuation Assistance', 'Community and Emergency Services', 'Pre-emptive evacuation transport, shelter management, hot meals, and family reunification.', 'Organized emergency vehicles and designated Bugo evacuation shelters (Bugo Covered Court, Bugo Central School) equipped with emergency generator sets, sleeping cots, sanitation, and relief supply storage.', '/assets/services/brgy_disaster_rescue_1794197713383.jpg', 'Active', 'Shelter & Transport', 'Active During Severe Weather & Calamities', 'Residents in Flood-Prone & High-Risk Zones', 'Immediate Priority Dispatch', 'Safe Shelter, Hot Meals & Transport', '["Purok location & number of vulnerable family members (Infants, PWD, Seniors)"]', '["Families threatened by floodwaters, typhoon storm surge, or fire"]'),
('prog-emergency-safety-tanod', 'Community Safety and Security Coordination', 'Community and Emergency Services', '24/7 Barangay Tanod patrols, night security escorts, curfew monitoring, and police coordination.', 'Barangay Peacekeeping Action Team (BPAT) conducting motorized mobile patrols, maintaining peace in commercial alleys, securing public transport hubs, and deterring nighttime criminal activity.', '/assets/services/brgy_disaster_rescue_1794197713383.jpg', 'Active', '24/7 BPAT Tanod', 'Round-the-Clock Patrols', 'All Neighborhoods, Business Strips, & Puroks', 'Immediate Field Dispatch', 'Patrol & Law Enforcement Coordination', '["Incident location / Purok","Caller identity or anonymous security alert details"]', '["Applies to all public and residential sectors of Barangay Bugo"]'),
('prog-emergency-community-activities', 'Community Programs and Activities', 'Community and Emergency Services', 'Youth SK basketball leagues, coastal clean-ups, tree planting, and cultural fiesta celebrations.', 'Civic enrichment activities promoting environmental sustainability, community solidarity, sports development, anti-drug awareness seminars, and vibrant cultural festivities in Barangay Bugo.', '/assets/services/brgy_youth_sports_1794197737990.jpg', 'Active', 'Civic Programs', 'Seasonal & Event Calendars', 'Youth, SK Members, Families, & Civic Groups', 'Open Registration per Event', 'Community Sports, Medals & Participation', '["Barangay Resident ID or SK Youth Registration Form","Signed event participant waiver (for sports events)"]', '["Resident of Barangay Bugo","Open to all community members"]');

-- ------------------------------------------------------------------------------
-- SEED: census_puroks (Demographic census for Zones 1-10)
-- ------------------------------------------------------------------------------
INSERT INTO `census_puroks` (`purok_name`, `population`, `households`) VALUES
('Zone 1', 4820, 1205),
('Zone 2', 4150, 1038),
('Zone 3', 3920, 980),
('Zone 4', 3450, 863),
('Zone 5', 3810, 953),
('Zone 6', 3650, 912),
('Zone 7', 2980, 745),
('Zone 8', 3240, 810),
('Zone 9', 3110, 778),
('Zone 10', 3710, 926);

-- ------------------------------------------------------------------------------
-- SEED: notifications
-- ------------------------------------------------------------------------------
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `is_read`, `type`, `timestamp`, `application_ref`, `target_area`, `document_data_json`) VALUES
('notif-1794067398272', 'user-maria-santos', 'Educational Grant Approved & Scheduled', 'Your Educational Support Grant application BG-2026-8840 has been verified and approved. Schedule of release: Nov 15, 2026 at the Barangay Bugo Treasury Office.', 0, 'status_update', 'Nov 8, 2026 • 9:10 PM', 'BG-2026-8840', 'services', '{"docType":"Official Approval Voucher","controlNumber":"VCH-2026-8840","recipientName":"Joshua Abella Laurio","issueDate":"November 8, 2026","subject":"Barangay Bugo Educational Assistance Grant Release","narrative":"This official voucher confirms the approval of tuition and textbook assistance subsidy in the amount of Php 5,000 under the Barangay Bugo Youth Development Fund.","venueOrOffice":"Barangay Bugo Treasury & Cashier Desk, Cagayan de Oro City","officialRemarks":"Present this digital voucher and a valid School ID upon claiming check or cash disbursement.","signatoryName":"Hon. Juan Dela Cruz","signatoryRole":"Punong Barangay"}'),
('notif-2', 'user-pedro-reyes', 'Medical Aid Application Under Review', 'Assistance Filing BG-2026-9120 has been received and verified under the Barangay Bugo Health Desk assistance pipeline.', 0, 'status_update', 'Nov 8, 2026 • 4:15 PM', 'BG-2026-9120', 'dashboard', '{"docType":"Assistance Approval Voucher","controlNumber":"VCH-2026-9120","recipientName":"Pedro Reyes","issueDate":"November 8, 2026","subject":"Official Status Docket: Financial Medical Subsidy Referral","narrative":"This official certification acknowledges that resident assistance claim BG-2026-9120 has been logged into the Secretariat pipeline. Eligibility criteria under Northern Mindanao Medical Center (NMMC) subsidy referral are undergoing review.","venueOrOffice":"Barangay Bugo Health & Social Services Desk","officialRemarks":"Valid Government ID and Doctor Prescription verified by Barangay Social Worker.","signatoryName":"Hon. Juan Dela Cruz","signatoryRole":"Punong Barangay"}'),
('notif-3', 'all', 'New Service Open: Barangay Educational Scholarship 2026', 'Official applications are now open for the 2026 Tertiary Education Student Assistance Grant. Registered residents can apply online.', 1, 'announcement', 'Nov 7, 2026 • 9:00 AM', NULL, 'services', '{"docType":"Official Administrative Advisory","controlNumber":"ADV-2026-1107","recipientName":"To All Bona Fide Bugo Residents & Students","issueDate":"November 7, 2026","subject":"Official Advisory: Opening of Sangguniang Kabataan & Barangay Scholarship Grant 2026","narrative":"Notice is hereby given to all college and vocational students residing in Zones 1 to 10 that the application period for the Barangay Bugo Educational Assistance Subsidy is officially active.","venueOrOffice":"Sangguniang Kabataan Council Office & Bugo Resident Desk","officialRemarks":"Submit Certificate of Registration (COR) and Barangay Certificate of Indigency.","signatoryName":"Hon. Juan Dela Cruz","signatoryRole":"Punong Barangay"}');

SET FOREIGN_KEY_CHECKS = 1;

-- ==============================================================================
-- END OF MYSQL INITIALIZATION SCRIPT
-- Database: barangay_bugo_db | Tables: 8 | Services: 44 | Status: Verified
-- ==============================================================================
