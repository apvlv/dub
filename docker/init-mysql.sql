-- Dub MySQL Initialization Script
-- This script runs on first container startup to initialize the database

-- Set character encoding
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Create database if not exists (may already exist from MYSQL_DATABASE env)
CREATE DATABASE IF NOT EXISTS `dub`
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE `dub`;

-- Grant privileges to the dub user
GRANT ALL PRIVILEGES ON `dub`.* TO 'dub'@'%';
FLUSH PRIVILEGES;

-- Create a health check table for container health checks
CREATE TABLE IF NOT EXISTS `_health_check` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert a test record for health checks
INSERT INTO `_health_check` (`id`) VALUES (1) ON DUPLICATE KEY UPDATE `created_at` = CURRENT_TIMESTAMP;

-- Note: Actual schema will be managed by Prisma migrations
-- Run `pnpm prisma:push` or `pnpm prisma migrate deploy` after the container starts

-- Performance tuning settings (optional, can be configured via command line instead)
-- These are informational comments for reference:
--
-- Recommended my.cnf settings for production:
-- [mysqld]
-- innodb_buffer_pool_size = 1G
-- innodb_log_file_size = 256M
-- innodb_flush_log_at_trx_commit = 2
-- innodb_flush_method = O_DIRECT
-- max_connections = 500
-- query_cache_type = 0
-- tmp_table_size = 64M
-- max_heap_table_size = 64M
