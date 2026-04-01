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
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Addons\billingplans\Helpers\SettingsHelper;

#[OA\Tag(name: 'Admin - Billing Plans Settings', description: 'Plugin settings for billing plans')]
class SettingsController
{
    #[OA\Get(
        path: '/api/admin/billingplans/settings',
        summary: 'Get billing plans settings',
        tags: ['Admin - Billing Plans Settings'],
        responses: [new OA\Response(response: 200, description: 'Settings retrieved successfully')]
    )]
    public function getSettings(Request $request): Response
    {
        return ApiResponse::success(SettingsHelper::getAllSettings(), 'Settings retrieved successfully', 200);
    }

    #[OA\Patch(
        path: '/api/admin/billingplans/settings',
        summary: 'Update billing plans settings',
        tags: ['Admin - Billing Plans Settings'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'suspend_servers', type: 'boolean', description: 'Suspend linked server on Wings when renewal fails'),
                    new OA\Property(property: 'unsuspend_on_renewal', type: 'boolean', description: 'Unsuspend server on successful renewal'),
                    new OA\Property(property: 'grace_period_days', type: 'integer', minimum: 0, description: 'Days of grace before suspension (0 = immediate)'),
                    new OA\Property(property: 'termination_days', type: 'integer', minimum: 0, description: 'Days after suspension before auto-cancel (0 = never)'),
                    new OA\Property(property: 'send_suspension_email', type: 'boolean', description: 'Email user on suspension'),
                    new OA\Property(property: 'allow_user_cancellation', type: 'boolean', description: 'Allow users to cancel subscriptions themselves'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Settings updated successfully'),
            new OA\Response(response: 400, description: 'Invalid input'),
        ]
    )]
    public function updateSettings(Request $request): Response
    {
        $admin = $request->get('user');
        $data = json_decode($request->getContent(), true);

        if ($data === null) {
            return ApiResponse::error('Invalid JSON', 'INVALID_JSON', 400);
        }

        if (isset($data['suspend_servers'])) {
            SettingsHelper::setSuspendServers((bool) filter_var($data['suspend_servers'], FILTER_VALIDATE_BOOLEAN));
        }

        if (isset($data['unsuspend_on_renewal'])) {
            SettingsHelper::setUnsuspendOnRenewal((bool) filter_var($data['unsuspend_on_renewal'], FILTER_VALIDATE_BOOLEAN));
        }

        if (isset($data['grace_period_days'])) {
            $grace = (int) $data['grace_period_days'];
            if ($grace < 0) {
                return ApiResponse::error('grace_period_days must be >= 0', 'INVALID_GRACE_PERIOD', 400);
            }
            SettingsHelper::setGracePeriodDays($grace);
        }

        if (isset($data['termination_days'])) {
            $term = (int) $data['termination_days'];
            if ($term < 0) {
                return ApiResponse::error('termination_days must be >= 0', 'INVALID_TERMINATION_DAYS', 400);
            }
            SettingsHelper::setTerminationDays($term);
        }

        if (isset($data['send_suspension_email'])) {
            SettingsHelper::setSendSuspensionEmail((bool) filter_var($data['send_suspension_email'], FILTER_VALIDATE_BOOLEAN));
        }

        if (isset($data['allow_user_cancellation'])) {
            SettingsHelper::setAllowUserCancellation((bool) filter_var($data['allow_user_cancellation'], FILTER_VALIDATE_BOOLEAN));
        }

        if (isset($data['send_termination_email'])) {
            SettingsHelper::setSendTerminationEmail((bool) filter_var($data['send_termination_email'], FILTER_VALIDATE_BOOLEAN));
        }

        if (isset($data['generate_invoices'])) {
            SettingsHelper::setGenerateInvoices((bool) filter_var($data['generate_invoices'], FILTER_VALIDATE_BOOLEAN));
        }

        Activity::createActivity([
            'user_uuid' => $admin['uuid'] ?? null,
            'name' => 'billingplans_update_settings',
            'context' => 'Updated BillingPlans plugin settings',
            'ip_address' => CloudFlareRealIP::getRealIP(),
        ]);

        return ApiResponse::success(SettingsHelper::getAllSettings(), 'Settings updated successfully', 200);
    }
}
