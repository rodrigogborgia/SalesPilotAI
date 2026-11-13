import { Router } from 'express';

import { adminService } from './admin.service';

export const adminRoutes = Router();

function isInvoiceOwner(value: unknown): value is 'David' | 'Luciana' {
  return value === 'David' || value === 'Luciana';
}

function isInvoiceBusinessUnit(value: unknown): value is 'equipment' | 'service' | 'spare_parts' {
  return value === 'equipment' || value === 'service' || value === 'spare_parts';
}

function isInvoiceCustomerType(value: unknown): value is 'new' | 'active' | 'reactivated' | 'unknown' {
  return value === 'new' || value === 'active' || value === 'reactivated' || value === 'unknown';
}

adminRoutes.get('/audiences', async (req, res, next) => {
  try {
    res.status(200).json(await adminService.listAudiences(req.auth!.organizationId));
  } catch (error) {
    next(error);
  }
});

adminRoutes.get('/audiences/export', async (req, res, next) => {
  try {
    const csv = await adminService.exportAudience(req.auth!.organizationId);
    res
      .status(200)
      .type('text/csv')
      .attachment('salespilot-meta-audience.csv')
      .send(csv);
  } catch (error) {
    next(error);
  }
});

adminRoutes.post('/audiences/sync', async (req, res, next) => {
  try {
    res.status(200).json(await adminService.simulateMetaSync(req.auth!.organizationId));
  } catch (error) {
    next(error);
  }
});

adminRoutes.get('/sales-import', async (req, res, next) => {
  try {
    res.status(200).json(await adminService.getCompletedSalesAudiences(req.auth!.organizationId));
  } catch (error) {
    next(error);
  }
});

adminRoutes.post('/sales-import', async (req, res, next) => {
  const input = req.body?.sales;
  if (!Array.isArray(input) || input.length === 0) {
    res.status(400).json({ message: 'Envía una lista no vacía de ventas en el campo sales.' });
    return;
  }

  const sales = [];
  for (const [index, row] of input.entries()) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      res.status(400).json({ message: `La venta de la fila ${index + 1} no es válida.` });
      return;
    }
    const candidate = row as Record<string, unknown>;
    const email = typeof candidate.email === 'string' ? candidate.email.trim().toLowerCase() : '';
    const phone = typeof candidate.phone === 'string' ? candidate.phone.trim() : '';
    const company = typeof candidate.company === 'string' ? candidate.company.trim() : '';
    const amount = typeof candidate.amount === 'number' || typeof candidate.amount === 'string'
      ? Number(String(candidate.amount).replace(',', '.'))
      : Number.NaN;
    const purchaseDate = typeof candidate.purchaseDate === 'string'
      ? new Date(candidate.purchaseDate)
      : new Date(Number.NaN);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !company || !Number.isFinite(amount) || amount < 0 ||
      Number.isNaN(purchaseDate.getTime()) || purchaseDate.getTime() > Date.now()) {
      res.status(400).json({
        message: `Datos inválidos en la fila ${index + 1}: revisa email, empresa, monto y fecha de compra.`
      });
      return;
    }
    sales.push({ email, phone: phone || null, company, amount, purchaseDate });
  }

  try {
    res.status(200).json(await adminService.importCompletedSales(req.auth!.organizationId, sales));
  } catch (error) {
    next(error);
  }
});

adminRoutes.post('/invoices-import', async (req, res, next) => {
  const input = req.body?.invoices;
  if (!Array.isArray(input) || input.length === 0) {
    res.status(400).json({ message: 'Envía una lista no vacía de facturas en el campo invoices.' });
    return;
  }

  const invoices = [];
  const seenLines = new Set<string>();
  for (const [index, row] of input.entries()) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      res.status(400).json({ message: `La factura de la fila ${index + 1} no es válida.` });
      return;
    }
    const candidate = row as Record<string, unknown>;
    const invoiceNumber = typeof candidate.invoiceNumber === 'string' ? candidate.invoiceNumber.trim() : '';
    const lineNumber = candidate.lineNumber === undefined ? 1 : Number(candidate.lineNumber);
    const invoiceDate = typeof candidate.invoiceDate === 'string'
      ? new Date(candidate.invoiceDate)
      : new Date(Number.NaN);
    const email = typeof candidate.email === 'string' ? candidate.email.trim().toLowerCase() : '';
    const company = typeof candidate.company === 'string' ? candidate.company.trim() : '';
    const salesOwner = candidate.salesOwner;
    const businessUnit = candidate.businessUnit;
    const amount = typeof candidate.amount === 'number' || typeof candidate.amount === 'string'
      ? Number(String(candidate.amount).replace(',', '.'))
      : Number.NaN;
    const equipmentQuantity = candidate.equipmentQuantity === undefined
      ? 0
      : Number(candidate.equipmentQuantity);
    const customerType = candidate.customerType;
    const lineKey = `${invoiceNumber}:${lineNumber}`;

    if (
      !invoiceNumber || invoiceNumber.length > 100 ||
      !Number.isInteger(lineNumber) || lineNumber < 1 ||
      !company || company.length > 200 ||
      (candidate.email !== undefined && candidate.email !== null && typeof candidate.email !== 'string') ||
      (email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      !Number.isFinite(invoiceDate.getTime()) || invoiceDate.getTime() > Date.now() ||
      !isInvoiceOwner(salesOwner) ||
      !isInvoiceBusinessUnit(businessUnit) ||
      !Number.isFinite(amount) || amount < 0 ||
      !Number.isInteger(equipmentQuantity) || equipmentQuantity < 0 ||
      (businessUnit === 'equipment' && equipmentQuantity < 1) ||
      (businessUnit !== 'equipment' && equipmentQuantity !== 0) ||
      (customerType !== undefined && !isInvoiceCustomerType(customerType)) ||
      seenLines.has(lineKey)
    ) {
      res.status(400).json({
        message: `Datos inválidos o duplicados en la fila ${index + 1}: revisa número y línea, fecha, cliente, responsable, rubro y monto.`
      });
      return;
    }
    seenLines.add(lineKey);
    invoices.push({
      invoiceNumber,
      lineNumber,
      invoiceDate,
      email: email || null,
      company,
      salesOwner,
      businessUnit,
      amount,
      equipmentQuantity,
      ...(isInvoiceCustomerType(customerType) ? { customerType } : {})
    });
  }

  try {
    res.status(200).json(
      await adminService.importCommercialInvoices(req.auth!.organizationId, invoices)
    );
  } catch (error) {
    next(error);
  }
});

adminRoutes.get('/sales-import/export', async (req, res, next) => {
  try {
    const csv = await adminService.exportCompletedSalesAudiences(req.auth!.organizationId);
    res.status(200).type('text/csv').attachment('salespilot-meta-completed-sales.csv').send(csv);
  } catch (error) {
    next(error);
  }
});

adminRoutes.post('/sales-import/sync', async (req, res, next) => {
  try {
    res.status(200).json(await adminService.simulateCompletedSalesMetaSync(req.auth!.organizationId));
  } catch (error) {
    next(error);
  }
});

adminRoutes.get('/dashboard', async (req, res, next) => {
  const rawDays = req.query.days ?? '30';
  const days = rawDays === 'all' ? 0 : Number(rawDays);
  if (![0, 7, 30, 90].includes(days)) {
    res.status(400).json({ message: 'Rango inválido. Usa 7, 30, 90 o all.' });
    return;
  }

  try {
    res.status(200).json(await adminService.getDashboard(req.auth!.organizationId, days));
  } catch (error) {
    next(error);
  }
});
