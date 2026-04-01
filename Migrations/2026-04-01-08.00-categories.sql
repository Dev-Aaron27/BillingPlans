CREATE TABLE IF NOT EXISTS `featherpanel_billingplans_categories` (
    `id`          INT(11)      NOT NULL AUTO_INCREMENT,
    `name`        VARCHAR(100) NOT NULL,
    `description` TEXT         NULL DEFAULT NULL,
    `icon`        VARCHAR(10)  NULL DEFAULT NULL COMMENT 'Emoji or 1-2 char icon',
    `color`       VARCHAR(30)  NULL DEFAULT NULL COMMENT 'Tailwind color name e.g. blue, emerald',
    `sort_order`  INT(11)      NOT NULL DEFAULT 0,
    `is_active`   TINYINT(1)   NOT NULL DEFAULT 1,
    `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `featherpanel_billingplans_plans`
    ADD COLUMN `category_id` INT(11) NULL DEFAULT NULL COMMENT 'FK to billingplans_categories' AFTER `id`;
