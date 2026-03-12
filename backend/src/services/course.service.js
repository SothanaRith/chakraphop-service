import { NotFoundError, ValidationError, AuthorizationError, ConflictError } from '../utils/errors.js';
import {
  listCourses,
  getCourseBySlug,
  getCourseById,
  getCourseSections,
  getCourseLessons,
  createCourse,
  updateCourse,
  createCourseSection,
  createCourseLesson,
  updateCourseSection,
  getSectionById,
  updateCourseLesson,
  getLessonById,
  findEnrollment,
  createEnrollment,
  listStudentEnrollments,
  getEnrollmentById,
  upsertLessonProgress,
  listLessonsWithProgress,
  listInstructorCourses,
  getInstructorDashboardStats,
} from '../repositories/course.repository.js';

class CourseService {
  async getCourses(filters = {}) {
    let statusFilter = filters.status;

    if (!statusFilter) {
      statusFilter = 'PUBLISHED';
    }
    if (statusFilter === 'ALL') {
      statusFilter = null;
    }

    const result = await listCourses({
      ...filters,
      status: statusFilter,
    });

    return {
      courses: result.courses.map((course) => ({
        ...course,
        instructor: {
          id: course.instructor_id,
          firstName: course.instructor_firstName,
          lastName: course.instructor_lastName,
        },
      })),
      pagination: result.pagination,
    };
  }

  async getCourseDetail(slug, userId = null) {
    const course = await getCourseBySlug(slug);
    if (!course) {
      throw new NotFoundError('Course not found');
    }

    const sections = await getCourseSections(course.id);
    const lessons = await getCourseLessons(course.id);

    const lessonsBySection = lessons.reduce((acc, lesson) => {
      acc[lesson.sectionId] = acc[lesson.sectionId] || [];
      acc[lesson.sectionId].push(lesson);
      return acc;
    }, {});

    let enrollment = null;
    if (userId) {
      enrollment = await findEnrollment(course.id, userId);
    }

    return {
      ...course,
      instructor: {
        firstName: course.instructor_firstName,
        lastName: course.instructor_lastName,
        email: course.instructor_email,
      },
      enrollment,
      sections: sections.map((section) => ({
        ...section,
        lessons: lessonsBySection[section.id] || [],
      })),
    };
  }

  async createCourse(payload, user) {
    if (!['ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR'].includes(user.role)) {
      throw new AuthorizationError('Only admins and instructors can create courses');
    }

    const trimmedTitle = payload.title?.trim();
    const trimmedSlug = payload.slug?.trim();

    if (!trimmedTitle || !trimmedSlug || !payload.category) {
      throw new ValidationError('title, slug, and category are required');
    }

    const existing = await getCourseBySlug(trimmedSlug);
    if (existing) {
      throw new ConflictError('Course slug already exists');
    }

    return createCourse({
      ...payload,
      title: trimmedTitle,
      slug: trimmedSlug,
      instructorId: payload.instructorId || user.id,
      status: payload.status || 'DRAFT',
    });
  }

  async updateCourse(courseId, updates, user) {
    const course = await getCourseById(courseId);
    if (!course) {
      throw new NotFoundError('Course not found');
    }

    const isOwner = course.instructorId === user.id;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

    if (!isOwner && !isAdmin) {
      throw new AuthorizationError('You can only update your own courses');
    }

    return updateCourse(courseId, updates);
  }

  async createSection(courseId, payload, user) {
    const course = await getCourseById(courseId);
    if (!course) {
      throw new NotFoundError('Course not found');
    }

    const isOwner = course.instructorId === user.id;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

    if (!isOwner && !isAdmin) {
      throw new AuthorizationError('You can only manage your own course sections');
    }

    if (!payload.title?.trim()) {
      throw new ValidationError('Section title is required');
    }

    return createCourseSection({
      courseId,
      title: payload.title.trim(),
      description: payload.description,
      displayOrder: payload.displayOrder,
    });
  }

