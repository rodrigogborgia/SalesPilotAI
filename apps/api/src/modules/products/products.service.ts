export const productsService = {
  async list() {
    return [
      {
        id: 'product-1',
        organizationId: 'demo-org',
        sku: 'AIR-1000',
        name: 'Secador de Aire Industrial',
        price: 1250.0,
        isActive: true
      }
    ];
  },

  async create(payload: Record<string, unknown>) {
    return {
      id: 'product-new',
      organizationId: 'demo-org',
      ...payload,
      isActive: true
    };
  }
};
