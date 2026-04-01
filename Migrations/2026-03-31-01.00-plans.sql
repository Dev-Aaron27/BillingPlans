CREATE TABLE IF NOT EXISTS `featherpanel_billingplans_plans` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL DEFAULT NULL,
    `price_credits` INT(11) NOT NULL DEFAULT 0,
    `billing_period_days` INT(11) NOT NULL DEFAULT 30 COMMENT 'Billing cycle length in days (7=weekly, 30=monthly, 90=quarterly, 365=yearly)',
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `server_config` JSON NULL DEFAULT NULL COMMENT 'Optional JSON spec for auto-provisioning a server on subscribe',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
