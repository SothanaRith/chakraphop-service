import { randomUUID } from 'crypto';
import { execute, executeOne } from '../db/index.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

class AdminLearningService {
  async listInstructors({ page = 1, limit = 20, search = '' }) {
    const offset = (page - 1) * limit;
    const hasSearch = Boolean(search && search.trim());
    const searchLike = `%${search?.trim() || ''}%`;

    const whereClause = hasSearch
      ? "WHERE u.role = 'INSTRUCTOR' AND (u.email LIKE ? OR u.firstName LIKE ? OR u.lastName LIKE ?)"
      : "WHERE u.role = 'INSTRUCTOR'";

    const params = hasSearch ? [searchLike, searchLike, searchLike] : [];

    const items = await execute(
      `SELECT u.id, u.email, u.firstName, u.lastName, u.isActive, u.createdAt,
              i.isVerified, i.headline,
              (SELECT COUNT(*) FROM courses c WHERE c.instructorId = u.id) AS courseCount,
              (SELECT COALESCE(SUM(c.price), 0)
                 FROM courses c
                 JOIN course_enrollments ce ON ce.courseId = c.id
                WHERE c.instructorId = u.id) AS estimatedRevenue
         FROM users u
         LEFT JOIN instructors i ON i.userId = u.id
         ${whereClause}
        ORDER BY u.createdAt DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const totalRow = await executeOne(
      `SELECT COUNT(*) AS total
         FROM users u
         ${whereClause}`,
      params
    );

    return {
      items,
      pagination: {
        page,
        limit,
        total: totalRow?.total || 0,
      },
    };
  }

  async approveInstructor(userId) {
    const user = await executeOne('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!user) throw new NotFoundError('User not found');

    await execute("UPDATE users SET role = 'INSTRUCTOR', isActive = 1, updatedAt = NOW() WHERE id = ?", [userId]);

    const profile = await executeOne('SELECT id FROM instructors WHERE userId = ? LIMIT 1', [userId]);
    if (!profile) {
      await execute(
        'INSERT INTO instructors (id, userId, isVerified, createdAt, updatedAt) VALUES (?, ?, 1, NOW(), NOW())',
        [randomUUID(), userId]
      );
    } else {
      await execute('UPDATE instructors SET isVerified = 1, updatedAt = NOW() WHERE userId = ?', [userId]);
    }

    return { userId, status: 'APPROVED' };
  }

  async suspendInstructor(userId) {
    const user = await executeOne("SELECT id FROM users WHERE id = ? AND role = 'INSTRUCTOR' LIMIT 1", [userId]);
    if (!user) throw new NotFoundError('Instructor not found');

    await execute('UPDATE users SET isActive = 0, updatedAt = NOW() WHERE id = ?', [userId]);
    return { userId, status: 'SUSPENDED' };
  }

  async getInstructorCourses(userId) {
    return execute(
      `SELECT id, title, slug, category, level, status, price, enrollmentCount, createdAt, updatedAt
         FROM courses
        WHERE instructorId = ?
        ORDER BY createdAt DESC`,
      [userId]
    );
  }

  async getInstructorRevenue(userId) {
    const row = await executeOne(
      `SELECT COALESCE(SUM(c.price), 0) AS revenue,
              COUNT(ce.id) AS enrollments
         FROM courses c
         LEFT JOIN course_enrollments ce ON ce.courseId = c.id
        WHERE c.instructorId = ?`,
      [userId]
    );

    return {
      userId,
      revenue: Number(row?.revenue || 0),
      enrollments: row?.enrollments || 0,
    };
  }

  async listEnrollments({ page = 1, limit = 20, courseId, studentId, status }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (courseId) {
      conditions.push('ce.courseId = ?');
      params.push(courseId);
    }

    if (studentId) {
      conditions.push('ce.studentId = ?');
      params.push(studentId);
    }

    if (status) {
      conditions.push('ce.status = ?');
      params.push(status);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const items = await execute(
      `SELECT ce.id, ce.status, ce.progressPercent, ce.completedLessons, ce.totalLessons, ce.enrolledAt, ce.lastAccessedAt,
              c.id AS courseId, c.title AS courseTitle,
              u.id AS studentId, u.email AS studentEmail,
              CONCAT(COALESCE(u.firstName, ''), ' ', COALESCE(u.lastName, '')) AS studentName
         FROM course_enrollments ce
         JOIN courses c ON c.id = ce.courseId
         JOIN users u ON u.id = ce.studentId
         ${whereClause}
        ORDER BY ce.enrolledAt DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const totalRow = await executeOne(
      `SELECT COUNT(*) AS total
         FROM course_enrollments ce
         ${whereClause}`,
      params
    );

    return {
      items,
      pagination: {
        page,
        limit,
        total: totalRow?.total || 0,
      },
    };
  }

  async removeEnrollment(enrollmentId) {
    const existing = await executeOne('SELECT id FROM course_enrollments WHERE id = ? LIMIT 1', [enrollmentId]);
    if (!existing) throw new NotFoundError('Enrollment not found');

    await execute('DELETE FROM course_enrollments WHERE id = ?', [enrollmentId]);
    return { deleted: true };
  }

  async getEnrollmentProgress(enrollmentId) {
    const enrollment = await executeOne(
      `SELECT ce.id, ce.status, ce.progressPercent, ce.completedLessons, ce.totalLessons,
              c.id AS courseId, c.title AS courseTitle,
              u.id AS studentId, u.email AS studentEmail
         FROM course_enrollments ce
         JOIN courses c ON c.id = ce.courseId
         JOIN users u ON u.id = ce.studentId
        WHERE ce.id = ?
        LIMIT 1`,
      [enrollmentId]
    );

    if (!enrollment) throw new NotFoundError('Enrollment not found');

    const lessons = await execute(
      `SELECT lp.id, lp.status, lp.watchTimeSeconds, lp.lastPositionSeconds, lp.completedAt,
              cl.id AS lessonId, cl.title AS lessonTitle
         FROM lesson_progress lp
         JOIN course_lessons cl ON cl.id = lp.lessonId
        WHERE lp.enrollmentId = ?
        ORDER BY cl.displayOrder ASC`,
      [enrollmentId]
    );

    return {
      enrollment,
      lessons,
    };
  }

  async listCourses({ page = 1, limit = 20, status, search }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('c.status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push('(c.title LIKE ? OR c.slug LIKE ? OR c.category LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const items = await execute(
      `SELECT c.id, c.title, c.slug, c.status, c.level, c.category, c.price, c.enrollmentCount,
              c.createdAt, c.updatedAt,
              u.email AS instructorEmail,
              CONCAT(COALESCE(u.firstName, ''), ' ', COALESCE(u.lastName, '')) AS instructorName
         FROM courses c
         LEFT JOIN users u ON u.id = c.instructorId
         ${whereClause}
        ORDER BY c.createdAt DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const totalRow = await executeOne(
      `SELECT COUNT(*) AS total
         FROM courses c
         ${whereClause}`,
      params
    );

    return {
      items,
      pagination: { page, limit, total: totalRow?.total || 0 },
    };
  }

  async createCourse(payload) {
    const { instructorId, title, slug, category, level = 'BEGINNER', price = 0, shortDescription = '', description = '', status = 'DRAFT', thumbnailUrl = null } = payload;

    if (!instructorId || !title || !slug || !category) {
      throw new ValidationError('instructorId, title, slug, and category are required');
    }

    const id = randomUUID();
    await execute(
      `INSERT INTO courses (
        id, instructorId, title, slug, shortDescription, description, category,
        level, language, price, status, thumbnailUrl, createdAt, updatedAt, publishedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'English', ?, ?, ?, NOW(), NOW(), CASE WHEN ? = 'PUBLISHED' THEN NOW() ELSE NULL END)`,
      [id, instructorId, title, slug, shortDescription, description, category, level, price, status, thumbnailUrl, status]
    );

    return executeOne('SELECT * FROM courses WHERE id = ? LIMIT 1', [id]);
  }

  async updateCourse(courseId, payload) {
    const allowed = ['title', 'slug', 'shortDescription', 'description', 'category', 'level', 'price', 'status', 'thumbnailUrl', 'instructorId'];
    const fields = [];
    const values = [];

    allowed.forEach((key) => {
      if (payload[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(payload[key]);
      }
    });

    if (fields.length === 0) {
      return executeOne('SELECT * FROM courses WHERE id = ? LIMIT 1', [courseId]);
    }

    values.push(courseId);
    await execute(`UPDATE courses SET ${fields.join(', ')}, updatedAt = NOW() WHERE id = ?`, values);
    return executeOne('SELECT * FROM courses WHERE id = ? LIMIT 1', [courseId]);
  }

  async deleteCourse(courseId) {
    const existing = await executeOne('SELECT id FROM courses WHERE id = ? LIMIT 1', [courseId]);
    if (!existing) throw new NotFoundError('Course not found');
    await execute('DELETE FROM courses WHERE id = ?', [courseId]);
    return { deleted: true };
  }

  async approveCourse(courseId) {
    const existing = await executeOne('SELECT id FROM courses WHERE id = ? LIMIT 1', [courseId]);
    if (!existing) throw new NotFoundError('Course not found');

    await execute(
      "UPDATE courses SET status = 'PUBLISHED', publishedAt = COALESCE(publishedAt, NOW()), updatedAt = NOW() WHERE id = ?",
      [courseId]
    );

    return executeOne('SELECT id, status, publishedAt FROM courses WHERE id = ? LIMIT 1', [courseId]);
  }

  async createSection(payload) {
    const { courseId, title, description = null, displayOrder = 0 } = payload;
    if (!courseId || !title) throw new ValidationError('courseId and title are required');

    const id = randomUUID();
    await execute(
      'INSERT INTO course_sections (id, courseId, title, description, displayOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      [id, courseId, title, description, displayOrder]
    );

    return executeOne('SELECT * FROM course_sections WHERE id = ? LIMIT 1', [id]);
  }

  async updateSection(sectionId, payload) {
    const allowed = ['title', 'description', 'displayOrder'];
    const fields = [];
    const values = [];

    allowed.forEach((key) => {
      if (payload[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(payload[key]);
      }
    });

    if (fields.length === 0) return executeOne('SELECT * FROM course_sections WHERE id = ? LIMIT 1', [sectionId]);

    values.push(sectionId);
    await execute(`UPDATE course_sections SET ${fields.join(', ')}, updatedAt = NOW() WHERE id = ?`, values);
    return executeOne('SELECT * FROM course_sections WHERE id = ? LIMIT 1', [sectionId]);
  }

  async deleteSection(sectionId) {
    const existing = await executeOne('SELECT id FROM course_sections WHERE id = ? LIMIT 1', [sectionId]);
    if (!existing) throw new NotFoundError('Section not found');
    await execute('DELETE FROM course_sections WHERE id = ?', [sectionId]);
    return { deleted: true };
  }

  async listLessons({ courseId, sectionId }) {
    const conditions = [];
    const params = [];

    if (courseId) {
      conditions.push('cl.courseId = ?');
      params.push(courseId);
    }
    if (sectionId) {
      conditions.push('cl.sectionId = ?');
      params.push(sectionId);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    return execute(
      `SELECT cl.id, cl.courseId, cl.sectionId, cl.title, cl.contentType, cl.videoUrl, cl.content,
              cl.documents, cl.durationMinutes, cl.isPreview, cl.displayOrder, cl.updatedAt,
              cs.title AS sectionTitle,
              c.title AS courseTitle
         FROM course_lessons cl
         JOIN course_sections cs ON cs.id = cl.sectionId
         JOIN courses c ON c.id = cl.courseId
         ${whereClause}
        ORDER BY c.title ASC, cs.displayOrder ASC, cl.displayOrder ASC`,
      params
    );
  }

  async createLesson(payload) {
    const {
      courseId,
      sectionId,
      title,
      contentType = 'VIDEO',
      videoUrl = null,
      content = null,
      documents = null,
      durationMinutes = 0,
      isPreview = false,
      displayOrder = 0,
    } = payload;

    if (!courseId || !sectionId || !title) {
      throw new ValidationError('courseId, sectionId, and title are required');
    }

    const id = randomUUID();
    const documentsJson = documents ? JSON.stringify(documents) : null;

    await execute(
      `INSERT INTO course_lessons (
        id, sectionId, courseId, title, contentType, videoUrl, content, documents,
        durationMinutes, isPreview, displayOrder, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, sectionId, courseId, title, contentType, videoUrl, content, documentsJson, durationMinutes, isPreview ? 1 : 0, displayOrder]
    );

    return executeOne('SELECT * FROM course_lessons WHERE id = ? LIMIT 1', [id]);
  }

  async updateLesson(lessonId, payload) {
    const allowed = ['sectionId', 'title', 'contentType', 'videoUrl', 'content', 'documents', 'durationMinutes', 'isPreview', 'displayOrder'];
    const fields = [];
    const values = [];

    allowed.forEach((key) => {
      if (payload[key] !== undefined) {
        fields.push(`${key} = ?`);
        if (key === 'isPreview') {
          values.push(payload[key] ? 1 : 0);
        } else if (key === 'documents') {
          values.push(payload[key] ? JSON.stringify(payload[key]) : null);
        } else {
          values.push(payload[key]);
        }
      }
    });

    if (fields.length === 0) return executeOne('SELECT * FROM course_lessons WHERE id = ? LIMIT 1', [lessonId]);

    values.push(lessonId);
    await execute(`UPDATE course_lessons SET ${fields.join(', ')}, updatedAt = NOW() WHERE id = ?`, values);
    return executeOne('SELECT * FROM course_lessons WHERE id = ? LIMIT 1', [lessonId]);
  }

  async deleteLesson(lessonId) {
    const existing = await executeOne('SELECT id FROM course_lessons WHERE id = ? LIMIT 1', [lessonId]);
    if (!existing) throw new NotFoundError('Lesson not found');
    await execute('DELETE FROM course_lessons WHERE id = ?', [lessonId]);
    return { deleted: true };
  }
}

export default new AdminLearningService();
