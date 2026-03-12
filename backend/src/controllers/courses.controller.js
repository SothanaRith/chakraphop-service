import courseService from '../services/course.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

class CoursesController {
  getCourses = asyncHandler(async (req, res) => {
    const result = await courseService.getCourses(req.query);
    res.json(success(result));
  });

  getCourseBySlug = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const course = await courseService.getCourseDetail(slug, req.user?.id || null);
    res.json(success(course));
  });

  createCourse = asyncHandler(async (req, res) => {
    const course = await courseService.createCourse(req.body, req.user);
    res.status(201).json(success(course, 'Course created successfully'));
  });

  updateCourse = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const course = await courseService.updateCourse(id, req.body, req.user);
    res.json(success(course, 'Course updated successfully'));
  });

  createSection = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const section = await courseService.createSection(id, req.body, req.user);
    res.status(201).json(success(section, 'Section created successfully'));
  });

  createLesson = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const lesson = await courseService.createLesson(id, req.body, req.user);
    res.status(201).json(success(lesson, 'Lesson created successfully'));
  });

  updateSection = asyncHandler(async (req, res) => {
    const { sectionId } = req.params;
    const section = await courseService.updateSection(sectionId, req.body, req.user);
    res.json(success(section, 'Section updated successfully'));
  });

  updateLesson = asyncHandler(async (req, res) => {
    const { lessonId } = req.params;
    const lesson = await courseService.updateLesson(lessonId, req.body, req.user);
    res.json(success(lesson, 'Lesson updated successfully'));
  });

  enroll = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const enrollment = await courseService.enroll(id, req.user);
    res.status(201).json(success(enrollment, 'Enrollment successful'));
  });

  getMyLearning = asyncHandler(async (req, res) => {
    const courses = await courseService.getMyLearning(req.user.id);
    res.json(success(courses));
  });

  getLearningLessons = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = await courseService.getCourseLearningLessons(id, req.user.id);
    res.json(success(data));
  });

  trackProgress = asyncHandler(async (req, res) => {
    const progress = await courseService.trackProgress(req.body, req.user.id);
    res.json(success(progress, 'Progress updated'));
  });

  getInstructorDashboard = asyncHandler(async (req, res) => {
    const dashboard = await courseService.getInstructorDashboard(req.user);
    res.json(success(dashboard));
  });
}

export default new CoursesController();