  async createLesson(courseId, payload, user) {
    const course = await getCourseById(courseId);
    if (!course) {
      throw new NotFoundError('Course not found');
    }

    const isOwner = course.instructorId === user.id;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

    if (!isOwner && !isAdmin) {
      throw new AuthorizationError('You can only manage your own course lessons');
    }

    if (!payload.sectionId || !payload.title?.trim()) {
      throw new ValidationError('sectionId and lesson title are required');
    }

    return createCourseLesson({
      courseId,
      sectionId: payload.sectionId,
      title: payload.title.trim(),
      contentType: payload.contentType || 'VIDEO',
      videoUrl: payload.videoUrl,
      content: payload.content,
      durationMinutes: payload.durationMinutes,
      isPreview: payload.isPreview,
      displayOrder: payload.displayOrder,
    });
  }

  async updateSection(sectionId, payload, user) {
    const section = await getSectionById(sectionId);
    if (!section) {
      throw new NotFoundError('Section not found');
    }

    const course = await getCourseById(section.courseId);
    if (!course) {
      throw new NotFoundError('Course not found');
    }

    const isOwner = course.instructorId === user.id;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

    if (!isOwner && !isAdmin) {
      throw new AuthorizationError('You can only edit your own course sections');
    }

    return updateCourseSection(sectionId, payload);
  }

  async updateLesson(lessonId, payload, user) {
    const lesson = await getLessonById(lessonId);
    if (!lesson) {
      throw new NotFoundError('Lesson not found');
    }

    const course = await getCourseById(lesson.courseId);
    if (!course) {
      throw new NotFoundError('Course not found');
    }

    const isOwner = course.instructorId === user.id;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

    if (!isOwner && !isAdmin) {
      throw new AuthorizationError('You can only edit your own course lessons');
    }

    return updateCourseLesson(lessonId, payload);
  }

  async enroll(courseId, user) {
    const course = await getCourseById(courseId);
    if (!course) {
      throw new NotFoundError('Course not found');
    }

    if (course.status !== 'PUBLISHED') {
      throw new ValidationError('Only published courses can be enrolled');
    }

    const existing = await findEnrollment(courseId, user.id);
    if (existing) {
      return existing;
    }

    return createEnrollment({
      courseId,
      studentId: user.id,
      totalLessons: course.totalLessons || 0,
    });
  }

  async getMyLearning(userId) {
    return listStudentEnrollments(userId);
  }

  async getCourseLearningLessons(courseId, userId) {
    const enrollment = await findEnrollment(courseId, userId);
    if (!enrollment) {
      throw new AuthorizationError('You are not enrolled in this course');
    }

    const lessons = await listLessonsWithProgress(courseId, enrollment.id);

    return {
      enrollment,
      lessons,
    };
  }

  async trackProgress(payload, userId) {
    if (!payload.courseId || !payload.lessonId) {
      throw new ValidationError('courseId and lessonId are required');
    }

    const enrollment = await findEnrollment(payload.courseId, userId);
    if (!enrollment) {
      throw new AuthorizationError('You are not enrolled in this course');
    }

    return upsertLessonProgress({
      enrollmentId: enrollment.id,
      lessonId: payload.lessonId,
      status: payload.status,
      watchTimeSeconds: payload.watchTimeSeconds,
      lastPositionSeconds: payload.lastPositionSeconds,
    });
  }

  async getInstructorDashboard(user) {
    if (!['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw new AuthorizationError('Instructor or admin access required');
    }

    const [stats, courses] = await Promise.all([
      getInstructorDashboardStats(user.id),
      listInstructorCourses(user.id),
    ]);

    return {
      stats,
      courses,
    };
  }

  async getEnrollmentByIdForUser(enrollmentId, userId) {
    const enrollment = await getEnrollmentById(enrollmentId);
    if (!enrollment || enrollment.studentId !== userId) {
      throw new NotFoundError('Enrollment not found');
    }

    return enrollment;
  }
}

export default new CourseService();
