-- ==============================================================================
-- Prisma Initial MySQL Migration: Barangay Bugo Resident Assistance System
-- Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci | Engine: InnoDB
-- ==============================================================================

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` VARCHAR(32) NOT NULL DEFAULT 'resident',
    `contact_number` VARCHAR(32) NOT NULL,
    `purok` VARCHAR(128) NOT NULL,
    `address` TEXT NOT NULL,
    `resident_id_number` VARCHAR(64) NOT NULL,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `registration_status` VARCHAR(64) NOT NULL DEFAULT 'Pending Approval',
    `is_banned` BOOLEAN NOT NULL DEFAULT false,
    `ban_reason` TEXT NULL,
    `registered_date` VARCHAR(32) NOT NULL,
    `nationality` VARCHAR(64) NOT NULL DEFAULT 'Filipino',
    `occupation` VARCHAR(128) NULL,
    `employment_status` VARCHAR(64) NULL,
    `household_income` VARCHAR(64) NULL,
    `family_members_count` INTEGER NOT NULL DEFAULT 1,
    `voter_status` VARCHAR(64) NOT NULL DEFAULT 'Registered',
    `age` INTEGER NULL,
    `gender` VARCHAR(32) NULL,
    `avatar_url` LONGTEXT NULL,
    `pending_profile_json` JSON NULL,
    `extra_profile_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_resident_id_number_key`(`resident_id_number`),
    INDEX `idx_users_role`(`role`),
    INDEX `idx_users_purok`(`purok`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assistance_programs` (
    `id` VARCHAR(64) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `category` VARCHAR(128) NOT NULL,
    `tagline` TEXT NULL,
    `description` TEXT NOT NULL,
    `image_url` TEXT NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'Active',
    `badge_text` VARCHAR(64) NULL,
    `deadline` VARCHAR(128) NULL,
    `target_audience` VARCHAR(191) NULL,
    `processing_time` VARCHAR(128) NULL,
    `max_benefit_amount` VARCHAR(128) NULL,
    `allocated_budget` DECIMAL(14, 2) NOT NULL DEFAULT 500000.00,
    `disbursed_budget` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `slots_available` INTEGER NOT NULL DEFAULT 100,
    `total_slots` INTEGER NOT NULL DEFAULT 100,
    `requirements_json` JSON NULL,
    `eligibility_criteria_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_programs_category`(`category`),
    INDEX `idx_programs_status`(`status`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assistance_applications` (
    `id` VARCHAR(64) NOT NULL,
    `reference_code` VARCHAR(64) NOT NULL,
    `program_id` VARCHAR(64) NOT NULL,
    `program_title` VARCHAR(191) NOT NULL,
    `program_category` VARCHAR(128) NULL,
    `applicant_user_id` VARCHAR(64) NOT NULL,
    `applicant_name` VARCHAR(191) NOT NULL,
    `contact_number` VARCHAR(32) NOT NULL,
    `email` VARCHAR(191) NULL,
    `purok` VARCHAR(128) NOT NULL,
    `address` TEXT NULL,
    `household_monthly_income` VARCHAR(64) NULL,
    `family_members_count` INTEGER NULL,
    `occupation` VARCHAR(128) NULL,
    `purpose_or_diagnosis` TEXT NULL,
    `status` VARCHAR(64) NOT NULL DEFAULT 'Submitted',
    `submission_date` VARCHAR(64) NOT NULL,
    `last_updated` VARCHAR(64) NULL,
    `requested_amount` VARCHAR(64) NULL,
    `approved_amount` VARCHAR(64) NULL,
    `evaluator_notes` TEXT NULL,
    `rejection_reason` TEXT NULL,
    `priority_score` VARCHAR(32) NULL,
    `supporting_documents_json` JSON NULL,
    `timeline_json` JSON NULL,
    `eligibility_json` JSON NULL,
    `official_receipt_number` VARCHAR(64) NULL,
    `payment_method` VARCHAR(64) NULL,
    `disbursed_by` VARCHAR(191) NULL,
    `disbursed_at` VARCHAR(64) NULL,
    `resubmitted_at` VARCHAR(64) NULL,
    `resubmitted_note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `assistance_applications_reference_code_key`(`reference_code`),
    INDEX `idx_apps_user`(`applicant_user_id`),
    INDEX `idx_apps_program`(`program_id`),
    INDEX `idx_apps_status`(`status`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcements` (
    `id` VARCHAR(64) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `category` VARCHAR(64) NOT NULL,
    `description` TEXT NOT NULL,
    `publish_date` VARCHAR(64) NOT NULL,
    `views_count` INTEGER NOT NULL DEFAULT 0,
    `icon_type` VARCHAR(64) NOT NULL DEFAULT 'general',
    `is_pinned` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(32) NOT NULL DEFAULT 'Published',
    `target_audience_type` VARCHAR(128) NULL,
    `extra_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_announcements_category`(`category`),
    INDEX `idx_announcements_pinned`(`is_pinned`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `census_puroks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purok_name` VARCHAR(128) NOT NULL,
    `population` INTEGER NOT NULL DEFAULT 0,
    `households` INTEGER NOT NULL DEFAULT 0,
    `registered_voters` INTEGER NOT NULL DEFAULT 0,
    `senior_citizens` INTEGER NOT NULL DEFAULT 0,
    `working_age` INTEGER NOT NULL DEFAULT 0,
    `minors` INTEGER NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `census_puroks_purok_name_key`(`purok_name`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(64) NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `type` VARCHAR(64) NOT NULL DEFAULT 'system',
    `timestamp` VARCHAR(64) NOT NULL,
    `application_ref` VARCHAR(64) NULL,
    `target_area` VARCHAR(64) NULL,
    `document_data_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_notifications_user`(`user_id`),
    INDEX `idx_notifications_read`(`is_read`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
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

    INDEX `idx_activity_actor`(`resident_id_number`),
    INDEX `idx_activity_action`(`action_type`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `archived_records` (
    `id` VARCHAR(64) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `record_type` VARCHAR(64) NOT NULL,
    `record_reference` VARCHAR(128) NOT NULL,
    `archived_by` VARCHAR(191) NOT NULL,
    `deleted_at` VARCHAR(64) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'Archived',
    `reason` TEXT NULL,
    `payload_json` JSON NULL,
    `archived_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_archives_type`(`record_type`),
    INDEX `idx_archives_reference`(`record_reference`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `assistance_applications` ADD CONSTRAINT `assistance_applications_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `assistance_programs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assistance_applications` ADD CONSTRAINT `assistance_applications_applicant_user_id_fkey` FOREIGN KEY (`applicant_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
