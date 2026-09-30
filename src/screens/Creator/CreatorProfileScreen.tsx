import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { vcService, VcCreator, VcVideo } from '@/services/vc.service';

const GREEN = '#00B14F';

interface CreatorProfileScreenProps {
  onBack: () => void;
  onCreateVideo: () => void;
  /** No longer used — account items live on the normal profile now. Kept
   *  optional so existing callers don't break. */
  onSettings?: () => void;
}

/**
 * A creator's own profile, Instagram-style: avatar, handle, a total-videos
 * count and a grid of their posts. In v1 the grid is empty until video upload
 * (a later phase) lands; everything account-related lives behind the settings
 * icon, not on this screen.
 */
export const CreatorProfileScreen: React.FC<CreatorProfileScreenProps> = ({
  onBack,
  onCreateVideo,
}) => {
  const [creator, setCreator] = useState<VcCreator | null>(null);
  const [videos, setVideos] = useState<VcVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const load = async () => {
    const [me, myVideos] = await Promise.all([
      vcService.me(),
      vcService.myVideos().catch(() => []),
    ]);
    setCreator(me);
    setVideos(myVideos);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setUploadingAvatar(true);
    try {
      const url = await vcService.uploadAvatar(result.assets[0].uri);
      setCreator((c) => (c ? { ...c, avatar_url: url } : c));
    } catch {
      // Leave the old avatar; a failed upload is not worth blocking the screen.
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={GREEN} />
      </View>
    );
  }

  const handle = creator?.handle || 'creator';
  const paused = creator?.state === 'paused';

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={GREEN} />
      </SafeAreaView>

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn} testID="creator-back">
          <MaterialIcons name="arrow-back" size={26} color="#001E1F" />
        </TouchableOpacity>
        <Text style={styles.headerHandle} numberOfLines={1}>
          @{handle}
        </Text>
        {/* Spacer keeps the handle centred now that the settings icon is gone —
            account items (My Orders, wallet, etc.) live on the normal profile. */}
        <View style={styles.headerSpacer} />
      </View>

      {paused && (
        <View style={styles.pausedBanner}>
          <Text style={styles.pausedText}>
            Your creator id is paused. Please contact admin to resume it.
          </Text>
        </View>
      )}

      <View style={styles.top}>
        <TouchableOpacity
          onPress={pickAvatar}
          activeOpacity={0.8}
          style={styles.avatarWrap}
          testID="creator-avatar"
        >
          {creator?.avatar_url ? (
            <Image source={{ uri: creator.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {handle.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.cameraBadge}>
            {uploadingAvatar ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <MaterialIcons name="photo-camera" size={14} color="#FFFFFF" />
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.stat}>
          <Text style={styles.statNum}>{videos.length}</Text>
          <Text style={styles.statLabel}>videos</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>
            {videos.reduce((sum, v) => sum + (v.order_count || 0), 0)}
          </Text>
          <Text style={styles.statLabel}>orders</Text>
        </View>
      </View>

      <Text style={styles.displayName}>{creator?.display_name || ''}</Text>
      {!!creator?.bio && <Text style={styles.bio}>{creator.bio}</Text>}

      <TouchableOpacity
        style={[styles.createBtn, paused && styles.createBtnDisabled]}
        onPress={onCreateVideo}
        disabled={paused}
        activeOpacity={0.85}
        testID="creator-create-video"
      >
        <MaterialIcons name="add" size={20} color="#FFFFFF" />
        <Text style={styles.createBtnText}>Post a video</Text>
      </TouchableOpacity>

      {videos.length === 0 ? (
        <View style={styles.gridEmpty}>
          <MaterialIcons name="videocam" size={40} color="#D1D5DB" />
          <Text style={styles.gridEmptyText}>No videos yet</Text>
          <Text style={styles.gridEmptySub}>
            Your posted videos will appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {videos.map((v) => (
            <View key={v.id} style={styles.gridCell}>
              {v.thumbnail_url ? (
                <Image source={{ uri: v.thumbnail_url }} style={styles.gridThumb} />
              ) : (
                <View style={[styles.gridThumb, styles.gridThumbPh]}>
                  <MaterialIcons name="videocam" size={22} color="#9CA3AF" />
                </View>
              )}
              <View style={styles.gridBadge}>
                <MaterialIcons name="shopping-bag" size={11} color="#FFFFFF" />
                <Text style={styles.gridBadgeText}>{v.order_count || 0}</Text>
              </View>
              {v.status !== 'published' && (
                <View style={styles.gridStatus}>
                  <Text style={styles.gridStatusText}>
                    {v.status === 'pending_review' ? 'In review' : v.status}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { alignItems: 'center', justifyContent: 'center' },
  safeTop: { backgroundColor: GREEN },
  header: {
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 6,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 36, height: 36 },
  headerHandle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 17,
    letterSpacing: 0.2,
    marginHorizontal: 8,
  },
  pausedBanner: { backgroundColor: '#FEF2F2', padding: 12 },
  pausedText: {
    color: '#991B1B',
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 13,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 28,
  },
  avatarWrap: { width: 84, height: 84 },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  avatarPlaceholder: {
    backgroundColor: '#E5F5EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: GREEN,
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 34,
    letterSpacing: 0.2,
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  stat: { alignItems: 'center' },
  statNum: {
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 20,
    letterSpacing: 0.2,
    color: '#111827',
  },
  statLabel: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#6B7280',
  },
  displayName: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 15,
    letterSpacing: 0.1,
    color: '#111827',
    paddingHorizontal: 20,
  },
  bio: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#6B7280',
    paddingHorizontal: 20,
    marginTop: 4,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: GREEN,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 13,
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: 0.3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    paddingHorizontal: 1,
  },
  gridCell: {
    width: '33.33%',
    aspectRatio: 0.72,
    padding: 1,
  },
  gridThumb: { flex: 1, borderRadius: 4, backgroundColor: '#000' },
  gridThumbPh: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  gridBadgeText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: 0.1,
  },
  gridStatus: {
    position: 'absolute',
    right: 6,
    top: 6,
    backgroundColor: 'rgba(245,158,11,0.92)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  gridStatusText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 9,
    letterSpacing: 0.1,
  },
  gridEmpty: { alignItems: 'center', marginTop: 48, paddingHorizontal: 20 },
  gridEmptyText: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 15,
    letterSpacing: 0.1,
    color: '#374151',
    marginTop: 10,
  },
  gridEmptySub: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#9CA3AF',
    marginTop: 2,
    textAlign: 'center',
  },
});
