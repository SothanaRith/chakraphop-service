import { execute, executeOne } from '../db/index.js';

class AdminDashboardService {
  async getSummary() {
    const [
      users,
      instructors,
      courses,
      products,
      orders,
      revenue,
      recentOrders,
      recentEnrollments,
      lowStock,
    ] = await Promise.all([
      executeOne('SELECT COUNT(*) AS total FROM users'),
      executeOne("SELECT COUNT(*) AS total FROM users WHERE role = 'INSTRUCTOR'"),
      executeOne('SELECT COUNT(*) AS total FROM courses'),
      executeOne('SELECT COUNT(*) AS total FROM products'),
      executeOne('SELECT COUNT(*) AS total FROM orders'),
      executeOne("SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE status IN ('PAID','PROCESSING','SHIPPED','DELIVERED')"),
      execute(
        `SELECT o.id, o.orderNumber, o.status, o.total, o.createdAt,
                u.email, CONCAT(COALESCE(u.firstName, ''), ' ', COALESCE(u.lastName, '')) AS customerName
           FROM orders o
           LEFT JOIN users u ON u.id = o.userId
          ORDER BY o.createdAt DESC
          LIMIT 10`
      ),
      execute(
        `SELECT ce.id, ce.status, ce.progressPercent, ce.enrolledAt,
                c.id AS courseId, c.title AS courseTitle,
                u.id AS studentId, u.email AS studentEmail,
                CONCAT(COALESCE(u.firstName, ''), ' ', COALESCE(u.lastName, '')) AS studentName
           FROM course_enrollments ce
           JOIN courses c ON c.id = ce.courseId
           JOIN users u ON u.id = ce.studentId
          ORDER BY ce.enrolledAt DESC
          LIMIT 10`
      ),
      execute(
        `SELECT pv.id, pv.sku, pv.stockQuantity, pv.lowStockThreshold, p.name AS productName
           FROM product_variants pv
           JOIN products p ON p.id = pv.productId
          WHERE pv.isActive = 1 AND pv.stockQuantity <= pv.lowStockThreshold
          ORDER BY pv.stockQuantity ASC
          LIMIT 20`
      ),
    ]);

    return {
      totals: {
        users: users?.total || 0,
        instructors: instructors?.total || 0,
        courses: courses?.total || 0,
        products: products?.total || 0,
        orders: orders?.total || 0,
        revenue: Number(revenue?.total || 0),
      },
      recentOrders,
      recentEnrollments,
      alerts: {
        lowStockCount: lowStock.length,
        lowStockItems: lowStock,
      },
    };
  }
}

export default new AdminDashboardService();
