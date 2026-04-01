CREATE TABLE IF NOT EXISTS `featherpanel_billingplans_subscriptions` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL,
    `plan_id` INT(11) NOT NULL,
    `server_uuid` VARCHAR(36) NULL DEFAULT NULL COMMENT 'UUID of the server linked to this subscription',
    `status` ENUM('pending','active','suspended','cancelled','expired') NOT NULL DEFAULT 'pending',
    `next_renewal_at` TIMESTAMP NULL DEFAULT NULL,
    `suspended_at` TIMESTAMP NULL DEFAULT NULL,
    `cancelled_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_billingplans_sub_user` (`user_id`),
    KEY `idx_billingplans_sub_plan` (`plan_id`),
    KEY `idx_billingplans_sub_status` (`status`),
    KEY `idx_billingplans_sub_renewal` (`next_renewal_at`),
    CONSTRAINT `fk_billingplans_sub_user`
        FOREIGN KEY (`user_id`)
        REFERENCES `featherpanel_users` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_billingplans_sub_plan`
        FOREIGN KEY (`plan_id`)
        REFERENCES `featherpanel_billingplans_plans` (`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
