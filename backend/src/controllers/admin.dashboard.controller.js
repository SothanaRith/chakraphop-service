import adminDashboardService from '../services/admin.dashboard.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

class AdminDashboardController {
  getSummary = asyncHandler(async (req, res) => {
    const summary = await adminDashboardService.getSummary();
    res.json(success(summary, 'Dashboard summary retrieved successfully'));
  });
}

export default new AdminDashboardController();
