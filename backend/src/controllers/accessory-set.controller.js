import accessorySetService from '../services/accessory-set.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/response.js';

class AccessorySetController {
  getSets = asyncHandler(async (req, res) => {
    const sets = await accessorySetService.getSets(req.query, req.user || null);
    res.json(success(sets));
  });

  getSetBySlug = asyncHandler(async (req, res) => {
    const set = await accessorySetService.getSetDetail(req.params.slug, req.user || null);
    res.json(success(set));
  });

  createSet = asyncHandler(async (req, res) => {
    const set = await accessorySetService.createSet(req.body, req.user.id);
    res.status(201).json(success(set, 'Desk accessory set created successfully'));
  });

  updateSet = asyncHandler(async (req, res) => {
    const set = await accessorySetService.updateSet(req.params.id, req.body);
    res.json(success(set, 'Desk accessory set updated successfully'));
  });

  addItem = asyncHandler(async (req, res) => {
    const item = await accessorySetService.addItem(req.params.id, req.body);
    res.status(201).json(success(item, 'Item added to set successfully'));
  });

  updateItem = asyncHandler(async (req, res) => {
    const item = await accessorySetService.updateItem(req.params.id, req.params.itemId, req.body);
    res.json(success(item, 'Set item updated successfully'));
  });

  removeItem = asyncHandler(async (req, res) => {
    await accessorySetService.deleteItem(req.params.id, req.params.itemId);
    res.json(success(null, 'Set item removed successfully'));
  });
}

export default new AccessorySetController();
