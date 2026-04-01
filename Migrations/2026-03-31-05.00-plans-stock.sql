ALTER TABLE `featherpanel_billingplans_plans`
    ADD COLUMN `max_subscriptions` INT(11) NULL DEFAULT NULL COMMENT 'Max active subscriptions (NULL = unlimited)' AFTER `is_active`;
