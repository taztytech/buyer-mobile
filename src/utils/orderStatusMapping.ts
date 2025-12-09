/**
 * Order Status Mapping Utilities
 * Maps backend order statuses to UI display text, colors, and icons
 */

export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  iconName: string;
}

/**
 * Maps backend status to UI status configuration
 * @param status - Backend status string
 * @returns StatusConfig with label, color, bgColor, and iconName
 */
export function mapOrderStatusToUI(status: string | null | undefined): StatusConfig {
  if (!status) {
    return getStatusConfig('confirmed');
  }

  const normalizedStatus = status.toLowerCase().trim();

  // Handle status variations
  switch (normalizedStatus) {
    case 'confirmed':
      return getStatusConfig('confirmed');

    case 'billed':
      return getStatusConfig('billed');

    case 'packed':
      return getStatusConfig('packed');

    case 'agent-assigned':
    case 'agent_assigned':
      return getStatusConfig('agent-assigned');

    case 'picked':
      return getStatusConfig('picked');

    case 'out-for-delivery':
    case 'out_for_delivery':
    case 'on-the-way':
    case 'on_the_way':
      return getStatusConfig('out-for-delivery');

    case 'delivered':
    case 'completed':
      return getStatusConfig('delivered');

    case 'cancelled':
    case 'canceled':
    case 'rejected':
      return getStatusConfig('cancelled');

    case 'payment_failed':
    case 'payment-failed':
      return getStatusConfig('payment_failed');

    default:
      // Default to confirmed for unknown statuses
      return getStatusConfig('confirmed');
  }
}

/**
 * Get status configuration object
 */
function getStatusConfig(status: string): StatusConfig {
  const configs: { [key: string]: StatusConfig } = {
    confirmed: {
      label: 'Order Placed',
      color: '#00B14F',
      bgColor: 'rgba(0, 177, 79, 0.1)',
      iconName: 'check-circle',
    },
    billed: {
      label: 'Order Accepted',
      color: '#00B14F',
      bgColor: 'rgba(0, 177, 79, 0.1)',
      iconName: 'check-circle',
    },
    packed: {
      label: 'Order Ready',
      color: '#F59E0B',
      bgColor: 'rgba(245, 158, 11, 0.1)',
      iconName: 'restaurant',
    },
    'agent-assigned': {
      label: 'Agent Assigned',
      color: '#3B82F6',
      bgColor: 'rgba(59, 130, 246, 0.1)',
      iconName: 'person',
    },
    picked: {
      label: 'Picked up',
      color: '#3B82F6',
      bgColor: 'rgba(59, 130, 246, 0.1)',
      iconName: 'local-shipping',
    },
    'out-for-delivery': {
      label: 'On the way',
      color: '#F59E0B',
      bgColor: 'rgba(245, 158, 11, 0.1)',
      iconName: 'local-shipping',
    },
    delivered: {
      label: 'Delivered',
      color: '#00B14F',
      bgColor: 'rgba(0, 177, 79, 0.1)',
      iconName: 'check-circle',
    },
    cancelled: {
      label: 'Cancelled',
      color: '#DC2626',
      bgColor: 'rgba(220, 38, 38, 0.1)',
      iconName: 'cancel',
    },
    payment_failed: {
      label: 'Payment Failed',
      color: '#DC2626',
      bgColor: 'rgba(220, 38, 38, 0.1)',
      iconName: 'payment',
    },
  };

  return configs[status] || configs.confirmed;
}

/**
 * Check if status represents an ongoing order (not delivered/cancelled)
 */
export function isOngoingStatus(status: string | null | undefined): boolean {
  if (!status) return true;

  const normalizedStatus = status.toLowerCase().trim();
  const completedStatuses = ['delivered', 'completed', 'cancelled', 'canceled', 'rejected', 'payment_failed', 'payment-failed'];

  return !completedStatuses.includes(normalizedStatus);
}

