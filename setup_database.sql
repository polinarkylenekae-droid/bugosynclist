-- ==============================================================================
-- Database Setup Script for Barangay Bugo Resident Assistance Management System
-- ==============================================================================

-- Create the database with utf8mb4 character set
CREATE DATABASE IF NOT EXISTS `barangay_bugo_db`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

-- Create dedicated database user
CREATE USER IF NOT EXISTS 'bugo_user'@'localhost' IDENTIFIED BY 'BugoStrong2026Pass';
CREATE USER IF NOT EXISTS 'bugo_user'@'127.0.0.1' IDENTIFIED BY 'BugoStrong2026Pass';

-- Grant all privileges on the barangay_bugo_db database
GRANT ALL PRIVILEGES ON barangay_bugo_db.* TO 'bugo_user'@'localhost';
GRANT ALL PRIVILEGES ON barangay_bugo_db.* TO 'bugo_user'@'127.0.0.1';

-- Apply the privilege changes
FLUSH PRIVILEGES;

-- Show confirmation
SELECT 'Database barangay_bugo_db created successfully with user bugo_user' AS Status;
