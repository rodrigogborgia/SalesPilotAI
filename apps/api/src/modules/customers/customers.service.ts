export const customersService = {
  async list() {
    return [
      {
        id: 'customer-1',
        organizationId: 'demo-org',
        fullName: 'Carlos López',
        companyName: 'Industria Pro-Aire',
        phone: '+5491122334455',
        status: 'active'
      }
    ];
  },

  async create(payload: Record<string, unknown>) {
    return {
      id: 'customer-new',
      organizationId: 'demo-org',
      ...payload,
      status: 'active'
    };
  }
};
