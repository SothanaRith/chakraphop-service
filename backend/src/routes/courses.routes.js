import { Router } from 'express';
import { body, query } from 'express-validator';
import coursesController from '../controllers/courses.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validation.middleware.js';

const router = Router();

const listValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive number'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('level').optional().isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).withMessage('invalid level'),
];

const createCourseValidation = [
  body('title').trim().notEmpty().withMessage('title is required'),
  body('slug')
    .trim()
    .notEmpty()
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('slug must use lowercase letters and hyphens'),
  body('category').trim().notEmpty().withMessage('category is required'),
  body('level').optional().isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).withMessage('invalid level'),
  body('price').optional().isFloat({ min: 0 }).withMessage('price must be a valid number'),
  body('status').optional().isIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']).withMessage('invalid status'),
];

const updateCourseValidation = [
  body('title').optional().trim().notEmpty().withMessage('title cannot be empty'),
  body('slug')
    .optional()
    .trim()
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('slug must use lowercase letters and hyphens'),
  body('category').optional().trim().notEmpty().withMessage('category cannot be empty'),
  body('level').optional().isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).withMessage('invalid level'),
  body('price').optional().isFloat({ min: 0 }).withMessage('price must be a valid number'),
  body('status').optional().isIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']).withMessage('invalid status'),
];

const createSectionValidation = [
  body('title').trim().notEmpty().withMessage('section title is required'),
  body('displayOrder').optional().isInt({ min: 0 }).withMessage('displayOrder must be >= 0'),
];

const updateSectionValidation = [
  body('title').optional().trim().notEmpty().withMessage('section title cannot be empty'),
  body('displayOrder').optional().isInt({ min: 0 }).withMessage('displayOrder must be >= 0'),
];

const createLessonValidation = [
  body('sectionId').notEmpty().withMessage('sectionId is required'),
  body('title').trim().notEmpty().withMessage('lesson title is required'),
  body('contentType').optional().isIn(['VIDEO', 'TEXT']).withMessage('invalid content type'),
  body('durationMinutes').optional().isInt({ min: 0 }).withMessage('durationMinutes must be >= 0'),
  body('displayOrder').optional().isInt({ min: 0 }).withMessage('displayOrder must be >= 0'),
];

const updateLessonValidation = [
  body('title').optional().trim().notEmpty().withMessage('lesson title cannot be empty'),
  body('contentType').optional().isIn(['VIDEO', 'TEXT']).withMessage('invalid content type'),
  body('durationMinutes').optional().isInt({ min: 0 }).withMessage('durationMinutes must be >= 0'),
  body('displayOrder').optional().isInt({ min: 0 }).withMessage('displayOrder must be >= 0'),
];

const progressValidation = [
  body('courseId').notEmpty().withMessage('courseId is required'),
  body('lessonId').notEmpty().withMessage('lessonId is required'),
  body('status').optional().isIn(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).withMessage('invalid status'),
  body('watchTimeSeconds').optional().isInt({ min: 0 }).withMessage('watchTimeSeconds must be >= 0'),
  body('lastPositionSeconds').optional().isInt({ min: 0 }).withMessage('lastPositionSeconds must be >= 0'),
];

router.get('/me/learning/list', authenticate, coursesController.getMyLearning);
router.post('/me/progress', authenticate, progressValidation, validate, coursesController.trackProgress);

router.get(
  '/instructor/dashboard/overview',
  authenticate,
  authorize(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  coursesController.getInstructorDashboard
);

router.get('/', listValidation, validate, coursesController.getCourses);

router.post(
  '/',
  authenticate,
  authorize(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  createCourseValidation,
  validate,
  coursesController.createCourse
);

router.patch(
  '/:id',
  authenticate,
  authorize(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  updateCourseValidation,
  validate,
  coursesController.updateCourse
);

router.post(
  '/:id/sections',
  authenticate,
  authorize(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  createSectionValidation,
  validate,
  coursesController.createSection
);

router.post(
  '/:id/lessons',
  authenticate,
  authorize(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  createLessonValidation,
  validate,
  coursesController.createLesson
);

router.patch(
  '/sections/:sectionId',
  authenticate,
  authorize(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  updateSectionValidation,
  validate,
  coursesController.updateSection
);

router.patch(
  '/lessons/:lessonId',
  authenticate,
  authorize(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  updateLessonValidation,
  validate,
  coursesController.updateLesson
);

router.post('/:id/enroll', authenticate, coursesController.enroll);
router.get('/:id/learn', authenticate, coursesController.getLearningLessons);

router.get('/:slug', optionalAuthenticate, coursesController.getCourseBySlug);

export default router;
