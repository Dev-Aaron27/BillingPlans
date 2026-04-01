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

namespace App\Addons\billingplans\Controllers\User;

use App\Helpers\ApiResponse;
use OpenApi\Attributes as OA;
use App\Addons\billingplans\Chat\Category;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

#[OA\Tag(name: 'User - Billing Plan Categories', description: 'Browse billing plan categories')]
class CategoriesController
{
    #[OA\Get(
        path: '/api/user/billingplans/categories',
        summary: 'List active categories (with plan counts)',
        tags: ['User - Billing Plan Categories'],
        responses: [new OA\Response(response: 200, description: 'Categories retrieved successfully')]
    )]
    public function list(Request $request): Response
    {
        $categories = Category::getAll(true);

        foreach ($categories as &$cat) {
            $cat['plan_count'] = Category::getPlanCount((int) $cat['id']);
            $cat['is_active'] = (bool) $cat['is_active'];
        }

        // Only return categories that actually have plans
        $categories = array_values(array_filter($categories, fn ($c) => $c['plan_count'] > 0));

        return ApiResponse::success($categories, 'Categories retrieved successfully', 200);
    }
}
