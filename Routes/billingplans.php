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

use App\App;
use App\Permissions;
use App\Helpers\ApiResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\RouteCollection;
use App\Addons\billingplans\Controllers\User\PlansController as UserPlansController;
use App\Addons\billingplans\Controllers\Admin\PlansController as AdminPlansController;
use App\Addons\billingplans\Controllers\Admin\SettingsController as AdminSettingsController;
use App\Addons\billingplans\Controllers\User\CategoriesController as UserCategoriesController;
use App\Addons\billingplans\Controllers\Admin\CategoriesController as AdminCategoriesController;
use App\Addons\billingplans\Controllers\User\SubscriptionsController as UserSubscriptionsController;
use App\Addons\billingplans\Controllers\Admin\SubscriptionsController as AdminSubscriptionsController;

return function (RouteCollection $routes): void {

    App::getInstance(true)->registerAuthRoute(
        $routes,
        'billingplans-user-categories-list',
        '/api/user/billingplans/categories',
        function (Request $request) {
            return (new UserCategoriesController())->list($request);
        },
        ['GET']
    );

    App::getInstance(true)->registerAuthRoute(
        $routes,
        'billingplans-user-plans-list',
        '/api/user/billingplans/plans',
        function (Request $request) {
            return (new UserPlansController())->list($request);
        },
        ['GET']
    );

    App::getInstance(true)->registerAuthRoute(
        $routes,
        'billingplans-user-plans-get',
        '/api/user/billingplans/plans/{planId}',
        function (Request $request, array $args) {
            $planId = (int) ($args['planId'] ?? 0);
            if (!$planId) {
                return ApiResponse::error('Invalid plan ID', 'INVALID_ID', 400);
            }

            return (new UserPlansController())->get($request, $planId);
        },
        ['GET']
    );

    App::getInstance(true)->registerAuthRoute(
        $routes,
        'billingplans-user-plans-subscribe',
        '/api/user/billingplans/plans/{planId}/subscribe',
        function (Request $request, array $args) {
            $planId = (int) ($args['planId'] ?? 0);
            if (!$planId) {
                return ApiResponse::error('Invalid plan ID', 'INVALID_ID', 400);
            }

            return (new UserPlansController())->subscribe($request, $planId);
        },
        ['POST']
    );

    App::getInstance(true)->registerAuthRoute(
        $routes,
        'billingplans-user-subscriptions-list',
        '/api/user/billingplans/subscriptions',
        function (Request $request) {
            return (new UserSubscriptionsController())->list($request);
        },
        ['GET']
    );

    App::getInstance(true)->registerAuthRoute(
        $routes,
        'billingplans-user-subscriptions-get',
        '/api/user/billingplans/subscriptions/{subscriptionId}',
        function (Request $request, array $args) {
            $subscriptionId = (int) ($args['subscriptionId'] ?? 0);
            if (!$subscriptionId) {
                return ApiResponse::error('Invalid subscription ID', 'INVALID_ID', 400);
            }

            return (new UserSubscriptionsController())->get($request, $subscriptionId);
        },
        ['GET']
    );

    App::getInstance(true)->registerAuthRoute(
        $routes,
        'billingplans-user-subscriptions-cancel',
        '/api/user/billingplans/subscriptions/{subscriptionId}',
        function (Request $request, array $args) {
            $subscriptionId = (int) ($args['subscriptionId'] ?? 0);
            if (!$subscriptionId) {
                return ApiResponse::error('Invalid subscription ID', 'INVALID_ID', 400);
            }

            return (new UserSubscriptionsController())->cancel($request, $subscriptionId);
        },
        ['DELETE']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-categories-list',
        '/api/admin/billingplans/categories',
        function (Request $request) {
            return (new AdminCategoriesController())->list($request);
        },
        Permissions::ADMIN_USERS_VIEW,
        ['GET']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-categories-create',
        '/api/admin/billingplans/categories',
        function (Request $request) {
            return (new AdminCategoriesController())->create($request);
        },
        Permissions::ADMIN_USERS_EDIT,
        ['POST']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-categories-get',
        '/api/admin/billingplans/categories/{categoryId}',
        function (Request $request, array $args) {
            $categoryId = (int) ($args['categoryId'] ?? 0);
            if (!$categoryId) {
                return ApiResponse::error('Invalid category ID', 'INVALID_ID', 400);
            }

            return (new AdminCategoriesController())->get($request, $categoryId);
        },
        Permissions::ADMIN_USERS_VIEW,
        ['GET']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-categories-update',
        '/api/admin/billingplans/categories/{categoryId}',
        function (Request $request, array $args) {
            $categoryId = (int) ($args['categoryId'] ?? 0);
            if (!$categoryId) {
                return ApiResponse::error('Invalid category ID', 'INVALID_ID', 400);
            }

            return (new AdminCategoriesController())->update($request, $categoryId);
        },
        Permissions::ADMIN_USERS_EDIT,
        ['PATCH', 'PUT']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-categories-delete',
        '/api/admin/billingplans/categories/{categoryId}',
        function (Request $request, array $args) {
            $categoryId = (int) ($args['categoryId'] ?? 0);
            if (!$categoryId) {
                return ApiResponse::error('Invalid category ID', 'INVALID_ID', 400);
            }

            return (new AdminCategoriesController())->delete($request, $categoryId);
        },
        Permissions::ADMIN_USERS_EDIT,
        ['DELETE']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-plans-options',
        '/api/admin/billingplans/options',
        function (Request $request) {
            return (new AdminPlansController())->getOptions($request);
        },
        Permissions::ADMIN_USERS_VIEW,
        ['GET']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-plans-list',
        '/api/admin/billingplans/plans',
        function (Request $request) {
            return (new AdminPlansController())->list($request);
        },
        Permissions::ADMIN_USERS_VIEW,
        ['GET']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-plans-create',
        '/api/admin/billingplans/plans',
        function (Request $request) {
            return (new AdminPlansController())->create($request);
        },
        Permissions::ADMIN_USERS_EDIT,
        ['POST']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-plans-get',
        '/api/admin/billingplans/plans/{planId}',
        function (Request $request, array $args) {
            $planId = (int) ($args['planId'] ?? 0);
            if (!$planId) {
                return ApiResponse::error('Invalid plan ID', 'INVALID_ID', 400);
            }

            return (new AdminPlansController())->get($request, $planId);
        },
        Permissions::ADMIN_USERS_VIEW,
        ['GET']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-plans-update',
        '/api/admin/billingplans/plans/{planId}',
        function (Request $request, array $args) {
            $planId = (int) ($args['planId'] ?? 0);
            if (!$planId) {
                return ApiResponse::error('Invalid plan ID', 'INVALID_ID', 400);
            }

            return (new AdminPlansController())->update($request, $planId);
        },
        Permissions::ADMIN_USERS_EDIT,
        ['PATCH', 'PUT']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-plans-delete',
        '/api/admin/billingplans/plans/{planId}',
        function (Request $request, array $args) {
            $planId = (int) ($args['planId'] ?? 0);
            if (!$planId) {
                return ApiResponse::error('Invalid plan ID', 'INVALID_ID', 400);
            }

            return (new AdminPlansController())->delete($request, $planId);
        },
        Permissions::ADMIN_USERS_EDIT,
        ['DELETE']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-user-subscriptions',
        '/api/admin/billingplans/users/{userId}/subscriptions',
        function (Request $request, array $args) {
            $userId = (int) ($args['userId'] ?? 0);
            if (!$userId) {
                return ApiResponse::error('Invalid user ID', 'INVALID_ID', 400);
            }

            return (new AdminSubscriptionsController())->getUserSubscriptions($request, $userId);
        },
        Permissions::ADMIN_USERS_VIEW,
        ['GET']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-subscriptions-stats',
        '/api/admin/billingplans/stats',
        function (Request $request) {
            return (new AdminSubscriptionsController())->stats($request);
        },
        Permissions::ADMIN_USERS_VIEW,
        ['GET']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-subscriptions-list',
        '/api/admin/billingplans/subscriptions',
        function (Request $request) {
            return (new AdminSubscriptionsController())->list($request);
        },
        Permissions::ADMIN_USERS_VIEW,
        ['GET']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-subscriptions-get',
        '/api/admin/billingplans/subscriptions/{subscriptionId}',
        function (Request $request, array $args) {
            $subscriptionId = (int) ($args['subscriptionId'] ?? 0);
            if (!$subscriptionId) {
                return ApiResponse::error('Invalid subscription ID', 'INVALID_ID', 400);
            }

            return (new AdminSubscriptionsController())->get($request, $subscriptionId);
        },
        Permissions::ADMIN_USERS_VIEW,
        ['GET']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-subscriptions-update',
        '/api/admin/billingplans/subscriptions/{subscriptionId}',
        function (Request $request, array $args) {
            $subscriptionId = (int) ($args['subscriptionId'] ?? 0);
            if (!$subscriptionId) {
                return ApiResponse::error('Invalid subscription ID', 'INVALID_ID', 400);
            }

            return (new AdminSubscriptionsController())->update($request, $subscriptionId);
        },
        Permissions::ADMIN_USERS_EDIT,
        ['PATCH', 'PUT']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-subscriptions-cancel',
        '/api/admin/billingplans/subscriptions/{subscriptionId}',
        function (Request $request, array $args) {
            $subscriptionId = (int) ($args['subscriptionId'] ?? 0);
            if (!$subscriptionId) {
                return ApiResponse::error('Invalid subscription ID', 'INVALID_ID', 400);
            }

            return (new AdminSubscriptionsController())->cancel($request, $subscriptionId);
        },
        Permissions::ADMIN_USERS_EDIT,
        ['DELETE']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-subscriptions-refund',
        '/api/admin/billingplans/subscriptions/{subscriptionId}/refund',
        function (Request $request, array $args) {
            $subscriptionId = (int) ($args['subscriptionId'] ?? 0);
            if (!$subscriptionId) {
                return ApiResponse::error('Invalid subscription ID', 'INVALID_ID', 400);
            }

            return (new AdminSubscriptionsController())->refund($request, $subscriptionId);
        },
        Permissions::ADMIN_USERS_EDIT,
        ['POST']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-settings-get',
        '/api/admin/billingplans/settings',
        function (Request $request) {
            return (new AdminSettingsController())->getSettings($request);
        },
        Permissions::ADMIN_USERS_VIEW,
        ['GET']
    );

    App::getInstance(true)->registerAdminRoute(
        $routes,
        'billingplans-admin-settings-update',
        '/api/admin/billingplans/settings',
        function (Request $request) {
            return (new AdminSettingsController())->updateSettings($request);
        },
        Permissions::ADMIN_USERS_EDIT,
        ['PATCH', 'PUT']
    );
};
