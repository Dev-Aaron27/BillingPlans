ALTER TABLE `featherpanel_billingplans_subscriptions`
    ADD COLUMN `admin_credits_refunded_total` INT(11) NOT NULL DEFAULT 0
        COMMENT 'Sum of credits returned to the user via admin refund actions'
        AFTER `server_suspend_sync`,
    ADD COLUMN `admin_refunded_at` TIMESTAMP NULL DEFAULT NULL
        COMMENT 'Timestamp of the most recent admin refund'
        AFTER `admin_credits_refunded_total`;
