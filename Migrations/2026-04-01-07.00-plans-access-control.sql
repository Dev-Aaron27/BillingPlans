ALTER TABLE `featherpanel_billingplans_plans`
    ADD COLUMN `user_can_choose_realm` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'If 1, user picks a realm from allowed_realms on subscribe' AFTER `realms_id`,
    ADD COLUMN `allowed_realms`        JSON         NULL DEFAULT NULL COMMENT 'JSON array of realm IDs user may choose from (null = all)' AFTER `user_can_choose_realm`,
    ADD COLUMN `user_can_choose_spell` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'If 1, user picks a spell from allowed_spells on subscribe' AFTER `spell_id`,
    ADD COLUMN `allowed_spells`        JSON         NULL DEFAULT NULL COMMENT 'JSON array of spell IDs user may choose from (null = all)' AFTER `user_can_choose_spell`;
