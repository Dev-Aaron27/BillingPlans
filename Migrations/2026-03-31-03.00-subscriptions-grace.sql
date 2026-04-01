ALTER TABLE `featherpanel_billingplans_subscriptions`
    ADD COLUMN `grace_started_at` DATETIME NULL DEFAULT NULL AFTER `suspended_at`;
