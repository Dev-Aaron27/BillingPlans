ALTER TABLE `featherpanel_billingplans_subscriptions`
    ADD COLUMN `server_suspend_sync` TINYINT(1) NOT NULL DEFAULT 0
        COMMENT '1 = subscription suspended because panel server was suspended; unsuspend only reverses when this is 1'
        AFTER `suspended_at`;
