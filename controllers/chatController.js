const supabase = require('../config/db');
const { getChatResponse } = require('../services/chatbotService');
const { sendSuccess, sendError } = require('../utils/helpers');

const chat = async (req, res) => {
  try {
    const { message, conversation } = req.body;
    if (!message || !message.trim()) {
      return sendError(res, 'Message is required', 400);
    }

    const messages = (conversation || []).slice(-20);
    messages.push({ role: 'user', content: message.trim() });

    let userContext = {};
    if (req.user) {
      userContext.user = {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
      };
    }

    const reply = await getChatResponse(messages, userContext);
    if (!reply) {
      return sendError(res, 'AI returned empty response', 500);
    }

    sendSuccess(res, {
      reply,
      conversation: [...messages, { role: 'assistant', content: reply }],
    });
  } catch (err) {
    console.error('Chat error:', err.message);
    sendError(res, 'AI service temporarily unavailable. Please try again.');
  }
};

const getHistory = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) return sendError(res, error.message);
    sendSuccess(res, { data: data || [] });
  } catch (err) {
    sendError(res, err.message);
  }
};

const deleteHistory = async (req, res) => {
  try {
    const { error } = await supabase
      .from('chat_history')
      .delete()
      .eq('user_id', req.user.id);

    if (error) return sendError(res, error.message);
    sendSuccess(res, {}, 'Chat history deleted');
  } catch (err) {
    sendError(res, err.message);
  }
};

module.exports = { chat, getHistory, deleteHistory };
