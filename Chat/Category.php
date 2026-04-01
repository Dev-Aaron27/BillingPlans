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

class Category
{
    private static string $table = 'featherpanel_billingplans_categories';

    public static function getById(int $id): ?array
    {
        $pdo = Database::getPdoConnection();
        $stmt = $pdo->prepare('SELECT * FROM ' . self::$table . ' WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);

        return $stmt->fetch(\PDO::FETCH_ASSOC) ?: null;
    }

    /** @return array[] */
    public static function getAll(bool $activeOnly = false): array
    {
        $pdo = Database::getPdoConnection();
        $sql = 'SELECT * FROM ' . self::$table;
        if ($activeOnly) {
            $sql .= ' WHERE is_active = 1';
        }
        $sql .= ' ORDER BY sort_order ASC, name ASC';
        $stmt = $pdo->query($sql);

        return $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];
    }

    public static function getPaginated(int $page, int $limit, string $search = ''): array
    {
        $pdo = Database::getPdoConnection();
        $offset = ($page - 1) * $limit;
        $params = [];
        $where = '';

        if (!empty($search)) {
            $where = 'WHERE name LIKE :search OR description LIKE :search';
            $params['search'] = '%' . $search . '%';
        }

        $countStmt = $pdo->prepare('SELECT COUNT(*) as count FROM ' . self::$table . ' ' . $where);
        $countStmt->execute($params);
        $total = (int) $countStmt->fetch(\PDO::FETCH_ASSOC)['count'];

        $sql = 'SELECT * FROM ' . self::$table . ' ' . $where . ' ORDER BY sort_order ASC, name ASC LIMIT :limit OFFSET :offset';
        $stmt = $pdo->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue(':' . $k, $v);
        }
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);
        $stmt->execute();

        return ['data' => $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [], 'total' => $total];
    }

    public static function create(array $data): ?int
    {
        $pdo = Database::getPdoConnection();
        $stmt = $pdo->prepare(
            'INSERT INTO ' . self::$table . ' (name, description, icon, color, sort_order, is_active)
             VALUES (:name, :description, :icon, :color, :sort_order, :is_active)'
        );
        $stmt->execute([
            'name' => trim($data['name']),
            'description' => isset($data['description']) && $data['description'] !== '' ? trim($data['description']) : null,
            'icon' => isset($data['icon']) && $data['icon'] !== '' ? trim($data['icon']) : null,
            'color' => isset($data['color']) && $data['color'] !== '' ? trim($data['color']) : null,
            'sort_order' => (int) ($data['sort_order'] ?? 0),
            'is_active' => isset($data['is_active']) ? (int) (bool) $data['is_active'] : 1,
        ]);

        $id = (int) $pdo->lastInsertId();

        return $id > 0 ? $id : null;
    }

    public static function update(int $id, array $data): bool
    {
        $pdo = Database::getPdoConnection();
        $allowed = ['name', 'description', 'icon', 'color', 'sort_order', 'is_active'];
        $sets = [];
        $params = ['id' => $id];

        foreach ($allowed as $field) {
            if (array_key_exists($field, $data)) {
                $sets[] = "`{$field}` = :{$field}";
                $params[$field] = $data[$field];
            }
        }

        if (empty($sets)) {
            return true;
        }

        $stmt = $pdo->prepare('UPDATE ' . self::$table . ' SET ' . implode(', ', $sets) . ' WHERE id = :id');

        return $stmt->execute($params);
    }

    public static function delete(int $id): bool
    {
        $pdo = Database::getPdoConnection();
        // Nullify plans that reference this category
        $pdo->prepare('UPDATE featherpanel_billingplans_plans SET category_id = NULL WHERE category_id = :id')
            ->execute(['id' => $id]);

        $stmt = $pdo->prepare('DELETE FROM ' . self::$table . ' WHERE id = :id');

        return $stmt->execute(['id' => $id]);
    }

    public static function getPlanCount(int $categoryId): int
    {
        $pdo = Database::getPdoConnection();
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) as count FROM featherpanel_billingplans_plans WHERE category_id = :id AND is_active = 1'
        );
        $stmt->execute(['id' => $categoryId]);

        return (int) ($stmt->fetch(\PDO::FETCH_ASSOC)['count'] ?? 0);
    }
}
