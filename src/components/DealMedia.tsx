import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

interface DealMediaProps {
  imageUrl: string | null;
  videoUrl: string | null;
  /** First letter is shown when there is no image at all. */
  name: string;
  photoSeconds: number;
  muted: boolean;
  loop: boolean;
  /** What shows when there is no image: the letter tile (cards) or nothing (banners). */
  fallback?: 'letter' | 'none';
}

/**
 * A photo and, when there is a promo video, a clip that plays inside the same
 * box: hold the photo `photoSeconds`, play the video once, then loop (unless
 * `loop` is off). The image always renders underneath, so the box looks right
 * before the clip loads and if it fails. Muted by default: several of these
 * can be on screen at once and must not all play audio.
 *
 * Fills its parent - wrap it in a sized (usually absoluteFill) View.
 */
export const DealMedia: React.FC<DealMediaProps> = ({
  imageUrl,
  videoUrl,
  name,
  photoSeconds,
  muted,
  loop,
  fallback = 'letter',
}) => {
  const [phase, setPhase] = useState<'photo' | 'video'>('photo');
  const [videoFailed, setVideoFailed] = useState(false);
  const [stopped, setStopped] = useState(false);
  const videoRef = useRef<Video>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasVideo = !!videoUrl && !videoFailed;

  // Restart the cycle whenever the media changes.
  useEffect(() => {
    setPhase('photo');
    setVideoFailed(false);
    setStopped(false);
  }, [videoUrl, imageUrl]);

  // Drive photo → video. The video → photo hand-back happens in onStatus.
  useEffect(() => {
    if (!hasVideo || stopped || phase !== 'photo') return;
    const holdMs = Math.max(0, photoSeconds ?? 2) * 1000;
    timerRef.current = setTimeout(() => setPhase('video'), holdMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, hasVideo, stopped, photoSeconds]);

  // Always start the clip from the top when it becomes visible.
  useEffect(() => {
    if (phase === 'video') {
      videoRef.current?.setPositionAsync(0).catch(() => {});
    }
  }, [phase]);

  const onStatus = (status: AVPlaybackStatus) => {
    if (!('isLoaded' in status) || !status.isLoaded) return;
    if (status.didJustFinish) {
      setPhase('photo');
      if (!loop) setStopped(true);
    }
  };

  let base: React.ReactNode = null;
  if (imageUrl) {
    base = <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />;
  } else if (fallback === 'letter') {
    base = (
      <View style={[styles.image, styles.imageFallback]}>
        <Text style={styles.imageFallbackText}>
          {(name || '?').trim().charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <>
      {base}
      {hasVideo ? (
        <Video
          ref={videoRef}
          source={{ uri: videoUrl as string }}
          style={[StyleSheet.absoluteFill, { opacity: phase === 'video' ? 1 : 0 }]}
          resizeMode={ResizeMode.COVER}
          isMuted={muted}
          isLooping={false}
          shouldPlay={phase === 'video' && !stopped}
          onPlaybackStatusUpdate={onStatus}
          onError={() => setVideoFailed(true)}
        />
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F3F3' },
  imageFallbackText: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 40,
    letterSpacing: 0,
    color: '#B9B4B0',
  },
});
