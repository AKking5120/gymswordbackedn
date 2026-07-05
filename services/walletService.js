const supabase = require('../config/db');

const creditWallet = async (userId, coins, description) => {
  const { data: user, error: fetchErr } = await supabase
    .from('users')
    .select('wallet_coins')
    .eq('id', userId)
    .single();

  if (fetchErr) {
    console.error('creditWallet fetch error:', fetchErr.message);
    throw new Error('Failed to fetch user wallet');
  }

  const newBalance = (user?.wallet_coins || 0) + coins;

  const { error: updateErr } = await supabase
    .from('users')
    .update({ wallet_coins: newBalance })
    .eq('id', userId);

  if (updateErr) {
    console.error('creditWallet update error:', updateErr.message);
    throw new Error('Failed to update wallet balance');
  }

  const { error: txErr } = await supabase.from('wallet_transactions').insert({
    user_id: userId,
    coins,
    transaction_type: 'credit',
    description,
  });

  if (txErr) {
    console.error('creditWallet transaction log error:', txErr.message);
    // Don't throw here — wallet was already updated, just log failed
  }

  return newBalance;
};

const debitWallet = async (userId, coins, description) => {
  const { data: user } = await supabase
    .from('users')
    .select('wallet_coins')
    .eq('id', userId)
    .single();

  if (!user || user.wallet_coins < coins) {
    throw new Error('Insufficient wallet balance');
  }

  const newBalance = user.wallet_coins - coins;

  await supabase.from('users').update({ wallet_coins: newBalance }).eq('id', userId);

  await supabase.from('wallet_transactions').insert({
    user_id: userId,
    coins: -coins,
    transaction_type: 'debit',
    description,
  });

  return newBalance;
};

module.exports = { creditWallet, debitWallet };
