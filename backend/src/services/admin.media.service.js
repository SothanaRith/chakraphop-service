import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { execute, executeOne } from '../db/index.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

const MEDIA_DIR = path.resolve(process.cwd(), 'uploads/admin-media');
const MAX_SIZE_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
]);

class AdminMediaService {
  constructor() {
    this.ready = false;
  }

  async ensureReady() {
    if (this.ready) return;

    await fs.mkdir(MEDIA_DIR, { recursive: true });

    await execute(
      `CREATE TABLE IF NOT EXISTS media_assets (
        id VARCHAR(36) PRIMARY KEY,
        fileName VARCHAR(255) NOT NULL,
        originalFileName VARCHAR(255) NOT NULL,
        mimeType VARCHAR(100) NOT NULL,
        sizeBytes INT NOT NULL,
        url VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        referenceId VARCHAR(36) NULL,
        uploadedById VARCHAR(36) NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX media_assets_category_index (category),
        INDEX media_assets_referenceId_index (referenceId),
        CONSTRAINT media_assets_uploadedById_fkey FOREIGN KEY (uploadedById) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    this.ready = true;
  }

  async listMedia({ category, page = 1, limit = 24, search = '' }) {
    await this.ensureReady();

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }

    if (search) {
      conditions.push('(fileName LIKE ? OR originalFileName LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const items = await execute(
      `SELECT id, fileName, originalFileName, mimeType, sizeBytes, url, category, referenceId, uploadedById, createdAt
         FROM media_assets
         ${whereClause}
        ORDER BY createdAt DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const totalRow = await executeOne(`SELECT COUNT(*) AS total FROM media_assets ${whereClause}`, params);

    return {
      items,
      pagination: {
        page,
        limit,
        total: totalRow?.total || 0,
      },
    };
  }

  async uploadMedia({ originalFileName, mimeType, base64Data, category = 'general', referenceId = null, uploadedById }) {
    await this.ensureReady();

    if (!originalFileName || !mimeType || !base64Data) {
      throw new ValidationError('originalFileName, mimeType, and base64Data are required');
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new ValidationError('Unsupported file type');
    }

    const binary = Buffer.from(base64Data, 'base64');
    if (binary.length > MAX_SIZE_BYTES) {
      throw new ValidationError('File too large. Maximum size is 15MB');
    }

    const ext = path.extname(originalFileName) || this.extensionFromMime(mimeType);
    const id = randomUUID();
    const safeFileName = `${id}${ext}`;
    const diskPath = path.join(MEDIA_DIR, safeFileName);

    await fs.writeFile(diskPath, binary);

    const url = `/uploads/admin-media/${safeFileName}`;

    await execute(
      `INSERT INTO media_assets (
        id, fileName, originalFileName, mimeType, sizeBytes, url, category, referenceId, uploadedById, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, safeFileName, originalFileName, mimeType, binary.length, url, category, referenceId, uploadedById]
    );

    return executeOne('SELECT * FROM media_assets WHERE id = ? LIMIT 1', [id]);
  }

  async deleteMedia(id) {
    await this.ensureReady();

    const media = await executeOne('SELECT id, fileName FROM media_assets WHERE id = ? LIMIT 1', [id]);
    if (!media) throw new NotFoundError('Media not found');

    await execute('DELETE FROM media_assets WHERE id = ?', [id]);

    const diskPath = path.join(MEDIA_DIR, media.fileName);
    await fs.rm(diskPath, { force: true });

    return { deleted: true };
  }

  extensionFromMime(mimeType) {
    if (mimeType === 'image/jpeg') return '.jpg';
    if (mimeType === 'image/png') return '.png';
    if (mimeType === 'image/webp') return '.webp';
    if (mimeType === 'image/gif') return '.gif';
    if (mimeType === 'video/mp4') return '.mp4';
    if (mimeType === 'application/pdf') return '.pdf';
    if (mimeType.includes('zip')) return '.zip';
    return '';
  }
}

export default new AdminMediaService();
