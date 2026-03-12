import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import {
  listSets,
  getSetBySlug,
  getSetById,
  createSet,
  updateSet,
  listSetItems,
  createSetItem,
  updateSetItem,
  getSetItemById,
  deleteSetItem,
  findProductById,
  findVariantById,
} from '../repositories/accessory-set.repository.js';

class AccessorySetService {
  async getSets(query = {}, user = null) {
    const includeAllStatuses = Boolean(user && ['ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER'].includes(user.role));

    return listSets({
      status: query.status || 'ACTIVE',
      search: query.search,
      includeAllStatuses,
    });
  }

  async getSetDetail(slug, user = null) {
    const set = await getSetBySlug(slug);

    if (!set) {
      throw new NotFoundError('Desk accessory set not found');
    }

    if (!['ACTIVE'].includes(set.status) && !(user && ['ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER'].includes(user.role))) {
      throw new NotFoundError('Desk accessory set not found');
    }

    const items = await listSetItems(set.id);
    return { ...set, items };
  }

  async createSet(payload, userId) {
    if (!payload.name?.trim() || !payload.slug?.trim()) {
      throw new ValidationError('name and slug are required');
    }

    const existing = await getSetBySlug(payload.slug.trim());
    if (existing) {
      throw new ConflictError('Set slug already exists');
    }

    return createSet({
      name: payload.name.trim(),
      slug: payload.slug.trim(),
      description: payload.description,
      coverImageUrl: payload.coverImageUrl,
      bundlePrice: payload.bundlePrice,
      status: payload.status || 'DRAFT',
      createdById: userId,
    });
  }

  async updateSet(setId, payload) {
    const existing = await getSetById(setId);
    if (!existing) {
      throw new NotFoundError('Desk accessory set not found');
    }

    if (payload.slug && payload.slug !== existing.slug) {
      const duplicate = await getSetBySlug(payload.slug);
      if (duplicate) {
        throw new ConflictError('Set slug already exists');
      }
    }

    return updateSet(setId, payload);
  }

  async addItem(setId, payload) {
    const set = await getSetById(setId);
    if (!set) {
      throw new NotFoundError('Desk accessory set not found');
    }

    if (!payload.productId) {
      throw new ValidationError('productId is required');
    }

    const product = await findProductById(payload.productId);
    if (!product) {
      throw new ValidationError('Invalid productId');
    }

    if (payload.variantId) {
      const variant = await findVariantById(payload.variantId);
      if (!variant || variant.productId !== payload.productId) {
        throw new ValidationError('variantId does not belong to productId');
      }
    }

    const item = await createSetItem({
      setId,
      productId: payload.productId,
      variantId: payload.variantId,
      quantity: payload.quantity || 1,
      displayOrder: payload.displayOrder || 0,
      note: payload.note,
    });

    return item;
  }

  async updateItem(setId, itemId, payload) {
    const set = await getSetById(setId);
    if (!set) {
      throw new NotFoundError('Desk accessory set not found');
    }

    const item = await getSetItemById(itemId);
    if (!item || item.setId !== setId) {
      throw new NotFoundError('Set item not found');
    }

    if (payload.productId) {
      const product = await findProductById(payload.productId);
      if (!product) {
        throw new ValidationError('Invalid productId');
      }
    }

    if (payload.variantId) {
      const productId = payload.productId || item.productId;
      const variant = await findVariantById(payload.variantId);
      if (!variant || variant.productId !== productId) {
        throw new ValidationError('variantId does not belong to productId');
      }
    }

    return updateSetItem(itemId, payload);
  }

  async deleteItem(setId, itemId) {
    const item = await getSetItemById(itemId);
    if (!item || item.setId !== setId) {
      throw new NotFoundError('Set item not found');
    }

    await deleteSetItem(itemId);
  }
}

export default new AccessorySetService();
