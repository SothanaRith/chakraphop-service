// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRODUCT DOMAIN MODEL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class Product {
  constructor({ id, name, status }) {
    this.id = id;
    this.name = name;
    this.status = status;
  }

  static fromData(data) {
    return new Product({
      id: data.id,
      name: data.name,
      status: data.status,
    });
  }

  isVisible() {
    return this.status === 'ACTIVE';
  }
}

export default Product;
