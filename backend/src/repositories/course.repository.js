import { randomUUID } from 'crypto';
import { query, queryOne } from '../db/index.js';

export const listCourses = async ({
  page = 1,
  limit = 12,
  search,
  category,
  level,
  status,
  instructorId,
}) => {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 100);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const whereClauses = [];
  const params = [];

  if (status) {
    whereClauses.push('c.status = ?');
    params.push(status);
  }

  if (search) {
    whereClauses.push('(LOWER(c.title) LIKE ? OR LOWER(c.shortDescription) LIKE ? OR LOWER(c.description) LIKE ?)');
    const like = `%${search.toLowerCase()}%`;
    params.push(like, like, like);
  }

  if (category) {
    whereClauses.push('c.category = ?');
    params.push(category);
  }

  if (level) {
    whereClauses.push('c.level = ?');
    params.push(level);
  }

  if (instructorId) {
    whereClauses.push('c.instructorId = ?');
    params.push(instructorId);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const courses = await query(
    `SELECT c.id, c.title, c.slug, c.shortDescription, c.category, c.level, c.language,
            c.thumbnailUrl, c.price, c.originalPrice, c.status, c.isFeatured,
            c.totalDurationMinutes, c.totalLessons, c.ratingAverage, c.ratingCount,
            c.enrollmentCount, c.createdAt, c.publishedAt,
            u.id AS instructor_id, u.firstName AS instructor_firstName, u.lastName AS instructor_lastName
       FROM courses c
       JOIN users u ON u.id = c.instructorId
       ${whereSql}
      ORDER BY c.isFeatured DESC, c.publishedAt DESC, c.createdAt DESC
      LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );

  const countRow = await queryOne(
    `SELECT COUNT(*) AS total
       FROM courses c
       ${whereSql}`,
    params
  );

  return {
    courses,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: countRow?.total || 0,
      totalPages: Math.ceil((countRow?.total || 0) / safeLimit),
    },
  };
};

export const getCourseBySlug = async (slug) =>
  queryOne(
    `SELECT c.*, u.firstName AS instructor_firstName, u.lastName AS instructor_lastName, u.email AS instructor_email
       FROM courses c
       JOIN users u ON u.id = c.instructorId
      WHERE c.slug = ?
      LIMIT 1`,
    [slug]
  );

export const getCourseById = async (courseId) =>
  queryOne(
    `SELECT *
       FROM courses
      WHERE id = ?
      LIMIT 1`,
    [courseId]
  );

export const getCourseSections = async (courseId) =>
  query(
    `SELECT id, title, description, displayOrder
       FROM course_sections
      WHERE courseId = ?
      ORDER BY displayOrder ASC`,
    [courseId]
  );

export const getCourseLessons = async (courseId) =>
  query(
    `SELECT id, sectionId, courseId, title, contentType, videoUrl, content, durationMinutes,
            isPreview, displayOrder
       FROM course_lessons
      WHERE courseId = ?
      ORDER BY displayOrder ASC`,
    [courseId]
  );

export const createCourse = async (payload) => {
  const courseId = randomUUID();

  await query(
    `INSERT INTO courses (id, instructorId, title, slug, shortDescription, description, category,
                          level, language, thumbnailUrl, previewVideoUrl, price, originalPrice,
                          status, isFeatured, totalDurationMinutes, totalLessons, createdAt, updatedAt, publishedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)` ,
    [
      courseId,
      payload.instructorId,
      payload.title,
      payload.slug,
      payload.shortDescription || null,
      payload.description || null,
      payload.category,
      payload.level || 'BEGINNER',
      payload.language || 'English',
      payload.thumbnailUrl || null,
      payload.previewVideoUrl || null,
      payload.price || 0,
      payload.originalPrice || null,
      payload.status || 'DRAFT',
      payload.isFeatured ? 1 : 0,
      payload.totalDurationMinutes || 0,
      payload.totalLessons || 0,
      payload.status === 'PUBLISHED' ? new Date() : null,
    ]
  );

  return getCourseById(courseId);
};

export const updateCourse = async (courseId, updates) => {
  const allowedFields = [
    'title',
    'slug',
    'shortDescription',
    'description',
    'category',
    'level',
    'language',
    'thumbnailUrl',
    'previewVideoUrl',
    'price',
    'originalPrice',
    'status',
    'isFeatured',
  ];

  const fields = [];
  const values = [];

  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fields.push(`${key} = ?`);
      values.push(key === 'isFeatured' ? (updates[key] ? 1 : 0) : updates[key]);
    }
  }

  if (!fields.length) {
    return getCourseById(courseId);
  }

  if (updates.status === 'PUBLISHED') {
    fields.push('publishedAt = COALESCE(publishedAt, NOW())');
  }

  values.push(courseId);

  await query(
    `UPDATE courses
        SET ${fields.join(', ')}, updatedAt = NOW()
      WHERE id = ?`,
    values
  );

  return getCourseById(courseId);
};

export const createCourseSection = async ({ courseId, title, description, displayOrder }) => {
  const sectionId = randomUUID();

  await query(
    `INSERT INTO course_sections (id, courseId, title, description, displayOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [sectionId, courseId, title, description || null, displayOrder || 0]
  );

  return queryOne('SELECT * FROM course_sections WHERE id = ? LIMIT 1', [sectionId]);
};

export const updateCourseSection = async (sectionId, updates) => {
  const allowedFields = ['title', 'description', 'displayOrder'];
  const fields = [];
  const values = [];

  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }

  if (!fields.length) {
    return queryOne('SELECT * FROM course_sections WHERE id = ? LIMIT 1', [sectionId]);
  }

  values.push(sectionId);
  await query(
    `UPDATE course_sections
        SET ${fields.join(', ')}, updatedAt = NOW()
      WHERE id = ?`,
    values
  );

  return queryOne('SELECT * FROM course_sections WHERE id = ? LIMIT 1', [sectionId]);
};

