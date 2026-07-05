const supabase = require('../config/db');
const { sendSuccess, sendError } = require('../utils/helpers');

// GET /api/wallet
const getWallet = async (req, res) => {
  try {
    console.log('[Wallet API] Fetching wallet for user:', req.user.id);
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('wallet_coins')
      .eq('id', req.user.id)
      .single();

    if (userErr) return sendError(res, userErr.message);

    const { data: transactions, error: txErr } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (txErr) {
      console.error('wallet_transactions fetch error:', txErr.message);
    }

    const allTx = transactions || [];
    const totalDebits = allTx
      .filter((t) => t.coins < 0)
      .reduce((sum, t) => sum + Math.abs(t.coins), 0);
    const totalEarnedCoins = (user.wallet_coins || 0) + totalDebits;
    const referralCoins = allTx
      .filter((t) => t.coins > 0 && t.description && t.description.toLowerCase().includes('referral'))
      .reduce((sum, t) => sum + t.coins, 0);

    const membershipLevel =
      totalEarnedCoins >= 1000 ? 'Platinum' :
      totalEarnedCoins >= 500 ? 'Gold' :
      totalEarnedCoins >= 100 ? 'Silver' : 'Bronze';

    const mappedTransactions = allTx.map((t) => ({
      _id: t.id,
      coins: t.coins,
      description: t.description,
      createdAt: t.created_at,
    }));

    return sendSuccess(res, {
      data: {
        availableCoins: user.wallet_coins || 0,
        totalEarnedCoins,
        referralCoins,
        membershipLevel,
        transactions: mappedTransactions,
      },
    });
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { getWallet };
