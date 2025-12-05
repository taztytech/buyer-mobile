declare module '@react-native-community/netinfo' {
  export interface NetInfoState {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
  }

  export type NetInfoSubscription = () => void;

  export function addEventListener(
    listener: (state: NetInfoState) => void
  ): NetInfoSubscription;

  const NetInfo: {
    addEventListener: typeof addEventListener;
  };

  export default NetInfo;
}


