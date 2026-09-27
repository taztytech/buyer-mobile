import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  vcService,
  VcStore,
  VcStoreItem,
} from '@/services/vc.service';

const GREEN = '#00B14F';

interface VideoUploadScreenProps {
  onBack: () => void;
  onUploaded: () => void;
}

type PickerMode = 'store' | 'item' | null;

/**
 * Post a Video Commerce clip: pick a video (≤1 min), write a caption, tag a
 * store (required) and optionally one of its items, then upload. The file goes
 * straight to S3 via a presigned URL; the video then waits for admin review.
 *
 * Store and item are chosen from dropdown pickers. The STORE search hits the
 * server as you type (the backend only returns a capped page, so filtering a
 * pre-loaded list client-side would miss stores past the first page). Items are
 * loaded per store (up to 200) and filtered locally.
 */
export const VideoUploadScreen: React.FC<VideoUploadScreenProps> = ({
  onBack,
  onUploaded,
}) => {
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [durationSecs, setDurationSecs] = useState<number | undefined>();
  const [caption, setCaption] = useState('');

  const [store, setStore] = useState<VcStore | null>(null);
  const [items, setItems] = useState<VcStoreItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [item, setItem] = useState<VcStoreItem | null>(null);

  // Which dropdown is open, the in-picker search text, and the store results the
  // server returned for that text.
  const [picker, setPicker] = useState<PickerMode>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [storeResults, setStoreResults] = useState<VcStore[]>([]);
  const [storeSearching, setStoreSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const pickVideo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
      videoMaxDuration: 70,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const secs = asset.duration ? Math.round(asset.duration / 1000) : undefined;
    if (secs && secs > 75) {
      setError('Please choose a video of 1 minute or less');
      return;
    }
    setError('');
    setVideoUri(asset.uri);
    setDurationSecs(secs);
  };

  // Store search runs on the server (debounced) so any store matches, not just
  // the first page. Fires on open (empty query → first page) and on each keystroke.
  useEffect(() => {
    if (picker !== 'store') return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setStoreSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        setStoreResults(await vcService.searchStores(pickerQuery.trim()));
      } catch {
        setStoreResults([]);
      } finally {
        setStoreSearching(false);
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [picker, pickerQuery]);

  const openStorePicker = () => {
    setPickerQuery('');
    setStoreResults([]);
    setPicker('store');
  };

  const openItemPicker = () => {
    if (!store) return;
    setPickerQuery('');
    setPicker('item');
  };

  const chooseStore = async (s: VcStore) => {
    setStore(s);
    setItem(null);
    setItems([]);
    setPicker(null);
    setItemsLoading(true);
    try {
      setItems(await vcService.storeItems(s.id));
    } catch {
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  };

  const chooseItem = (it: VcStoreItem | null) => {
    setItem(it);
    setPicker(null);
  };

  // Rows shown inside the open dropdown. Stores come from the server already
  // filtered; items are filtered locally against the in-picker search text.
  const pickerRows = useMemo(() => {
    if (picker === 'store') return storeResults;
    if (picker === 'item') {
      const q = pickerQuery.trim().toLowerCase();
      return q ? items.filter((it) => it.name.toLowerCase().includes(q)) : items;
    }
    return [];
  }, [picker, pickerQuery, storeResults, items]);

  const submit = async () => {
    setError('');
    if (!videoUri) {
      setError('Pick a video first');
      return;
    }
    if (!store) {
      setError('Tag a store');
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const contentType = videoUri.toLowerCase().endsWith('.mov')
        ? 'video/quicktime'
        : 'video/mp4';
      await vcService.uploadAndRegisterVideo(
        videoUri,
        {
          caption: caption.trim() || undefined,
          store_id: store.id,
          store_name: store.name,
          item_id: item?.id,
          item_name: item?.name,
          duration_secs: durationSecs,
        },
        contentType,
        setProgress,
      );
      onUploaded();
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          e?.message ||
          'Upload failed. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={GREEN} />
      </SafeAreaView>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} testID="upload-back">
          <MaterialIcons name="chevron-left" size={26} color="#001E1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post a video</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.videoPick}
          onPress={pickVideo}
          activeOpacity={0.85}
          testID="upload-pick-video"
        >
          {videoUri ? (
            <>
              <MaterialIcons name="check-circle" size={30} color={GREEN} />
              <Text style={styles.videoPickText}>
                Video selected{durationSecs ? ` · ${durationSecs}s` : ''}
              </Text>
              <Text style={styles.videoPickSub}>Tap to change</Text>
            </>
          ) : (
            <>
              <MaterialIcons name="video-call" size={34} color={GREEN} />
              <Text style={styles.videoPickText}>
                Pick a video (up to 1 min)
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Caption</Text>
        <TextInput
          style={styles.input}
          placeholder="Best chicken biryani in Madurai 🔥"
          placeholderTextColor="#9CA3AF"
          value={caption}
          onChangeText={setCaption}
          multiline
          testID="upload-caption"
        />

        <Text style={styles.label}>Tag a store (required)</Text>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={openStorePicker}
          activeOpacity={0.8}
          testID="upload-store-dropdown"
        >
          {store ? (
            <>
              <MaterialIcons name="storefront" size={18} color={GREEN} />
              <Text style={styles.dropdownText} numberOfLines={1}>
                {store.name}
              </Text>
            </>
          ) : (
            <Text style={styles.dropdownPlaceholder}>Select a store</Text>
          )}
          <MaterialIcons name="arrow-drop-down" size={24} color="#6B7280" />
        </TouchableOpacity>

        {store && (
          <>
            <Text style={styles.label}>Tag an item (optional)</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={openItemPicker}
              activeOpacity={0.8}
              testID="upload-item-dropdown"
            >
              {item ? (
                <>
                  <MaterialIcons name="restaurant-menu" size={18} color={GREEN} />
                  <Text style={styles.dropdownText} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setItem(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    testID="upload-clear-item"
                  >
                    <MaterialIcons name="close" size={18} color="#6B7280" />
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.dropdownPlaceholder}>
                  {itemsLoading
                    ? 'Loading items…'
                    : items.length === 0
                      ? 'No items to tag'
                      : 'Select an item'}
                </Text>
              )}
              {!item && (
                <MaterialIcons name="arrow-drop-down" size={24} color="#6B7280" />
              )}
            </TouchableOpacity>
          </>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.submit, busy && styles.submitBusy]}
          onPress={submit}
          disabled={busy}
          activeOpacity={0.85}
          testID="upload-submit"
        >
          {busy ? (
            <View style={styles.uploadingWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.submitText}>
                {progress >= 97 ? 'Finishing…' : `Uploading… ${progress}%`}
              </Text>
            </View>
          ) : (
            <Text style={styles.submitText}>Upload</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Dropdown picker — a bottom sheet listing stores or items.
          animationType="fade" + statusBarTranslucent + hardwareAccelerated
          avoids the slide-in window flash (the flicker seen on the wallet's
          slide modals). KeyboardAvoidingView keeps the search box + list above
          the keyboard so typing a store name stays visible. */}
      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={() => setPicker(null)}
      >
        <KeyboardAvoidingView
          style={styles.sheetBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.backdropFill} onPress={() => setPicker(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {picker === 'store' ? 'Select a store' : 'Select an item'}
            </Text>
            <View style={styles.sheetSearch}>
              <MaterialIcons name="search" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.sheetSearchInput}
                placeholder={
                  picker === 'store' ? 'Search stores' : 'Search items'
                }
                placeholderTextColor="#9CA3AF"
                value={pickerQuery}
                onChangeText={setPickerQuery}
                autoCorrect={false}
                autoFocus
                testID="picker-search"
              />
              {picker === 'store' && storeSearching && (
                <ActivityIndicator size="small" color={GREEN} />
              )}
            </View>
            <FlatList
              data={pickerRows}
              keyExtractor={(row) => String(row.id)}
              keyboardShouldPersistTaps="handled"
              style={styles.sheetList}
              ListEmptyComponent={
                <Text style={styles.sheetEmpty}>
                  {picker === 'store'
                    ? storeSearching
                      ? 'Searching…'
                      : 'No stores found'
                    : 'No items found'}
                </Text>
              }
              renderItem={({ item: row }) => (
                <TouchableOpacity
                  style={styles.sheetRow}
                  onPress={() =>
                    picker === 'store'
                      ? chooseStore(row as VcStore)
                      : chooseItem(row as VcStoreItem)
                  }
                  testID={`picker-row-${row.id}`}
                >
                  {picker === 'store' && (row as VcStore).logo_url ? (
                    <Image
                      source={{ uri: (row as VcStore).logo_url as string }}
                      style={styles.sheetLogo}
                    />
                  ) : (
                    <View style={[styles.sheetLogo, styles.sheetLogoPlaceholder]}>
                      <MaterialIcons
                        name={picker === 'store' ? 'storefront' : 'restaurant-menu'}
                        size={16}
                        color={GREEN}
                      />
                    </View>
                  )}
                  <Text style={styles.sheetRowText}>{row.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  safeTop: { backgroundColor: GREEN },
  header: {
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 6,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 18,
    letterSpacing: 0.2,
    marginLeft: 12,
  },
  body: { padding: 20 },
  videoPick: {
    borderWidth: 1.5,
    borderColor: GREEN,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 30,
    alignItems: 'center',
    gap: 6,
  },
  videoPickText: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 15,
    letterSpacing: 0.2,
    color: '#111827',
  },
  videoPickSub: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#6B7280',
  },
  label: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#374151',
    marginTop: 18,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 15,
    letterSpacing: 0.2,
    color: '#111827',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dropdownText: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 15,
    letterSpacing: 0.2,
    color: '#111827',
  },
  dropdownPlaceholder: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 15,
    letterSpacing: 0.2,
    color: '#9CA3AF',
  },
  error: {
    color: '#DC2626',
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 13,
    letterSpacing: 0.1,
    marginTop: 16,
  },
  submit: {
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  submitDisabled: { opacity: 0.6 },
  submitBusy: { opacity: 0.95 },
  submitText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: 0.3,
  },
  uploadingWrap: { alignSelf: 'stretch', alignItems: 'center', gap: 8 },
  progressTrack: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  // Bottom-sheet picker
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  backdropFill: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: '75%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
  },
  sheetTitle: {
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: 0.2,
    color: '#111827',
    marginBottom: 12,
  },
  sheetSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  sheetSearchInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 14,
    letterSpacing: 0.2,
    color: '#111827',
    paddingVertical: 2,
  },
  sheetList: { flexGrow: 0 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sheetLogo: { width: 34, height: 34, borderRadius: 8 },
  sheetLogoPlaceholder: {
    backgroundColor: '#E5F5EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRowText: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 15,
    letterSpacing: 0.2,
    color: '#111827',
  },
  sheetEmpty: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 14,
    letterSpacing: 0.1,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
