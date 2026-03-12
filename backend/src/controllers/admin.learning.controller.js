import adminLearningService from '../services/admin.learning.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

class AdminLearningController {
  getInstructors = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search = '' } = req.query;
    const data = await adminLearningService.listInstructors({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
    });

    res.json(success(data, 'Instructors retrieved successfully'));
  });

  approveInstructor = asyncHandler(async (req, res) => {
    const data = await adminLearningService.approveInstructor(req.params.userId);
    res.json(success(data, 'Instructor approved successfully'));
  });

  suspendInstructor = asyncHandler(async (req, res) => {
    const data = await adminLearningService.suspendInstructor(req.params.userId);
    res.json(success(data, 'Instructor suspended successfully'));
  });

  getInstructorCourses = asyncHandler(async (req, res) => {
    const data = await adminLearningService.getInstructorCourses(req.params.userId);
    res.json(success(data, 'Instructor courses retrieved successfully'));
  });

  getInstructorRevenue = asyncHandler(async (req, res) => {
    const data = await adminLearningService.getInstructorRevenue(req.params.userId);
    res.json(success(data, 'Instructor revenue retrieved successfully'));
  });

  getEnrollments = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, courseId, studentId, status } = req.query;
    const data = await adminLearningService.listEnrollments({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      courseId,
      studentId,
      status,
    });

    res.json(success(data, 'Enrollments retrieved successfully'));
  });

  removeEnrollment = asyncHandler(async (req, res) => {
    const data = await adminLearningService.removeEnrollment(req.params.enrollmentId);
    res.json(success(data, 'Enrollment removed successfully'));
  });

  getEnrollmentProgress = asyncHandler(async (req, res) => {
    const data = await adminLearningService.getEnrollmentProgress(req.params.enrollmentId);
    res.json(success(data, 'Enrollment progress retrieved successfully'));
  });

  getCourses = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, search } = req.query;
    const data = await adminLearningService.listCourses({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status,
      search,
    });

    res.json(success(data, 'Courses retrieved successfully'));
  });

  createCourse = asyncHandler(async (req, res) => {
    const data = await adminLearningService.createCourse(req.body);
    res.status(201).json(success(data, 'Course created successfully'));
  });

  updateCourse = asyncHandler(async (req, res) => {
    const data = await adminLearningService.updateCourse(req.params.courseId, req.body);
    res.json(success(data, 'Course updated successfully'));
  });

  deleteCourse = asyncHandler(async (req, res) => {
    const data = await adminLearningService.deleteCourse(req.params.courseId);
    res.json(success(data, 'Course deleted successfully'));
  });

  approveCourse = asyncHandler(async (req, res) => {
    const data = await adminLearningService.approveCourse(req.params.courseId);
    res.json(success(data, 'Course approved successfully'));
  });

  createSection = asyncHandler(async (req, res) => {
    const data = await adminLearningService.createSection(req.body);
    res.status(201).json(success(data, 'Section created successfully'));
  });

  updateSection = asyncHandler(async (req, res) => {
    const data = await adminLearningService.updateSection(req.params.sectionId, req.body);
    res.json(success(data, 'Section updated successfully'));
  });

  deleteSection = asyncHandler(async (req, res) => {
    const data = await adminLearningService.deleteSection(req.params.sectionId);
    res.json(success(data, 'Section deleted successfully'));
  });

  getLessons = asyncHandler(async (req, res) => {
    const data = await adminLearningService.listLessons(req.query);
    res.json(success(data, 'Lessons retrieved successfully'));
  });

  createLesson = asyncHandler(async (req, res) => {
    const data = await adminLearningService.createLesson(req.body);
    res.status(201).json(success(data, 'Lesson created successfully'));
  });

  updateLesson = asyncHandler(async (req, res) => {
    const data = await adminLearningService.updateLesson(req.params.lessonId, req.body);
    res.json(success(data, 'Lesson updated successfully'));
  });

  deleteLesson = asyncHandler(async (req, res) => {
    const data = await adminLearningService.deleteLesson(req.params.lessonId);
    res.json(success(data, 'Lesson deleted successfully'));
  });
}

export default new AdminLearningController();
