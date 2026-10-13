export const organizationsService = {
  async list() {
    return [
      {
        id: 'demo-org',
        name: 'Pro-Aire',
        slug: 'pro-aire',
        brandName: 'SalesPilotAI',
        status: 'active'
      }
    ];
  },

  async create(payload: Record<string, unknown>) {
    return {
      id: 'demo-org',
      ...payload,
      status: 'active'
    };
  }
};
