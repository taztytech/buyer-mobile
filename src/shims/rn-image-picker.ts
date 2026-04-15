import {
  launchCamera,
  launchImageLibrary,
  Asset,
  CameraOptions,
  ImageLibraryOptions,
} from 'react-native-image-picker';
import { PermissionsAndroid, Platform } from 'react-native';

type PermissionResult = { status: 'granted' | 'denied' };
type PickerResult = { canceled: boolean; assets: Asset[] };

export const MediaTypeOptions = {
  Images: 'photo',
  Videos: 'video',
  All: 'mixed',
} as const;

const toPermission = (ok: boolean): PermissionResult => ({ status: ok ? 'granted' : 'denied' });

const toPickerResult = (response: { didCancel?: boolean; assets?: Asset[] }): PickerResult => ({
  canceled: !!response.didCancel,
  assets: response.assets || [],
});

export const requestMediaLibraryPermissionsAsync = async (): Promise<PermissionResult> => {
  if (Platform.OS === 'ios') return { status: 'granted' };
  const mediaPermission =
    (PermissionsAndroid.PERMISSIONS as any).READ_MEDIA_IMAGES ||
    PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
  const status = await PermissionsAndroid.request(mediaPermission);
  return toPermission(status === PermissionsAndroid.RESULTS.GRANTED);
};

export const requestCameraPermissionsAsync = async (): Promise<PermissionResult> => {
  if (Platform.OS === 'ios') return { status: 'granted' };
  const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  return toPermission(status === PermissionsAndroid.RESULTS.GRANTED);
};

const mediaTypeFromExpo = (mediaType?: string): 'photo' | 'video' | 'mixed' => {
  if (mediaType === MediaTypeOptions.Videos) return 'video';
  if (mediaType === MediaTypeOptions.All) return 'mixed';
  return 'photo';
};

export const launchImageLibraryAsync = async (options: any = {}): Promise<PickerResult> => {
  const requestOptions: ImageLibraryOptions = {
    mediaType: mediaTypeFromExpo(options.mediaTypes),
    quality: typeof options.quality === 'number' ? options.quality : 1,
    selectionLimit: options.allowsMultipleSelection ? 0 : 1,
    videoQuality: 'high',
    includeExtra: true,
  };
  const response = await launchImageLibrary(requestOptions);
  return toPickerResult(response);
};

export const launchCameraAsync = async (options: any = {}): Promise<PickerResult> => {
  const requestOptions: CameraOptions = {
    mediaType: mediaTypeFromExpo(options.mediaTypes),
    quality: typeof options.quality === 'number' ? options.quality : 1,
    videoQuality: 'high',
    durationLimit: typeof options.videoMaxDuration === 'number' ? options.videoMaxDuration : undefined,
    includeExtra: true,
  };
  const response = await launchCamera(requestOptions);
  return toPickerResult(response);
};
