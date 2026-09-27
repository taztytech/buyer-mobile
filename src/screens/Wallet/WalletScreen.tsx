import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import {
  formatRupees,
  topupFee,
  topupBonus,
  ExpiringCredit,
  ReferralCard,
  TopupLimits,
  walletService,
  WALLET_BUCKET_LABELS,
  WalletBucket,
  WalletSummary,
  WalletTransaction,
} from '@/services/wallet.service';
import { paymentService, PaymentErrorType } from '@/services/payment.service';

const GREEN = '#00B14F';
const PAGE_SIZE = 20;

interface WalletScreenProps {
  onBack: () => void;
  /** Open the Add-money sheet straight away (e.g. from the Home wallet pill's +). */
  initialAddOpen?: boolean;
}

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

/**
 * Tazty Wallet: balance, where it came from, and every movement.
 *
 * Balance can only be spent on Tazty - it is never paid out to a bank, which
 * is said on the card so nobody expects a withdraw button.
 */
export const WalletScreen: React.FC<WalletScreenProps> = ({ onBack, initialAddOpen }) => {
  const [summary, setSummary] = React.useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = React.useState<WalletTransaction[]>([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [selected, setSelected] = React.useState<WalletTransaction | null>(null);
  // Add money (top-up): shown only when the server allows it for this customer.
  const [limits, setLimits] = React.useState<TopupLimits | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [amountText, setAmountText] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [referral, setReferral] = React.useState<ReferralCard | null>(null);
  const [codeOpen, setCodeOpen] = React.useState(false);
  const [codeText, setCodeText] = React.useState('');
  const [codeMode, setCodeMode] = React.useState<'promo' | 'referral'>('promo');
  const [codeBusy, setCodeBusy] = React.useState(false);
  const [codeError, setCodeError] = React.useState<string | null>(null);

  // Opened straight into Add-money (e.g. the Home wallet pill's +). Wait for the
  // top-up limits so the sheet has its suggestions, and only fire once.
  const autoOpenedRef = React.useRef(false);
  React.useEffect(() => {
    if (initialAddOpen && limits?.enabled && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setAmountText('');
      setAddError(null);
      setAddOpen(true);
    }
  }, [initialAddOpen, limits?.enabled]);

  const load = React.useCallback(async () => {
    const [s, h] = await Promise.all([
      walletService.getSummary(),
      walletService.getTransactions(1, PAGE_SIZE),
    ]);
    setFailed(!s);
    setSummary(s);
    setTransactions(h?.transactions ?? []);
    setHasMore(!!h?.pagination?.has_more);
    setPage(1);
    if (s?.enabled) {
      const [lim, ref] = await Promise.all([
        walletService.getTopupLimits(),
        walletService.getReferral(),
      ]);
      setLimits(lim);
      setReferral(ref);
    } else {
      setLimits(null);
      setReferral(null);
    }
  }, []);

  React.useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const next = page + 1;
    const h = await walletService.getTransactions(next, PAGE_SIZE);
    if (h) {
      setTransactions(prev => [...prev, ...h.transactions]);
      setHasMore(h.pagination.has_more);
      setPage(next);
    }
    setLoadingMore(false);
  };

  const buckets = summary?.buckets;
  const nonZeroBuckets = buckets
    ? (Object.keys(WALLET_BUCKET_LABELS) as WalletBucket[]).filter(b => Number(buckets[b]) > 0)
    : [];

  const expiring: ExpiringCredit[] = summary?.expiring ?? [];

  const openCodeSheet = (mode: 'promo' | 'referral') => {
    setCodeMode(mode);
    setCodeText('');
    setCodeError(null);
    setCodeOpen(true);
  };

  const shareReferral = async () => {
    if (!referral?.code) return;
    try {
      await Share.share({
        message: `Use my code ${referral.code} on Tazty and get ${formatRupees(
          referral.referee_amount,
        )} off your first order. Download the app and order your favourites.`,
      });
    } catch {
      // The customer closed the share sheet - nothing to do.
    }
  };

  const submitCode = async () => {
    const code = codeText.trim();
    if (!code) return;
    setCodeBusy(true);
    setCodeError(null);
    try {
      if (codeMode === 'referral') {
        const res = await walletService.applyReferral(code);
        setCodeOpen(false);
        setNotice(res.message || 'Code applied.');
      } else {
        const res = await walletService.redeemCode(code);
        setCodeOpen(false);
        setNotice(
          `${formatRupees(res.amount)} added. Use it within ${res.expires_in_days} day${
            res.expires_in_days > 1 ? 's' : ''
          }${res.min_order > 0 ? ` on orders above ${formatRupees(res.min_order)}` : ''}.`,
        );
      }
      await load();
    } catch (e: any) {
      setCodeError(e?.message || 'That code could not be used.');
    } finally {
      setCodeBusy(false);
    }
  };

  const renderHeader = () => (
    <View>
      <View style={styles.balanceCard} testID="wallet-balance-card">
        <View style={styles.balanceTopRow}>
          <MaterialIcons name="account-balance-wallet" size={22} color={GREEN} />
          <Text style={styles.balanceLabel}>Tazty Wallet balance</Text>
        </View>
        <Text style={styles.balanceAmount} testID="wallet-balance-amount">
          {formatRupees(summary?.balance)}
        </Text>
        <Text style={styles.balanceHint}>
          Use it on any Tazty order. Wallet balance can't be moved to a bank account.
        </Text>
        {Number(summary?.on_hold || 0) > 0 ? (
          <Text style={styles.onHoldHint} testID="wallet-on-hold">
            {formatRupees(summary?.on_hold)} on hold for an order waiting for payment. It comes
            back automatically if the payment isn't completed.
          </Text>
        ) : null}

        {limits?.enabled && (
          <TouchableOpacity
            style={styles.addMoneyButton}
            onPress={() => {
              setAmountText('');
              setAddError(null);
              setAddOpen(true);
            }}
            testID="wallet-add-money"
          >
            <MaterialIcons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addMoneyText}>Add money</Text>
          </TouchableOpacity>
        )}

        {nonZeroBuckets.length > 0 && (
          <View style={styles.bucketRow}>
            {nonZeroBuckets.map(b => (
              <View key={b} style={styles.bucketChip} testID={`wallet-bucket-${b}`}>
                <Text style={styles.bucketChipLabel}>{WALLET_BUCKET_LABELS[b]}</Text>
                <Text style={styles.bucketChipValue}>{formatRupees(buckets?.[b])}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {expiring.length > 0 && (
        <View style={styles.expiringCard} testID="wallet-expiring">
          <View style={styles.expiringHead}>
            <MaterialIcons name="schedule" size={18} color="#B45309" />
            <Text style={styles.expiringTitle}>Use it before it goes</Text>
          </View>
          {expiring.map((lot, i) => (
            <View key={`${lot.expires_at}-${i}`} style={styles.expiringRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.expiringLabel} numberOfLines={1}>
                  {lot.label}
                </Text>
                {lot.min_order > 0 && (
                  <Text style={styles.expiringNote}>
                    On orders above {formatRupees(lot.min_order)}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.expiringAmount}>{formatRupees(lot.amount)}</Text>
                <Text style={styles.expiringDays}>
                  {lot.days_left === 1 ? 'Last day' : `${lot.days_left} days left`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.codeButton}
        onPress={() => openCodeSheet('promo')}
        testID="wallet-have-a-code"
      >
        <MaterialIcons name="local-offer" size={18} color={GREEN} />
        <Text style={styles.codeButtonText}>Have a code?</Text>
        <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
      </TouchableOpacity>

      {referral?.enabled && !!referral.code && (
        <View style={styles.referralCard} testID="wallet-referral">
          <Text style={styles.referralTitle}>Invite friends, both get credit</Text>
          <Text style={styles.referralText}>
            Your friend gets {formatRupees(referral.referee_amount)} and you get{' '}
            {formatRupees(referral.referrer_amount)} after their first delivered order
            {referral.min_order > 0 ? ` of ${formatRupees(referral.min_order)} or more` : ''}.
          </Text>
          <View style={styles.referralCodeRow}>
            <Text style={styles.referralCode} testID="wallet-referral-code">
              {referral.code}
            </Text>
            <TouchableOpacity
              style={styles.referralShare}
              onPress={shareReferral}
              testID="wallet-referral-share"
            >
              <MaterialIcons name="share" size={16} color="#FFFFFF" />
              <Text style={styles.referralShareText}>Share</Text>
            </TouchableOpacity>
          </View>
          {referral.rewarded > 0 && (
            <Text style={styles.referralStats}>
              {referral.rewarded} friend{referral.rewarded > 1 ? 's' : ''} joined -{' '}
              {formatRupees(referral.earned)} earned
            </Text>
          )}
        </View>
      )}

      {summary?.status === 'frozen' && (
        <View style={styles.frozenBanner} testID="wallet-frozen-banner">
          <MaterialIcons name="info-outline" size={18} color="#B45309" />
          <Text style={styles.frozenText}>
            Your wallet is on hold. Your balance is safe - please contact Tazty support to use it.
          </Text>
        </View>
      )}

      {!!notice && (
        <View style={styles.noticeBanner} testID="wallet-notice">
          <MaterialIcons name="check-circle" size={18} color={GREEN} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>History</Text>
    </View>
  );

  const amount = Number(amountText);
  const fee = topupFee(amount, limits);
  const bonus = topupBonus(amount, limits);
  // The cheapest tier the customer has not reached yet, to nudge them up.
  const nextBonus = (limits?.bonus_tiers ?? [])
    .filter(t => t.min_amount > amount)
    .sort((a, b) => a.min_amount - b.min_amount)[0];
  const amountProblem = (() => {
    if (!limits || !amountText) return null;
    if (!Number.isFinite(amount) || amount <= 0) return 'Enter an amount';
    if (!/^\d+(\.\d{1,2})?$/.test(amountText)) return 'Up to 2 decimals';
    if (amount < limits.min) return `The minimum is ${formatRupees(limits.min)}`;
    if (amount > limits.max_now) {
      return limits.max_now > 0
        ? `You can add up to ${formatRupees(limits.max_now)} right now`
        : "You've reached your limit for now";
    }
    return null;
  })();

  /** Razorpay for amount (+ fee), then confirm with the server (credits once). */
  const addMoney = async () => {
    if (!limits || !amountText || amountProblem || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      const created = await walletService.createTopup(amount);
      const d = created.payment_details;
      const result = await paymentService.openCheckout({
        key: d.key,
        amount: created.charged_amount,
        currency: d.currency || 'INR',
        name: d.name || 'Tazty',
        description: d.description || 'Add money to Tazty Wallet',
        order_id: d.razorpay_order_id,
        prefill: d.prefill,
        theme: { color: GREEN },
      });
      if (!result.success || !result.razorpay_payment_id) {
        setAddError(
          result.errorType === PaymentErrorType.USER_CANCELLED
            ? 'Payment cancelled. No money was taken.'
            : result.error || 'Payment failed. No money was added.',
        );
        return;
      }
      const verified = await walletService.verifyTopup(created.topup_id, {
        razorpay_order_id: result.razorpay_order_id || d.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature || '',
      });
      setAddOpen(false);
      setNotice(
        verified?.status === 'credited'
          ? `${formatRupees(created.amount)} added to your Tazty Wallet.`
          : `Payment received. ${formatRupees(created.amount)} will show in your wallet in a few minutes.`,
      );
      await load();
    } catch (e: any) {
      setAddError(e?.message || 'Could not add money. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const renderItem = ({ item }: { item: WalletTransaction }) => {
    const credit = item.direction === 'credit';
    // An order hold is not final: amber while held, grey once returned.
    const held = item.status === 'held';
    const returned = item.status === 'released';
    const iconColor = returned ? '#6B7280' : held ? '#B45309' : credit ? GREEN : '#DC2626';
    const iconName = returned ? 'undo' : held ? 'schedule' : credit ? 'south-west' : 'north-east';
    const subtitle =
      item.note || (item.order_number ? `Order #${item.order_number}` : WALLET_BUCKET_LABELS[item.bucket]);
    return (
      <TouchableOpacity
        style={styles.txnRow}
        onPress={() => setSelected(item)}
        activeOpacity={0.7}
        testID={`wallet-txn-${item.txn_ref}`}
      >
        <View
          style={[
            styles.txnIcon,
            returned ? styles.txnIconNeutral : held ? styles.txnIconHeld : credit ? styles.txnIconCredit : styles.txnIconDebit,
          ]}
        >
          <MaterialIcons name={iconName as any} size={18} color={iconColor} />
        </View>
        <View style={styles.txnBody}>
          <Text style={styles.txnTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.txnSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
          <Text style={styles.txnDate}>{formatDate(item.created_at)}</Text>
        </View>
        <Text
          style={[
            styles.txnAmount,
            returned ? styles.amountNeutral : held ? styles.amountHeld : credit ? styles.amountCredit : styles.amountDebit,
          ]}
        >
          {returned || held ? '' : credit ? '+' : '-'}
          {formatRupees(item.amount)}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderBody = () => {
    if (loading) {
      return (
        <View style={[styles.sheet, styles.centre]}>
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      );
    }
    if (failed || !summary?.enabled) {
      return (
        <View style={[styles.sheet, styles.centre]} testID="wallet-unavailable">
          <MaterialIcons name="account-balance-wallet" size={48} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>
            {failed ? "Couldn't load your wallet" : 'Tazty Wallet is coming soon'}
          </Text>
          {failed && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setLoading(true);
                load().finally(() => setLoading(false));
              }}
              testID="wallet-retry"
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    return (
      <FlatList
        data={transactions}
        keyExtractor={t => t.txn_ref}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyWrap} testID="wallet-empty">
            <Text style={styles.emptyText}>
              No wallet activity yet. Refunds and Tazty credits will show up here.
            </Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={styles.footerLoader} color={GREEN} /> : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        style={styles.sheet}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />
        }
        testID="wallet-history-list"
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="wallet-screen">
      <StatusBar barStyle="light-content" backgroundColor={GREEN} translucent={false} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="wallet-screen-back"
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tazty Wallet</Text>
      </View>

      {renderBody()}

      {/* Add money */}
      <Modal
        visible={addOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={() => !adding && setAddOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
        <Pressable style={styles.backdrop} onPress={() => !adding && setAddOpen(false)} testID="wallet-add-backdrop">
          <Pressable style={styles.detailSheet} onPress={() => {}}>
            <View style={styles.detailHandle} />
            <Text style={styles.detailTitle}>Add money to Tazty Wallet</Text>
            <View style={styles.amountBox}>
              <Text style={styles.amountRupee}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={amountText}
                onChangeText={t => {
                  setAmountText(t.replace(/[^\d.]/g, ''));
                  setAddError(null);
                }}
                keyboardType="decimal-pad"
                autoFocus
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                maxLength={8}
                testID="wallet-add-amount"
              />
            </View>
            <View style={styles.chipRow}>
              {(limits?.suggestions ?? []).map(a => (
                <TouchableOpacity
                  key={a}
                  style={[styles.amountChip, amount === a && styles.amountChipOn]}
                  onPress={() => {
                    setAmountText(String(a));
                    setAddError(null);
                  }}
                  testID={`wallet-add-chip-${a}`}
                >
                  <Text style={[styles.amountChipText, amount === a && styles.amountChipTextOn]}>
                    {formatRupees(a)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {!!limits && (
              <Text style={styles.limitText}>
                {formatRupees(limits.min)} – {formatRupees(limits.max_now)} · You can add up to{' '}
                {formatRupees(limits.daily_remaining)} more today
              </Text>
            )}
            {bonus > 0 && !amountProblem && (
              <View style={styles.bonusRow} testID="wallet-add-bonus">
                <MaterialIcons name="card-giftcard" size={16} color={GREEN} />
                <Text style={styles.bonusText}>
                  You'll also get {formatRupees(bonus)} bonus credit
                </Text>
              </View>
            )}
            {nextBonus && !amountProblem && (
              <Text style={styles.nextBonusText} testID="wallet-add-next-bonus">
                Add {formatRupees(nextBonus.min_amount)} to get{' '}
                {formatRupees(nextBonus.bonus_amount)} extra
              </Text>
            )}
            {fee > 0 && !amountProblem && amount > 0 && (
              <Text style={styles.feeText} testID="wallet-add-fee">
                Convenience fee {formatRupees(fee)} · You pay {formatRupees(amount + fee)}
              </Text>
            )}
            {!!(amountProblem || addError) && (
              <Text style={styles.addErrorText}>{amountProblem || addError}</Text>
            )}
            <TouchableOpacity
              style={[styles.detailClose, (!amountText || !!amountProblem || adding) && styles.buttonDisabled]}
              disabled={!amountText || !!amountProblem || adding}
              onPress={addMoney}
              testID="wallet-add-pay"
            >
              {adding ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.detailCloseText}>
                  {amount > 0 ? `Add ${formatRupees(amount)}` : 'Add money'}
                </Text>
              )}
            </TouchableOpacity>
            <Text style={styles.addFootnote}>
              Added money can be spent on Tazty orders only. It can't be withdrawn.
            </Text>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={codeOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={() => !codeBusy && setCodeOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
        <Pressable
          style={styles.backdrop}
          onPress={() => !codeBusy && setCodeOpen(false)}
          testID="wallet-code-backdrop"
        >
          <Pressable style={styles.detailSheet} onPress={() => {}}>
            <View style={styles.detailHandle} />
            <Text style={styles.detailTitle}>
              {codeMode === 'referral' ? "Enter a friend's code" : 'Enter your code'}
            </Text>
            {referral?.enabled && (
              <View style={styles.codeTabs}>
                <TouchableOpacity
                  style={[styles.codeTab, codeMode === 'promo' && styles.codeTabOn]}
                  onPress={() => {
                    setCodeMode('promo');
                    setCodeError(null);
                  }}
                  testID="wallet-code-tab-promo"
                >
                  <Text style={[styles.codeTabText, codeMode === 'promo' && styles.codeTabTextOn]}>
                    Promo code
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.codeTab, codeMode === 'referral' && styles.codeTabOn]}
                  onPress={() => {
                    setCodeMode('referral');
                    setCodeError(null);
                  }}
                  testID="wallet-code-tab-referral"
                >
                  <Text
                    style={[styles.codeTabText, codeMode === 'referral' && styles.codeTabTextOn]}
                  >
                    Referral code
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <TextInput
              style={styles.codeInput}
              value={codeText}
              onChangeText={t => {
                setCodeText(t.toUpperCase());
                setCodeError(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={codeMode === 'referral' ? 'TAZ-XXXX' : 'TAZTY50'}
              placeholderTextColor="#9CA3AF"
              maxLength={32}
              testID="wallet-code-input"
            />
            {!!codeError && <Text style={styles.addErrorText}>{codeError}</Text>}
            <TouchableOpacity
              style={[styles.detailClose, (!codeText.trim() || codeBusy) && styles.buttonDisabled]}
              disabled={!codeText.trim() || codeBusy}
              onPress={submitCode}
              testID="wallet-code-submit"
            >
              {codeBusy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.detailCloseText}>Apply</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.addFootnote}>
              {codeMode === 'referral'
                ? 'A referral code can be used before your first Tazty order.'
                : 'Promo credit is added to your wallet and expires - the wallet shows when.'}
            </Text>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)} testID="wallet-detail-backdrop">
          <Pressable style={styles.detailSheet} onPress={() => {}}>
            {selected && (
              <>
                <View style={styles.detailHandle} />
                <Text style={styles.detailTitle}>{selected.title}</Text>
                <Text
                  style={[
                    styles.detailAmount,
                    selected.direction === 'credit' ? styles.amountCredit : styles.amountDebit,
                  ]}
                >
                  {selected.direction === 'credit' ? '+' : '-'}
                  {formatRupees(selected.amount)}
                </Text>
                {!!selected.note && <Text style={styles.detailNote}>{selected.note}</Text>}
                <DetailLine label="Date" value={formatDate(selected.created_at)} />
                <DetailLine label="Balance type" value={WALLET_BUCKET_LABELS[selected.bucket]} />
                {!!selected.order_number && (
                  <DetailLine label="Order" value={`#${selected.order_number}`} />
                )}
                {selected.balance_after !== null && (
                  <DetailLine label="Balance after" value={formatRupees(selected.balance_after)} />
                )}
                <DetailLine label="Reference" value={selected.txn_ref} />
                <TouchableOpacity
                  style={styles.detailClose}
                  onPress={() => setSelected(null)}
                  testID="wallet-detail-close"
                >
                  <Text style={styles.detailCloseText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const DetailLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.detailLine}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue} selectable>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  // Green safe area so the status bar strip matches the header.
  container: { flex: 1, backgroundColor: GREEN },
  header: {
    backgroundColor: GREEN,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backButton: { padding: 6 },
  headerTitle: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 18,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
  sheet: { flex: 1, backgroundColor: '#F5F5F5' },
  centre: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  listContent: { padding: 16, paddingBottom: 32 },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5F6EC',
  },
  balanceTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceLabel: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#4B5563',
  },
  balanceAmount: {
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 32,
    letterSpacing: 0,
    color: '#111827',
    marginTop: 6,
  },
  onHoldHint: {
    marginTop: 8,
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#B45309',
  },
  txnIconHeld: { backgroundColor: '#FEF3C7' },
  txnIconNeutral: { backgroundColor: '#F3F4F6' },
  amountHeld: { color: '#B45309' },
  amountNeutral: { color: '#6B7280', textDecorationLine: 'line-through' },
  balanceHint: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 11,
    letterSpacing: 0.1,
    color: '#6B7280',
    marginTop: 4,
  },
  bucketRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  bucketChip: {
    backgroundColor: '#F0FBF5',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  bucketChipLabel: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 10,
    letterSpacing: 0.2,
    color: '#4B5563',
  },
  bucketChipValue: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 0,
    color: '#111827',
  },
  addMoneyButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: GREEN,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addMoneyText: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
  noticeBanner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#ECFDF3',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  noticeText: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#065F46',
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: GREEN,
    marginTop: 16,
    paddingBottom: 4,
  },
  amountRupee: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 28,
    letterSpacing: 0,
    color: '#111827',
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 28,
    letterSpacing: 0,
    color: '#111827',
    padding: 0,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  amountChip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  amountChipOn: { borderColor: GREEN, backgroundColor: '#ECFDF3' },
  amountChipText: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#374151',
  },
  amountChipTextOn: { color: GREEN },
  limitText: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 11,
    letterSpacing: 0.1,
    color: '#6B7280',
    marginTop: 12,
  },
  feeText: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#92400E',
    marginTop: 8,
  },
  addErrorText: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#DC2626',
    marginTop: 8,
  },
  expiringCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },
  expiringHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  expiringTitle: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#92400E',
  },
  expiringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  expiringLabel: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#111827',
  },
  expiringNote: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 11,
    letterSpacing: 0.1,
    color: '#6B7280',
  },
  expiringAmount: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: 0.1,
    color: '#111827',
  },
  expiringDays: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 11,
    letterSpacing: 0.1,
    color: '#B45309',
  },
  codeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  codeButtonText: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: 0.1,
    color: '#111827',
  },
  referralCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
  },
  referralTitle: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: 0.1,
    color: '#111827',
  },
  referralText: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#6B7280',
    marginTop: 4,
  },
  referralCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  referralCode: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 18,
    letterSpacing: 2,
    color: GREEN,
    backgroundColor: '#ECFDF3',
    borderRadius: 10,
    paddingVertical: 10,
    textAlign: 'center',
  },
  referralShare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  referralShareText: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#FFFFFF',
  },
  referralStats: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 12,
    letterSpacing: 0.1,
    color: GREEN,
    marginTop: 10,
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  bonusText: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: 0.1,
    color: GREEN,
  },
  nextBonusText: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 11,
    letterSpacing: 0.1,
    color: '#6B7280',
    marginTop: 6,
  },
  codeTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  codeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  codeTabOn: {
    backgroundColor: '#ECFDF3',
  },
  codeTabText: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#6B7280',
  },
  codeTabTextOn: {
    fontWeight: 600,
    color: GREEN,
  },
  codeInput: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 18,
    letterSpacing: 2,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  addFootnote: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 10,
    letterSpacing: 0.1,
    color: '#9CA3AF',
    marginTop: 10,
    textAlign: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  frozenBanner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  frozenText: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#92400E',
  },
  sectionTitle: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 15,
    letterSpacing: 0,
    color: '#111827',
    marginTop: 20,
    marginBottom: 8,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  txnIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnIconCredit: { backgroundColor: '#E8F8EF' },
  txnIconDebit: { backgroundColor: '#FDECEC' },
  txnBody: { flex: 1 },
  txnTitle: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 13,
    letterSpacing: 0,
    color: '#111827',
  },
  txnSubtitle: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 11,
    letterSpacing: 0.1,
    color: '#6B7280',
  },
  txnDate: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 10,
    letterSpacing: 0.1,
    color: '#9CA3AF',
    marginTop: 2,
  },
  txnAmount: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: 0,
  },
  amountCredit: { color: GREEN },
  amountDebit: { color: '#DC2626' },
  emptyWrap: { paddingVertical: 32, alignItems: 'center' },
  emptyText: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyTitle: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 14,
    letterSpacing: 0.1,
    color: '#4B5563',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: GREEN,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
  footerLoader: { marginVertical: 12 },
  kav: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  detailSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  detailHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  detailTitle: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 16,
    letterSpacing: 0,
    color: '#111827',
  },
  detailAmount: {
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 26,
    letterSpacing: 0,
    marginTop: 4,
  },
  detailNote: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#4B5563',
    marginTop: 6,
  },
  detailLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  detailLabel: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#6B7280',
  },
  detailValue: {
    flexShrink: 1,
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#111827',
    textAlign: 'right',
  },
  detailClose: {
    marginTop: 20,
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  detailCloseText: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
});
