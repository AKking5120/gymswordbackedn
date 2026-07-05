const supabase = require('../config/db');
const { sendSuccess, sendError } = require('../utils/helpers');

const TABLE = 'visitor_leads';
const TABLE_MISSING = 'Visitor leads table not set up. Run backend/migrations/visitor_leads.sql in Supabase SQL Editor.';

const isMissingTable = (error) => error?.code === 'PGRST205';

// POST /api/leads
const submitLead = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!email?.trim()) {
      return sendError(res, 'Email is required', 400);
    }

    // Check for duplicate email
    const { data: existing } = await supabase
      .from(TABLE)
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (existing) {
      return sendSuccess(res, { id: existing.id }, 'Already registered');
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        name: name?.trim() || null,
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (isMissingTable(error)) return sendError(res, TABLE_MISSING, 503);
      return sendError(res, error.message);
    }

    return sendSuccess(res, { data }, 'Welcome to GymSword!', 201);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/admin/leads
const getLeads = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingTable(error)) return sendSuccess(res, { data: [] });
      return sendError(res, error.message);
    }

    return sendSuccess(res, { data });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// DELETE /api/admin/leads/:id
const deleteLead = async (req, res) => {
  try {
    const { error } = await supabase.from(TABLE).delete().eq('id', req.params.id);

    if (error) {
      if (isMissingTable(error)) return sendError(res, TABLE_MISSING, 503);
      return sendError(res, error.message);
    }

    return sendSuccess(res, {}, 'Lead deleted');
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = {
  submitLead,
  getLeads,
  deleteLead,
};
