import { Router } from 'express';

import { customersService } from './customers.service';

export const customersRoutes = Router();

function isOptionalText(value: unknown, maxLength: number): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.trim().length <= maxLength);
}

customersRoutes.get('/', async (req, res, next) => {
  try {
    const data = await customersService.list(req.auth!.organizationId);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
});

customersRoutes.post('/', async (req, res, next) => {
  const body = req.body as {
    entityType?: unknown;
    fullName?: unknown;
    companyName?: unknown;
    documentNumber?: unknown;
    bejermanId?: unknown;
    email?: unknown;
    phone?: unknown;
    contact?: unknown;
  };
  const contact = body.contact && typeof body.contact === 'object' && !Array.isArray(body.contact)
    ? body.contact as Record<string, unknown>
    : undefined;
  const entityType = body.entityType;
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const contactEmail = typeof contact?.email === 'string' ? contact.email.trim().toLowerCase() : '';

  if (
    (entityType !== 'person' && entityType !== 'company') ||
    !fullName || fullName.length > 200 ||
    (entityType === 'company' && !companyName) ||
    !isOptionalText(body.companyName, 200) ||
    !isOptionalText(body.documentNumber, 80) ||
    !isOptionalText(body.bejermanId, 100) ||
    !isOptionalText(body.email, 254) ||
    !isOptionalText(body.phone, 80) ||
    (email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
    (contact && (
      typeof contact.fullName !== 'string' || !contact.fullName.trim() || contact.fullName.length > 200 ||
      !isOptionalText(contact.title, 200) ||
      !isOptionalText(contact.relationship, 20) ||
      (contact.relationship !== undefined &&
        contact.relationship !== 'owner' && contact.relationship !== 'employee' && contact.relationship !== 'other') ||
      !isOptionalText(contact.email, 254) ||
      !isOptionalText(contact.phone, 80) ||
      (contactEmail !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
    )) ||
    (entityType === 'person' && contact !== undefined)
  ) {
    res.status(400).json({ message: 'Datos inválidos para crear el cliente.' });
    return;
  }

  try {
    const result = await customersService.create(req.auth!.organizationId, {
      entityType,
      fullName,
      ...(companyName ? { companyName } : {}),
      ...(typeof body.documentNumber === 'string' ? { documentNumber: body.documentNumber.trim() } : {}),
      ...(typeof body.bejermanId === 'string' ? { bejermanId: body.bejermanId.trim() } : {}),
      ...(email ? { email } : {}),
      ...(typeof body.phone === 'string' && body.phone.trim() ? { phone: body.phone.trim() } : {}),
      ...(contact ? {
        contact: {
          fullName: (contact.fullName as string).trim(),
          ...(typeof contact.title === 'string' && contact.title.trim() ? { title: contact.title.trim() } : {}),
          ...(contact.relationship === 'owner' || contact.relationship === 'employee' || contact.relationship === 'other'
            ? { relationship: contact.relationship }
            : {}),
          ...(contactEmail ? { email: contactEmail } : {}),
          ...(typeof contact.phone === 'string' && contact.phone.trim() ? { phone: contact.phone.trim() } : {})
        }
      } : {})
    });
    if (result.duplicate) {
      res.status(409).json({
        message: 'Ya existe un cliente con esa identidad. Revisa la ficha antes de crear otra.',
        customerId: result.customerId
      });
      return;
    }
    res.status(201).json(result.customer);
  } catch (error) {
    next(error);
  }
});
