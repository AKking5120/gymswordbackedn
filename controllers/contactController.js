const supabase = require('../config/db');
const { sendSuccess, sendError } = require('../utils/helpers');

const TABLE = 'contact_messages';
const TABLE_MISSING = 'Contact messages table not set up. Run backend/migrations/contact_messages.sql in Supabase SQL Editor.';

const isMissingTable = (error) => error?.code === 'PGRST205';

// POST /api/contact
const submitContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!email?.trim() || !message?.trim()) {
      return sendError(res, 'Email and message are required', 400);
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        name: name?.trim() || null,
        email: email.trim(),
        subject: subject?.trim() || null,
        message: message.trim(),
        status: 'new',
      })
      .select()
      .single();

    if (error) {
      if (isMissingTable(error)) return sendError(res, TABLE_MISSING, 503);
      return sendError(res, error.message);
    }

    return sendSuccess(res, { data }, 'Message sent', 201);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/admin/contact-messages
const getContactMessages = async (req, res) => {
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

// PATCH /api/admin/contact-messages/:id
const updateContactMessage = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return sendError(res, 'status is required', 400);

    const { data, error } = await supabase
      .from(TABLE)
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (isMissingTable(error)) return sendError(res, TABLE_MISSING, 503);
      return sendError(res, error.message);
    }
    if (!data) return sendError(res, 'Message not found', 404);

    return sendSuccess(res, { data }, 'Message updated');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// DELETE /api/admin/contact-messages/:id
const deleteContactMessage = async (req, res) => {
  try {
    const { error } = await supabase.from(TABLE).delete().eq('id', req.params.id);

    if (error) {
      if (isMissingTable(error)) return sendError(res, TABLE_MISSING, 503);
      return sendError(res, error.message);
    }

    return sendSuccess(res, {}, 'Message deleted');
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = {
  submitContact,
  getContactMessages,
  updateContactMessage,
  deleteContactMessage,
};