export const getSectionById = async (sectionId) =>
  queryOne(
    `SELECT id, courseId, title, description, displayOrder
       FROM course_sections
      WHERE id = ?
      LIMIT 1`,
    [sectionId]
  );

export const createCourseLesson = async ({
  sectionId,
  courseId,
  title,
  contentType,
  videoUrl,
  content,
  durationMinutes,
  isPreview,
  displayOrder,
}) => {
  const lessonId = randomUUID();

  await query(
    `INSERT INTO course_lessons (id, sectionId, courseId, title, contentType, videoUrl, content,
                                 durationMinutes, isPreview, displayOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      lessonId,
      sectionId,
      courseId,
      title,
      contentType || 'VIDEO',
      videoUrl || null,
      content || null,
      durationMinutes || 0,
      isPreview ? 1 : 0,
      displayOrder || 0,
    ]
  );

  await syncCourseStats(courseId);

  return queryOne('SELECT * FROM course_lessons WHERE id = ? LIMIT 1', [lessonId]);
};

export const updateCourseLesson = async (lessonId, updates) => {
  const allowedFields = [
    'sectionId',
    'title',
    'contentType',
    'videoUrl',
    'content',
    'durationMinutes',
    'isPreview',
    'displayOrder',
  ];
  const fields = [];
  const values = [];

  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fields.push(`${key} = ?`);
      if (key === 'isPreview') {
        values.push(updates[key] ? 1 : 0);
      } else {
        values.push(updates[key]);
      }
    }
  }

  if (!fields.length) {
    return queryOne('SELECT * FROM course_lessons WHERE id = ? LIMIT 1', [lessonId]);
  }

  values.push(lessonId);

  await query(
    `UPDATE course_lessons
        SET ${fields.join(', ')}, updatedAt = NOW()
      WHERE id = ?`,
    values
  );

  return queryOne('SELECT * FROM course_lessons WHERE id = ? LIMIT 1', [lessonId]);
};

export const getLessonById = async (lessonId) =>
  queryOne(
    `SELECT id, sectionId, courseId, title, contentType, videoUrl, content, durationMinutes,
            isPreview, displayOrder
       FROM course_lessons
      WHERE id = ?
      LIMIT 1`,
    [lessonId]
  );

export const syncCourseStats = async (courseId) => {
  await query(
    `UPDATE courses c
        JOIN (
          SELECT cl.courseId,
                 COUNT(*) AS totalLessons,
                 COALESCE(SUM(cl.durationMinutes), 0) AS totalDurationMinutes
            FROM course_lessons cl
           WHERE cl.courseId = ?
           GROUP BY cl.courseId
        ) stats ON stats.courseId = c.id
        SET c.totalLessons = stats.totalLessons,
            c.totalDurationMinutes = stats.totalDurationMinutes,
            c.updatedAt = NOW()
      WHERE c.id = ?`,
    [courseId, courseId]
  );
};

export const findEnrollment = async (courseId, studentId) =>
  queryOne(
    `SELECT id, courseId, studentId, status, progressPercent, completedLessons, totalLessons,
            enrolledAt, completedAt, lastAccessedAt
       FROM course_enrollments
      WHERE courseId = ? AND studentId = ?
      LIMIT 1`,
    [courseId, studentId]
  );

export const createEnrollment = async ({ courseId, studentId, totalLessons }) => {
  const enrollmentId = randomUUID();

  await query(
    `INSERT INTO course_enrollments (id, courseId, studentId, status, progressPercent, completedLessons,
                                     totalLessons, enrolledAt, lastAccessedAt)
     VALUES (?, ?, ?, 'ACTIVE', 0, 0, ?, NOW(), NOW())`,
    [enrollmentId, courseId, studentId, totalLessons || 0]
  );

  await query(
    `UPDATE courses
        SET enrollmentCount = enrollmentCount + 1,
            updatedAt = NOW()
      WHERE id = ?`,
    [courseId]
  );

  return queryOne('SELECT * FROM course_enrollments WHERE id = ? LIMIT 1', [enrollmentId]);
};

export const listStudentEnrollments = async (studentId) =>
  query(
    `SELECT e.id, e.courseId, e.status, e.progressPercent, e.completedLessons, e.totalLessons,
            e.enrolledAt, e.completedAt, e.lastAccessedAt,
            c.title, c.slug, c.thumbnailUrl, c.level, c.category,
            u.firstName AS instructor_firstName, u.lastName AS instructor_lastName
       FROM course_enrollments e
       JOIN courses c ON c.id = e.courseId
       JOIN users u ON u.id = c.instructorId
      WHERE e.studentId = ?
      ORDER BY e.lastAccessedAt DESC, e.enrolledAt DESC`,
    [studentId]
  );

export const getEnrollmentById = async (enrollmentId) =>
  queryOne(
    `SELECT id, courseId, studentId, status, progressPercent, completedLessons, totalLessons,
            enrolledAt, completedAt, lastAccessedAt
       FROM course_enrollments
      WHERE id = ?
      LIMIT 1`,
    [enrollmentId]
  );

export const upsertLessonProgress = async ({
  enrollmentId,
  lessonId,
  status,
  watchTimeSeconds,
  lastPositionSeconds,
}) => {
  const existing = await queryOne(
    `SELECT id FROM lesson_progress WHERE enrollmentId = ? AND lessonId = ? LIMIT 1`,
    [enrollmentId, lessonId]
  );

  if (!existing) {
    const progressId = randomUUID();
    await query(
      `INSERT INTO lesson_progress (id, enrollmentId, lessonId, status, watchTimeSeconds,
                                    lastPositionSeconds, completedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        progressId,
        enrollmentId,
        lessonId,
        status || 'IN_PROGRESS',
        watchTimeSeconds || 0,
        lastPositionSeconds || 0,
        status === 'COMPLETED' ? new Date() : null,
      ]
    );
  } else {
    await query(
      `UPDATE lesson_progress
          SET status = ?,
              watchTimeSeconds = ?,
              lastPositionSeconds = ?,
              completedAt = CASE WHEN ? = 'COMPLETED' THEN COALESCE(completedAt, NOW()) ELSE completedAt END,
              updatedAt = NOW()
        WHERE enrollmentId = ? AND lessonId = ?`,
      [
        status || 'IN_PROGRESS',
        watchTimeSeconds || 0,
        lastPositionSeconds || 0,
        status || 'IN_PROGRESS',
        enrollmentId,
        lessonId,
      ]
    );
  }

  await refreshEnrollmentProgress(enrollmentId);

  return queryOne(
    `SELECT * FROM lesson_progress WHERE enrollmentId = ? AND lessonId = ? LIMIT 1`,
    [enrollmentId, lessonId]
  );
};

