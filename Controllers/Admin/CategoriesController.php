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

use App\Chat\Activity;
use App\Helpers\ApiResponse;
use OpenApi\Attributes as OA;
use App\CloudFlare\CloudFlareRealIP;
use App\Addons\billingplans\Chat\Category;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

#[OA\Tag(name: 'Admin - Billing Plan Categories', description: 'Manage billing plan categories')]
class CategoriesController
{
    #[OA\Get(
        path: '/api/admin/billingplans/categories',
        summary: 'List all categories',
        tags: ['Admin - Billing Plan Categories'],
        parameters: [
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', default: 1)),
            new OA\Parameter(name: 'limit', in: 'query', schema: new OA\Schema(type: 'integer', default: 50)),
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
        ],
        responses: [new OA\Response(response: 200, description: 'Categories retrieved successfully')]
    )]
    public function list(Request $request): Response
    {
        $page = max(1, (int) $request->query->get('page', 1));
        $limit = min(100, max(1, (int) $request->query->get('limit', 50)));
        $search = (string) $request->query->get('search', '');

        $result = Category::getPaginated($page, $limit, $search);

        foreach ($result['data'] as &$cat) {
            $cat['plan_count'] = Category::getPlanCount((int) $cat['id']);
            $cat['is_active'] = (bool) $cat['is_active'];
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
        ], 'Categories retrieved successfully', 200);
    }

    #[OA\Get(
        path: '/api/admin/billingplans/categories/{categoryId}',
        summary: 'Get a category',
        tags: ['Admin - Billing Plan Categories'],
        parameters: [new OA\Parameter(name: 'categoryId', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Category retrieved successfully'),
            new OA\Response(response: 404, description: 'Category not found'),
        ]
    )]
    public function get(Request $request, int $categoryId): Response
    {
        $cat = Category::getById($categoryId);
        if (!$cat) {
            return ApiResponse::error('Category not found', 'CATEGORY_NOT_FOUND', 404);
        }
        $cat['plan_count'] = Category::getPlanCount($categoryId);
        $cat['is_active'] = (bool) $cat['is_active'];

        return ApiResponse::success($cat, 'Category retrieved successfully', 200);
    }

    #[OA\Post(
        path: '/api/admin/billingplans/categories',
        summary: 'Create a category',
        tags: ['Admin - Billing Plan Categories'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name'],
                properties: [
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'description', type: 'string', nullable: true),
                    new OA\Property(property: 'icon', type: 'string', nullable: true),
                    new OA\Property(property: 'color', type: 'string', nullable: true),
                    new OA\Property(property: 'sort_order', type: 'integer'),
                    new OA\Property(property: 'is_active', type: 'boolean'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Category created successfully'),
            new OA\Response(response: 400, description: 'Invalid input'),
        ]
    )]
    public function create(Request $request): Response
    {
        $admin = $request->get('user');
        $data = json_decode($request->getContent(), true);

        if (!$data) {
            return ApiResponse::error('Invalid JSON', 'INVALID_JSON', 400);
        }
        if (empty($data['name'])) {
            return ApiResponse::error('Category name is required', 'MISSING_NAME', 400);
        }

        $id = Category::create($data);
        if (!$id) {
            return ApiResponse::error('Failed to create category', 'CREATE_FAILED', 500);
        }

        $cat = Category::getById($id);
        $cat['plan_count'] = 0;
        $cat['is_active'] = (bool) $cat['is_active'];

        Activity::createActivity([
            'user_uuid' => $admin['uuid'] ?? null,
            'name' => 'billingplans_create_category',
            'context' => "Created billing plan category: {$cat['name']} (ID: {$id})",
            'ip_address' => CloudFlareRealIP::getRealIP(),
        ]);

        return ApiResponse::success($cat, 'Category created successfully', 200);
    }

    #[OA\Patch(
        path: '/api/admin/billingplans/categories/{categoryId}',
        summary: 'Update a category',
        tags: ['Admin - Billing Plan Categories'],
        parameters: [new OA\Parameter(name: 'categoryId', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Category updated successfully'),
            new OA\Response(response: 404, description: 'Category not found'),
        ]
    )]
    public function update(Request $request, int $categoryId): Response
    {
        $admin = $request->get('user');
        $cat = Category::getById($categoryId);
        if (!$cat) {
            return ApiResponse::error('Category not found', 'CATEGORY_NOT_FOUND', 404);
        }

        $data = json_decode($request->getContent(), true);
        if (!$data) {
            return ApiResponse::error('Invalid JSON', 'INVALID_JSON', 400);
        }

        $updateData = [];
        if (isset($data['name'])) {
            $updateData['name'] = trim($data['name']);
        }
        if (array_key_exists('description', $data)) {
            $updateData['description'] = ($data['description'] !== null && $data['description'] !== '') ? trim($data['description']) : null;
        }
        if (array_key_exists('icon', $data)) {
            $updateData['icon'] = ($data['icon'] !== null && $data['icon'] !== '') ? trim($data['icon']) : null;
        }
        if (array_key_exists('color', $data)) {
            $updateData['color'] = ($data['color'] !== null && $data['color'] !== '') ? trim($data['color']) : null;
        }
        if (isset($data['sort_order'])) {
            $updateData['sort_order'] = (int) $data['sort_order'];
        }
        if (isset($data['is_active'])) {
            $updateData['is_active'] = (int) (bool) $data['is_active'];
        }

        if (!Category::update($categoryId, $updateData)) {
            return ApiResponse::error('Failed to update category', 'UPDATE_FAILED', 500);
        }

        $updated = Category::getById($categoryId);
        $updated['plan_count'] = Category::getPlanCount($categoryId);
        $updated['is_active'] = (bool) $updated['is_active'];

        Activity::createActivity([
            'user_uuid' => $admin['uuid'] ?? null,
            'name' => 'billingplans_update_category',
            'context' => "Updated billing plan category: {$updated['name']} (ID: {$categoryId})",
            'ip_address' => CloudFlareRealIP::getRealIP(),
        ]);

        return ApiResponse::success($updated, 'Category updated successfully', 200);
    }

    #[OA\Delete(
        path: '/api/admin/billingplans/categories/{categoryId}',
        summary: 'Delete a category',
        tags: ['Admin - Billing Plan Categories'],
        parameters: [new OA\Parameter(name: 'categoryId', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Category deleted successfully'),
            new OA\Response(response: 404, description: 'Category not found'),
        ]
    )]
    public function delete(Request $request, int $categoryId): Response
    {
        $admin = $request->get('user');
        $cat = Category::getById($categoryId);
        if (!$cat) {
            return ApiResponse::error('Category not found', 'CATEGORY_NOT_FOUND', 404);
        }

        if (!Category::delete($categoryId)) {
            return ApiResponse::error('Failed to delete category', 'DELETE_FAILED', 500);
        }

        Activity::createActivity([
            'user_uuid' => $admin['uuid'] ?? null,
            'name' => 'billingplans_delete_category',
            'context' => "Deleted billing plan category: {$cat['name']} (ID: {$categoryId})",
            'ip_address' => CloudFlareRealIP::getRealIP(),
        ]);

        return ApiResponse::success([], 'Category deleted successfully', 200);
    }
}
