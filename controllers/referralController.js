const supabase = require('../config/db');
const { sendSuccess, sendError } = require('../utils/helpers');

// GET /api/referrals
const getReferrals = async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('referral_code')
      .eq('id', req.user.id)
      .single();

    const { data: referrals, error } = await supabase
      .from('referrals')
      .select('*, referred_user:referred_user_id(name, email, created_at)')
      .eq('referrer_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return sendError(res, error.message);

    const totalEarned = referrals
      .filter((r) => r.reward_given)
      .reduce((sum, r) => sum + r.reward_coins, 0);

    return sendSuccess(res, {
      data: {
        referral_code: user.referral_code,
        total_referrals: referrals.length,
        total_coins_earned: totalEarned,
        referrals,
      },
    });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/referrals/admin/all (admin only)
const getAllReferrals = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { data: referrals, error, count } = await supabase
      .from('referrals')
      .select(`
        *,
        referrer:referrer_id(name, email, public_id),
        referred_user:referred_user_id(name, email, public_id, created_at)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) return sendError(res, error.message);

    // Calculate total stats
    const { data: allReferrals } = await supabase
      .from('referrals')
      .select('reward_coins, reward_given');

    const totalReferrals = allReferrals?.length || 0;
    const totalCoinsGiven = allReferrals
      ?.filter(r => r.reward_given)
      .reduce((sum, r) => sum + r.reward_coins, 0) || 0;

    return sendSuccess(res, {
      data: referrals,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit) },
      stats: {
        total_referrals: totalReferrals,
        total_coins_given: totalCoinsGiven,
      },
    });
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { getReferrals, getAllReferrals };