export const refreshEnrollmentProgress = async (enrollmentId) => {
  const enrollment = await getEnrollmentById(enrollmentId);
  if (!enrollment) return null;

  const row = await queryOne(
    `SELECT COUNT(*) AS completed
       FROM lesson_progress
      WHERE enrollmentId = ? AND status = 'COMPLETED'`,
    [enrollmentId]
  );

  const completedLessons = row?.completed || 0;
  const totalLessons = enrollment.totalLessons || 0;
  const progressPercent = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
  const isCompleted = totalLessons > 0 && completedLessons >= totalLessons;

  await query(
    `UPDATE course_enrollments
        SET completedLessons = ?,
            progressPercent = ?,
            status = CASE WHEN ? THEN 'COMPLETED' ELSE status END,
            completedAt = CASE WHEN ? THEN COALESCE(completedAt, NOW()) ELSE completedAt END,
            lastAccessedAt = NOW()
      WHERE id = ?`,
    [completedLessons, progressPercent, isCompleted ? 1 : 0, isCompleted ? 1 : 0, enrollmentId]
  );

  return getEnrollmentById(enrollmentId);
};

export const listLessonsWithProgress = async (courseId, enrollmentId) =>
  query(
    `SELECT l.id, l.sectionId, l.courseId, l.title, l.contentType, l.videoUrl, l.content, l.durationMinutes,
            l.isPreview, l.displayOrder,
            COALESCE(lp.status, 'NOT_STARTED') AS progressStatus,
            COALESCE(lp.watchTimeSeconds, 0) AS watchTimeSeconds,
            COALESCE(lp.lastPositionSeconds, 0) AS lastPositionSeconds
       FROM course_lessons l
  LEFT JOIN lesson_progress lp ON lp.lessonId = l.id AND lp.enrollmentId = ?
      WHERE l.courseId = ?
      ORDER BY l.displayOrder ASC`,
    [enrollmentId, courseId]
  );

