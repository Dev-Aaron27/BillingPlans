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

namespace App\Addons\billingplans\Controllers\Admin;

use App\Chat\Node;
use App\Chat\Realm;
use App\Chat\Spell;
use App\Chat\Activity;
use App\Helpers\ApiResponse;
use OpenApi\Attributes as OA;
use App\CloudFlare\CloudFlareRealIP;
use App\Addons\billingplans\Chat\Plan;
use App\Addons\billingplans\Chat\Category;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

#[OA\Tag(name: 'Admin - Billing Plans', description: 'Manage billing plans')]
class PlansController
{
    #[OA\Get(
        path: '/api/admin/billingplans/plans',
        summary: 'List all plans',
        tags: ['Admin - Billing Plans'],
        parameters: [
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', default: 1)),
            new OA\Parameter(name: 'limit', in: 'query', schema: new OA\Schema(type: 'integer', default: 20)),
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
        ],
        responses: [new OA\Response(response: 200, description: 'Plans retrieved successfully')]
    )]
    public function list(Request $request): Response
    {
        $page = max(1, (int) $request->query->get('page', 1));
        $limit = min(100, max(1, (int) $request->query->get('limit', 20)));
        $search = (string) $request->query->get('search', '');

        $result = Plan::getPaginated($page, $limit, $search);

        $categoryCache = [];
        foreach ($result['data'] as &$plan) {
            $plan['billing_period_label'] = Plan::getBillingPeriodLabel((int) $plan['billing_period_days']);
            $plan['active_subscription_count'] = Plan::getActiveSubscriptionCount((int) $plan['id']);
            if (isset($plan['server_config']) && is_string($plan['server_config'])) {
                $plan['server_config'] = json_decode($plan['server_config'], true);
            }
            $plan['allowed_realms'] = Plan::decodeIds($plan['allowed_realms'] ?? null);
            $plan['allowed_spells'] = Plan::decodeIds($plan['allowed_spells'] ?? null);
            $plan['user_can_choose_realm'] = (bool) ($plan['user_can_choose_realm'] ?? false);
            $plan['user_can_choose_spell'] = (bool) ($plan['user_can_choose_spell'] ?? false);
            $plan['category'] = self::resolveCategory((int) ($plan['category_id'] ?? 0), $categoryCache);
        }

        return ApiResponse::success([
            'data' => $result['data'],
            'meta' => [
                'pagination' => [
                    'total' => $result['total'],
                    'count' => count($result['data']),
                    'per_page' => $limit,
                    'current_page' => $page,
                    'total_pages' => (int) ceil($result['total'] / max(1, $limit)),
                ],
            ],
        ], 'Plans retrieved successfully', 200);
    }

    #[OA\Get(
        path: '/api/admin/billingplans/plans/{planId}',
        summary: 'Get a plan',
        tags: ['Admin - Billing Plans'],
        parameters: [new OA\Parameter(name: 'planId', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Plan retrieved successfully'),
            new OA\Response(response: 404, description: 'Plan not found'),
        ]
    )]
    public function get(Request $request, int $planId): Response
    {
        $plan = Plan::getById($planId);
        if ($plan === null) {
            return ApiResponse::error('Plan not found', 'PLAN_NOT_FOUND', 404);
        }

        $plan['billing_period_label'] = Plan::getBillingPeriodLabel((int) $plan['billing_period_days']);
        if (isset($plan['server_config']) && is_string($plan['server_config'])) {
            $plan['server_config'] = json_decode($plan['server_config'], true);
        }
        $plan['allowed_realms'] = Plan::decodeIds($plan['allowed_realms'] ?? null);
        $plan['allowed_spells'] = Plan::decodeIds($plan['allowed_spells'] ?? null);
        $plan['user_can_choose_realm'] = (bool) ($plan['user_can_choose_realm'] ?? false);
        $plan['user_can_choose_spell'] = (bool) ($plan['user_can_choose_spell'] ?? false);
        $noCache = [];
        $plan['category'] = self::resolveCategory((int) ($plan['category_id'] ?? 0), $noCache);

        return ApiResponse::success($plan, 'Plan retrieved successfully', 200);
    }

    #[OA\Post(
        path: '/api/admin/billingplans/plans',
        summary: 'Create a plan',
        tags: ['Admin - Billing Plans'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'price_credits', 'billing_period_days'],
                properties: [
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'description', type: 'string', nullable: true),
                    new OA\Property(property: 'price_credits', type: 'integer', minimum: 0),
                    new OA\Property(property: 'billing_period_days', type: 'integer', minimum: 1, description: 'Billing cycle in days (7=weekly, 30=monthly, 365=yearly)'),
                    new OA\Property(property: 'is_active', type: 'boolean'),
                    new OA\Property(property: 'server_config', type: 'object', nullable: true),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Plan created successfully'),
            new OA\Response(response: 400, description: 'Invalid input'),
        ]
    )]
    public function create(Request $request): Response
    {
        $admin = $request->get('user');
        $data = json_decode($request->getContent(), true);

        if ($data === null) {
            return ApiResponse::error('Invalid JSON', 'INVALID_JSON', 400);
        }

        if (empty($data['name'])) {
            return ApiResponse::error('Plan name is required', 'MISSING_NAME', 400);
        }

        $priceCredits = isset($data['price_credits']) ? (int) $data['price_credits'] : null;
        if ($priceCredits === null || $priceCredits < 0) {
            return ApiResponse::error('price_credits must be a non-negative integer', 'INVALID_PRICE', 400);
        }

        $billingPeriodDays = isset($data['billing_period_days']) ? (int) $data['billing_period_days'] : null;
        if ($billingPeriodDays === null || $billingPeriodDays < 1) {
            return ApiResponse::error('billing_period_days must be at least 1', 'INVALID_PERIOD', 400);
        }

        $planId = Plan::create([
            'category_id' => isset($data['category_id']) && $data['category_id'] ? (int) $data['category_id'] : null,
            'name' => trim($data['name']),
            'description' => isset($data['description']) ? trim($data['description']) : null,
            'long_description' => isset($data['long_description']) ? trim($data['long_description']) : null,
            'price_credits' => $priceCredits,
            'billing_period_days' => $billingPeriodDays,
            'is_active' => isset($data['is_active']) ? (int) filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN) : 1,
            'max_subscriptions' => (isset($data['max_subscriptions']) && $data['max_subscriptions'] !== null && $data['max_subscriptions'] !== '') ? max(1, (int) $data['max_subscriptions']) : null,
            'server_config' => $data['server_config'] ?? null,
            'node_id' => isset($data['node_id']) && $data['node_id'] ? (int) $data['node_id'] : null,
            'realms_id' => isset($data['realms_id']) && $data['realms_id'] ? (int) $data['realms_id'] : null,
            'user_can_choose_realm' => !empty($data['user_can_choose_realm']),
            'allowed_realms' => $data['allowed_realms'] ?? null,
            'spell_id' => isset($data['spell_id']) && $data['spell_id'] ? (int) $data['spell_id'] : null,
            'user_can_choose_spell' => !empty($data['user_can_choose_spell']),
            'allowed_spells' => $data['allowed_spells'] ?? null,
            'memory' => (int) ($data['memory'] ?? 512),
            'cpu' => (int) ($data['cpu'] ?? 100),
            'disk' => (int) ($data['disk'] ?? 1024),
            'swap' => (int) ($data['swap'] ?? 0),
            'io' => (int) ($data['io'] ?? 500),
            'backup_limit' => (int) ($data['backup_limit'] ?? 0),
            'database_limit' => (int) ($data['database_limit'] ?? 0),
            'allocation_limit' => isset($data['allocation_limit']) && $data['allocation_limit'] !== null && $data['allocation_limit'] !== '' ? (int) $data['allocation_limit'] : null,
            'startup_override' => isset($data['startup_override']) && $data['startup_override'] !== '' ? trim($data['startup_override']) : null,
            'image_override' => isset($data['image_override']) && $data['image_override'] !== '' ? trim($data['image_override']) : null,
        ]);

        if ($planId === null) {
            return ApiResponse::error('Failed to create plan', 'CREATE_PLAN_FAILED', 500);
        }

        $plan = Plan::getById($planId);
        $plan['billing_period_label'] = Plan::getBillingPeriodLabel((int) $plan['billing_period_days']);

        Activity::createActivity([
            'user_uuid' => $admin['uuid'] ?? null,
            'name' => 'billingplans_create_plan',
            'context' => "Created billing plan: {$plan['name']} (ID: {$planId}, price: {$priceCredits} credits, period: {$billingPeriodDays} days)",
            'ip_address' => CloudFlareRealIP::getRealIP(),
        ]);

        return ApiResponse::success($plan, 'Plan created successfully', 200);
    }

    #[OA\Patch(
        path: '/api/admin/billingplans/plans/{planId}',
        summary: 'Update a plan',
        tags: ['Admin - Billing Plans'],
        parameters: [new OA\Parameter(name: 'planId', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'description', type: 'string', nullable: true),
                    new OA\Property(property: 'price_credits', type: 'integer', minimum: 0),
                    new OA\Property(property: 'billing_period_days', type: 'integer', minimum: 1),
                    new OA\Property(property: 'is_active', type: 'boolean'),
                    new OA\Property(property: 'server_config', type: 'object', nullable: true),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Plan updated successfully'),
            new OA\Response(response: 404, description: 'Plan not found'),
        ]
    )]
    public function update(Request $request, int $planId): Response
    {
        $admin = $request->get('user');
        $plan = Plan::getById($planId);
        if ($plan === null) {
            return ApiResponse::error('Plan not found', 'PLAN_NOT_FOUND', 404);
        }

        $data = json_decode($request->getContent(), true);
        if ($data === null) {
            return ApiResponse::error('Invalid JSON', 'INVALID_JSON', 400);
        }

        $updateData = [];
        if (array_key_exists('category_id', $data)) {
            $updateData['category_id'] = $data['category_id'] ? (int) $data['category_id'] : null;
        }
        if (isset($data['name'])) {
            $updateData['name'] = trim($data['name']);
        }
        if (array_key_exists('description', $data)) {
            $updateData['description'] = isset($data['description']) ? trim($data['description']) : null;
        }
        if (array_key_exists('long_description', $data)) {
            $updateData['long_description'] = isset($data['long_description']) && $data['long_description'] !== '' ? trim($data['long_description']) : null;
        }
        if (isset($data['price_credits'])) {
            $updateData['price_credits'] = max(0, (int) $data['price_credits']);
        }
        if (isset($data['billing_period_days'])) {
            $updateData['billing_period_days'] = max(1, (int) $data['billing_period_days']);
        }
        if (isset($data['is_active'])) {
            $updateData['is_active'] = (int) filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN);
        }
        if (array_key_exists('server_config', $data)) {
            $updateData['server_config'] = $data['server_config'];
        }
        if (array_key_exists('max_subscriptions', $data)) {
            $updateData['max_subscriptions'] = ($data['max_subscriptions'] !== null && $data['max_subscriptions'] !== '') ? max(1, (int) $data['max_subscriptions']) : null;
        }
        if (array_key_exists('node_id', $data)) {
            $updateData['node_id'] = $data['node_id'] ? (int) $data['node_id'] : null;
        }
        if (array_key_exists('realms_id', $data)) {
            $updateData['realms_id'] = $data['realms_id'] ? (int) $data['realms_id'] : null;
        }
        if (array_key_exists('user_can_choose_realm', $data)) {
            $updateData['user_can_choose_realm'] = !empty($data['user_can_choose_realm']);
        }
        if (array_key_exists('allowed_realms', $data)) {
            $updateData['allowed_realms'] = $data['allowed_realms'];
        }
        if (array_key_exists('spell_id', $data)) {
            $updateData['spell_id'] = $data['spell_id'] ? (int) $data['spell_id'] : null;
        }
        if (array_key_exists('user_can_choose_spell', $data)) {
            $updateData['user_can_choose_spell'] = !empty($data['user_can_choose_spell']);
        }
        if (array_key_exists('allowed_spells', $data)) {
            $updateData['allowed_spells'] = $data['allowed_spells'];
        }
        foreach (['memory', 'cpu', 'disk', 'swap', 'io', 'backup_limit', 'database_limit'] as $intField) {
            if (isset($data[$intField])) {
                $updateData[$intField] = max(0, (int) $data[$intField]);
            }
        }
        if (array_key_exists('allocation_limit', $data)) {
            $updateData['allocation_limit'] = ($data['allocation_limit'] !== null && $data['allocation_limit'] !== '') ? (int) $data['allocation_limit'] : null;
        }
        if (array_key_exists('startup_override', $data)) {
            $updateData['startup_override'] = ($data['startup_override'] !== null && $data['startup_override'] !== '') ? trim($data['startup_override']) : null;
        }
        if (array_key_exists('image_override', $data)) {
            $updateData['image_override'] = ($data['image_override'] !== null && $data['image_override'] !== '') ? trim($data['image_override']) : null;
        }

        if (!Plan::update($planId, $updateData)) {
            return ApiResponse::error('Failed to update plan', 'UPDATE_PLAN_FAILED', 500);
        }

        $updated = Plan::getById($planId);
        $updated['billing_period_label'] = Plan::getBillingPeriodLabel((int) $updated['billing_period_days']);
        if (isset($updated['server_config']) && is_string($updated['server_config'])) {
            $updated['server_config'] = json_decode($updated['server_config'], true);
        }

        Activity::createActivity([
            'user_uuid' => $admin['uuid'] ?? null,
            'name' => 'billingplans_update_plan',
            'context' => "Updated billing plan: {$updated['name']} (ID: {$planId})",
            'ip_address' => CloudFlareRealIP::getRealIP(),
        ]);

        return ApiResponse::success($updated, 'Plan updated successfully', 200);
    }

    #[OA\Delete(
        path: '/api/admin/billingplans/plans/{planId}',
        summary: 'Delete a plan',
        tags: ['Admin - Billing Plans'],
        parameters: [new OA\Parameter(name: 'planId', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Plan deleted successfully'),
            new OA\Response(response: 404, description: 'Plan not found'),
        ]
    )]
    public function delete(Request $request, int $planId): Response
    {
        $admin = $request->get('user');
        $plan = Plan::getById($planId);
        if ($plan === null) {
            return ApiResponse::error('Plan not found', 'PLAN_NOT_FOUND', 404);
        }

        if (!Plan::delete($planId)) {
            return ApiResponse::error('Failed to delete plan. Make sure there are no active subscriptions for this plan.', 'DELETE_PLAN_FAILED', 500);
        }

        Activity::createActivity([
            'user_uuid' => $admin['uuid'] ?? null,
            'name' => 'billingplans_delete_plan',
            'context' => "Deleted billing plan: {$plan['name']} (ID: {$planId})",
            'ip_address' => CloudFlareRealIP::getRealIP(),
        ]);

        return ApiResponse::success([], 'Plan deleted successfully', 200);
    }

    #[OA\Get(
        path: '/api/admin/billingplans/options',
        summary: 'Get nodes, realms and spells for plan creation',
        tags: ['Admin - Billing Plans'],
        responses: [new OA\Response(response: 200, description: 'Options retrieved successfully')]
    )]
    public function getOptions(Request $request): Response
    {
        $nodes = array_map(fn ($n) => ['id' => $n['id'], 'name' => $n['name'], 'location_id' => $n['location_id'] ?? null], Node::getAllNodes() ?: []);
        $allRealms = Realm::getAll(null, 500, 0) ?: [];
        $realms = array_map(fn ($r) => ['id' => $r['id'], 'name' => $r['name']], $allRealms);
        $allSpells = Spell::getAllSpells() ?: [];
        $spells = array_map(fn ($s) => [
            'id' => $s['id'],
            'name' => $s['name'],
            'realm_id' => $s['realm_id'] ?? null,
            'startup' => $s['startup'] ?? null,
            'docker_image' => $s['docker_image'] ?? null,
            'docker_images' => $s['docker_images'] ?? null,
        ], $allSpells);

        $allCategories = Category::getAll(false);
        $categories = array_map(fn ($c) => [
            'id' => (int) $c['id'],
            'name' => $c['name'],
            'icon' => $c['icon'],
            'color' => $c['color'],
            'is_active' => (bool) $c['is_active'],
        ], $allCategories);

        return ApiResponse::success([
            'nodes' => array_values($nodes),
            'realms' => array_values($realms),
            'spells' => array_values($spells),
            'categories' => array_values($categories),
        ], 'Options retrieved successfully', 200);
    }

    /** @param array<int,array<string,mixed>> $cache */
    private static function resolveCategory(int $id, array &$cache): ?array
    {
        if (!$id) {
            return null;
        }
        if (!array_key_exists($id, $cache)) {
            $cat = Category::getById($id);
            $cache[$id] = $cat ? ['id' => (int) $cat['id'], 'name' => $cat['name'], 'icon' => $cat['icon'], 'color' => $cat['color']] : null;
        }

        return $cache[$id];
    }
}
