import adminMediaService from '../services/admin.media.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

class AdminMediaController {
  listMedia = asyncHandler(async (req, res) => {
    const { page = 1, limit = 24, category, search = '' } = req.query;
    const data = await adminMediaService.listMedia({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      category,
      search,
    });

    res.json(success(data, 'Media retrieved successfully'));
  });

  uploadMedia = asyncHandler(async (req, res) => {
    const data = await adminMediaService.uploadMedia({
      ...req.body,
      uploadedById: req.user.id,
    });

    res.status(201).json(success(data, 'Media uploaded successfully'));
  });

  deleteMedia = asyncHandler(async (req, res) => {
    const data = await adminMediaService.deleteMedia(req.params.mediaId);
    res.json(success(data, 'Media deleted successfully'));
  });
}

export default new AdminMediaController();
