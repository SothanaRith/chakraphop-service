import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/response.js';
import {
  addToWishlist,
  clearWishlist,
  getUserWishlist,
  isInWishlist,
  moveToCart,
  removeFromWishlist,
} from '../services/wishlist.service.js';

class WishlistController {
  getWishlist = asyncHandler(async (req, res) => {
    const data = await getUserWishlist(req.user.id);
    res.json(success(data));
  });

  addItem = asyncHandler(async (req, res) => {
    const data = await addToWishlist({
      userId: req.user.id,
      productId: req.body.productId,
      notes: req.body.notes,
      priority: req.body.priority,
    });

    res.status(201).json(success(data, 'Added to wishlist'));
  });

  removeItem = asyncHandler(async (req, res) => {
    const data = await removeFromWishlist({
      userId: req.user.id,
      productId: req.params.productId,
    });

    res.json(success(data, 'Removed from wishlist'));
  });

  clear = asyncHandler(async (req, res) => {
    const data = await clearWishlist(req.user.id);
    res.json(success(data, 'Wishlist cleared'));
  });

  moveItemToCart = asyncHandler(async (req, res) => {
    const data = await moveToCart({
      userId: req.user.id,
      productId: req.params.productId,
    });

    res.json(success(data, 'Item moved to cart'));
  });

  checkItem = asyncHandler(async (req, res) => {
    const data = await isInWishlist({
      userId: req.user.id,
      productId: req.params.productId,
    });

    res.json(success(data));
  });
}

export default new WishlistController();