export const listInstructorCourses = async (instructorId) =>
  query(
    `SELECT id, title, slug, status, level, category, price, totalLessons,
            totalDurationMinutes, enrollmentCount, ratingAverage, ratingCount, createdAt, publishedAt
       FROM courses
      WHERE instructorId = ?
      ORDER BY updatedAt DESC`,
    [instructorId]
  );

export const getInstructorDashboardStats = async (instructorId) => {
  const stats = await queryOne(
    `SELECT COUNT(*) AS totalCourses,
            SUM(CASE WHEN status = 'PUBLISHED' THEN 1 ELSE 0 END) AS publishedCourses,
            COALESCE(SUM(enrollmentCount), 0) AS totalEnrollments,
            COALESCE(AVG(ratingAverage), 0) AS avgRating
       FROM courses
      WHERE instructorId = ?`,
    [instructorId]
  );

  const recentEnrollments = await query(
    `SELECT e.enrolledAt, c.title,
            u.firstName, u.lastName, u.email
       FROM course_enrollments e
       JOIN courses c ON c.id = e.courseId
       JOIN users u ON u.id = e.studentId
      WHERE c.instructorId = ?
      ORDER BY e.enrolledAt DESC
      LIMIT 10`,
    [instructorId]
  );

  return {
    ...stats,
    recentEnrollments,
  };
};
