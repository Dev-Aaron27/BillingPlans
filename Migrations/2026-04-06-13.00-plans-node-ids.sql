ALTER TABLE `featherpanel_billingplans_plans`
    ADD COLUMN `node_ids` TEXT NULL DEFAULT NULL COMMENT 'JSON array of node IDs for multi-node support' AFTER `server_config`;