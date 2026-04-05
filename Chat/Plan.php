<?php

/*
 * This file is part of FeatherPanel.
 *
 * Copyright (C) 2025 MythicalSystems Studios
 * Copyright (C) 2025 FeatherPanel Contributors
 * Copyright (C) 2025 Cassian Gherman (aka NaysKutzu)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * See the LICENSE file or <https://www.gnu.org/licenses/>.
 */

namespace App\Addons\billingplans\Chat;

use App\Chat\Database;

class Plan
{
    private static string $table = 'featherpanel_billingplans_plans';

    public static function getById(int $id): ?array
    {
        $pdo = Database::getPdoConnection();
        $stmt = $pdo->prepare('SELECT * FROM ' . self::$table . ' WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);

        return $stmt->fetch(\PDO::FETCH_ASSOC) ?: null;
    }

    public static function getAll(bool $activeOnly = false): array
    {
        $pdo = Database::getPdoConnection();
        $sql = 'SELECT * FROM ' . self::$table;
        if ($activeOnly) {
            $sql .= ' WHERE is_active = 1';
        }
        $sql .= ' ORDER BY price_credits ASC, name ASC';
        $stmt = $pdo->query($sql);

        return $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];
    }

    public static function getPaginated(int $page, int $limit, string $search = '', bool $activeOnly = false): array
    {
        $pdo = Database::getPdoConnection();
        $offset = ($page - 1) * $limit;
        $where = [];
        $params = [];

        if ($activeOnly) {
            $where[] = 'is_active = 1';
        }

        if (!empty($search)) {
            $where[] = '(name LIKE :search OR description LIKE :search)';
            $params['search'] = '%' . $search . '%';
        }

        $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        $countStmt = $pdo->prepare('SELECT COUNT(*) as count FROM ' . self::$table . ' ' . $whereClause);
        $countStmt->execute($params);
        $total = (int) $countStmt->fetch(\PDO::FETCH_ASSOC)['count'];

        $sql = 'SELECT * FROM ' . self::$table . ' ' . $whereClause . ' ORDER BY id DESC LIMIT :limit OFFSET :offset';
        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue(':' . $key, $value);
        }
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        return ['data' => $rows, 'total' => $total];
    }

    public static function create(array $data): ?int
    {
        $pdo = Database::getPdoConnection();
        $stmt = $pdo->prepare(
            'INSERT INTO ' . self::$table . '
             (category_id, name, description, long_description, price_credits, billing_period_days, is_active, max_subscriptions, server_config,
              node_ids, node_id, realms_id, user_can_choose_realm, allowed_realms,
              spell_id, user_can_choose_spell, allowed_spells,
              memory, cpu, disk, swap, io,
              backup_limit, database_limit, allocation_limit, startup_override, image_override)
             VALUES
             (:category_id, :name, :description, :long_description, :price_credits, :billing_period_days, :is_active, :max_subscriptions, :server_config,
              :node_ids, :node_id, :realms_id, :user_can_choose_realm, :allowed_realms,
              :spell_id, :user_can_choose_spell, :allowed_spells,
              :memory, :cpu, :disk, :swap, :io,
              :backup_limit, :database_limit, :allocation_limit, :startup_override, :image_override)'
        );
        $stmt->execute([
            'category_id' => isset($data['category_id']) && $data['category_id'] ? (int) $data['category_id'] : null,
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'long_description' => $data['long_description'] ?? null,
            'price_credits' => (int) ($data['price_credits'] ?? 0),
            'billing_period_days' => (int) ($data['billing_period_days'] ?? 30),
            'is_active' => isset($data['is_active']) ? (int) $data['is_active'] : 1,
            'server_config' => isset($data['server_config']) ? (is_array($data['server_config']) ? json_encode($data['server_config']) : $data['server_config']) : null,
            'max_subscriptions' => (isset($data['max_subscriptions']) && $data['max_subscriptions'] !== null && $data['max_subscriptions'] !== '') ? (int) $data['max_subscriptions'] : null,
            // Multi-node support: store node_ids as JSON, fallback to node_id for legacy
            'node_ids' => isset($data['node_ids']) && is_array($data['node_ids']) ? json_encode(array_map('intval', $data['node_ids'])) : (isset($data['node_id']) && $data['node_id'] ? json_encode([(int)$data['node_id']]) : null),
            'node_id' => isset($data['node_id']) && $data['node_id'] ? (int) $data['node_id'] : null, // legacy
            'realms_id' => isset($data['realms_id']) && $data['realms_id'] ? (int) $data['realms_id'] : null,
            'user_can_choose_realm' => isset($data['user_can_choose_realm']) ? (int) (bool) $data['user_can_choose_realm'] : 0,
            'allowed_realms' => self::encodeIds($data['allowed_realms'] ?? null),
            'spell_id' => isset($data['spell_id']) && $data['spell_id'] ? (int) $data['spell_id'] : null,
            'user_can_choose_spell' => isset($data['user_can_choose_spell']) ? (int) (bool) $data['user_can_choose_spell'] : 0,
            'allowed_spells' => self::encodeIds($data['allowed_spells'] ?? null),
            'memory' => (int) ($data['memory'] ?? 512),
            'cpu' => (int) ($data['cpu'] ?? 100),
            'disk' => (int) ($data['disk'] ?? 1024),
            'swap' => (int) ($data['swap'] ?? 0),
            'io' => (int) ($data['io'] ?? 500),
            'backup_limit' => (int) ($data['backup_limit'] ?? 0),
            'database_limit' => (int) ($data['database_limit'] ?? 0),
            'allocation_limit' => isset($data['allocation_limit']) && $data['allocation_limit'] !== null && $data['allocation_limit'] !== '' ? (int) $data['allocation_limit'] : null,
            'startup_override' => $data['startup_override'] ?? null,
            'image_override' => $data['image_override'] ?? null,
        ]);

        $insertId = (int) $pdo->lastInsertId();

        return $insertId > 0 ? $insertId : null;
    }

    public static function update(int $id, array $data): bool
    {
        $pdo = Database::getPdoConnection();
        $allowed = [
            'category_id',
            'name', 'description', 'long_description', 'price_credits', 'billing_period_days', 'is_active', 'max_subscriptions', 'server_config',
            'node_ids', 'node_id', 'realms_id', 'user_can_choose_realm', 'allowed_realms',
            'spell_id', 'user_can_choose_spell', 'allowed_spells',
            'memory', 'cpu', 'disk', 'swap', 'io',
            'backup_limit', 'database_limit', 'allocation_limit', 'startup_override', 'image_override',
        ];
        $sets = [];
        $params = ['id' => $id];
        foreach ($allowed as $field) {
            if (array_key_exists($field, $data)) {
                $sets[] = "`{$field}` = :{$field}";
                if ($field === 'server_config' && is_array($data[$field])) {
                    $params[$field] = json_encode($data[$field]);
                } elseif (in_array($field, ['allowed_realms', 'allowed_spells'], true)) {
                    $params[$field] = self::encodeIds($data[$field]);
                } elseif ($field === 'node_ids') {
                    $params[$field] = is_array($data[$field]) ? json_encode(array_map('intval', $data[$field])) : null;
                } elseif (in_array($field, ['user_can_choose_realm', 'user_can_choose_spell'], true)) {
                    $params[$field] = (int) (bool) $data[$field];
                } else {
                    $params[$field] = $data[$field];
                }
            }
        }

        if (empty($sets)) {
            return true;
        }

        $stmt = $pdo->prepare('UPDATE ' . self::$table . ' SET ' . implode(', ', $sets) . ' WHERE id = :id');

        return $stmt->execute($params);
    }

    /**
     * Normalize node selection for a plan (node_ids[] or legacy node_id)
     * @param array $plan
     * @return int[]
     */
    public static function getNodeIds(array $plan): array
    {
        if (!empty($plan['node_ids'])) {
            $ids = json_decode($plan['node_ids'], true);
            if (is_array($ids)) {
                return array_map('intval', $ids);
            }
        }
        if (!empty($plan['node_id'])) {
            return [(int)$plan['node_id']];
        }
        return [];
    }

    /** Count active/suspended subscriptions for a plan (for stock control). */
    public static function getActiveSubscriptionCount(int $planId): int
    {
        $pdo = Database::getPdoConnection();
        $stmt = $pdo->prepare(
            "SELECT COUNT(*) as count FROM featherpanel_billingplans_subscriptions
             WHERE plan_id = :plan_id AND status IN ('active','suspended','pending')"
        );
        $stmt->execute(['plan_id' => $planId]);

        return (int) ($stmt->fetch(\PDO::FETCH_ASSOC)['count'] ?? 0);
    }

    public static function delete(int $id): bool
    {
        $pdo = Database::getPdoConnection();
        $stmt = $pdo->prepare('DELETE FROM ' . self::$table . ' WHERE id = :id');

        return $stmt->execute(['id' => $id]);
    }

    /**
     * Decode a JSON ID list column (stored as JSON array of ints) → PHP int[].
     *
     * @return int[]
     */
    public static function decodeIds(mixed $raw): array
    {
        if ($raw === null || $raw === '') {
            return [];
        }
        if (is_array($raw)) {
            return array_values(array_map('intval', $raw));
        }
        $decoded = json_decode((string) $raw, true);

        return is_array($decoded) ? array_values(array_map('intval', $decoded)) : [];
    }

    public static function getBillingPeriodLabel(int $days): string
    {
        return match (true) {
            $days === 1 => 'Daily',
            $days === 7 => 'Weekly',
            $days === 14 => 'Bi-Weekly',
            $days === 30 => 'Monthly',
            $days === 60 => 'Every 2 Months',
            $days === 90 => 'Quarterly',
            $days === 180 => 'Semi-Annually',
            $days === 365 => 'Annually',
            default => "Every {$days} Days",
        };
    }

    /** Encode int[] → JSON string (or null if empty). */
    private static function encodeIds(mixed $raw): ?string
    {
        if ($raw === null || $raw === '') {
            return null;
        }
        if (is_string($raw)) {
            $decoded = json_decode($raw, true);
            $raw = is_array($decoded) ? $decoded : [];
        }
        if (!is_array($raw) || empty($raw)) {
            return null;
        }

        return json_encode(array_values(array_map('intval', $raw)));
    }
}
