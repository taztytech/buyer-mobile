import { AlfaSlabOne_400Regular } from '@expo-google-fonts/alfa-slab-one';
import { AnekTamil_400Regular, AnekTamil_700Bold } from '@expo-google-fonts/anek-tamil';
import { Arima_400Regular, Arima_700Bold } from '@expo-google-fonts/arima';
import { BalooThambi2_400Regular, BalooThambi2_700Bold } from '@expo-google-fonts/baloo-thambi-2';
import { BowlbyOneSC_400Regular } from '@expo-google-fonts/bowlby-one-sc';
import { Bungee_400Regular } from '@expo-google-fonts/bungee';
import { Catamaran_400Regular, Catamaran_700Bold } from '@expo-google-fonts/catamaran';
import { Chewy_400Regular } from '@expo-google-fonts/chewy';
import { Coiny_400Regular } from '@expo-google-fonts/coiny';
import { Fredoka_400Regular, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { HindMadurai_400Regular, HindMadurai_700Bold } from '@expo-google-fonts/hind-madurai';
import { Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { Kavivanar_400Regular } from '@expo-google-fonts/kavivanar';
import { Lobster_400Regular } from '@expo-google-fonts/lobster';
import { Montserrat_400Regular, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { MuktaMalar_400Regular, MuktaMalar_700Bold } from '@expo-google-fonts/mukta-malar';
import { NotoSansTamil_400Regular, NotoSansTamil_700Bold } from '@expo-google-fonts/noto-sans-tamil';
import { Oi_400Regular } from '@expo-google-fonts/oi';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { PassionOne_400Regular, PassionOne_700Bold } from '@expo-google-fonts/passion-one';
import { PlayfairDisplay_400Regular, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Righteous_400Regular } from '@expo-google-fonts/righteous';
import { RubikBubbles_400Regular } from '@expo-google-fonts/rubik-bubbles';
import { TitanOne_400Regular } from '@expo-google-fonts/titan-one';
import { Ultra_400Regular } from '@expo-google-fonts/ultra';

/**
 * Fonts an organizational banner may ask for, on top of the app's own Poppins.
 *
 * Spread into useFonts in App.tsx. Each key becomes the family name React
 * Native knows the face by, which is why the map below stores those keys as
 * strings rather than the modules.
 */
export const BANNER_FONT_MODULES = {
  AlfaSlabOne_400Regular,
  AnekTamil_400Regular,
  AnekTamil_700Bold,
  Arima_400Regular,
  Arima_700Bold,
  BalooThambi2_400Regular,
  BalooThambi2_700Bold,
  BowlbyOneSC_400Regular,
  Bungee_400Regular,
  Catamaran_400Regular,
  Catamaran_700Bold,
  Chewy_400Regular,
  Coiny_400Regular,
  Fredoka_400Regular,
  Fredoka_700Bold,
  HindMadurai_400Regular,
  HindMadurai_700Bold,
  Inter_400Regular,
  Inter_700Bold,
  Kavivanar_400Regular,
  Lobster_400Regular,
  Montserrat_400Regular,
  Montserrat_700Bold,
  MuktaMalar_400Regular,
  MuktaMalar_700Bold,
  NotoSansTamil_400Regular,
  NotoSansTamil_700Bold,
  Oi_400Regular,
  Pacifico_400Regular,
  PassionOne_400Regular,
  PassionOne_700Bold,
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
  Righteous_400Regular,
  RubikBubbles_400Regular,
  TitanOne_400Regular,
  Ultra_400Regular,
};

type BannerFontEntry = { regular: string; bold: string };

/**
 * Panel family name to the loaded face.
 *
 * The panel stores a display name ("Baloo Thambi 2"); React Native only knows
 * the key it was loaded under ("BalooThambi2_400Regular"). Without this
 * translation every banner font silently falls back to the system face, which
 * looks like nothing happening rather than like a bug.
 *
 * Display faces ship one weight only, so bold points back at regular - asking
 * for a weight that was never loaded is what produces the fallback.
 */
const BANNER_FONTS: Record<string, BannerFontEntry> = {
  // English - display
  Bungee: { regular: 'Bungee_400Regular', bold: 'Bungee_400Regular' },
  'Titan One': { regular: 'TitanOne_400Regular', bold: 'TitanOne_400Regular' },
  Fredoka: { regular: 'Fredoka_400Regular', bold: 'Fredoka_700Bold' },
  'Rubik Bubbles': { regular: 'RubikBubbles_400Regular', bold: 'RubikBubbles_400Regular' },
  'Bowlby One SC': { regular: 'BowlbyOneSC_400Regular', bold: 'BowlbyOneSC_400Regular' },
  'Alfa Slab One': { regular: 'AlfaSlabOne_400Regular', bold: 'AlfaSlabOne_400Regular' },
  Righteous: { regular: 'Righteous_400Regular', bold: 'Righteous_400Regular' },
  Ultra: { regular: 'Ultra_400Regular', bold: 'Ultra_400Regular' },
  'Passion One': { regular: 'PassionOne_400Regular', bold: 'PassionOne_700Bold' },
  Chewy: { regular: 'Chewy_400Regular', bold: 'Chewy_400Regular' },
  // English - script
  Lobster: { regular: 'Lobster_400Regular', bold: 'Lobster_400Regular' },
  Pacifico: { regular: 'Pacifico_400Regular', bold: 'Pacifico_400Regular' },
  // English - body
  Poppins: { regular: 'Poppins_400Regular', bold: 'Poppins_700Bold' },
  Inter: { regular: 'Inter_400Regular', bold: 'Inter_700Bold' },
  Montserrat: { regular: 'Montserrat_400Regular', bold: 'Montserrat_700Bold' },
  'Playfair Display': { regular: 'PlayfairDisplay_400Regular', bold: 'PlayfairDisplay_700Bold' },

  // Tamil - display
  Oi: { regular: 'Oi_400Regular', bold: 'Oi_400Regular' },
  Coiny: { regular: 'Coiny_400Regular', bold: 'Coiny_400Regular' },
  'Baloo Thambi 2': { regular: 'BalooThambi2_400Regular', bold: 'BalooThambi2_700Bold' },
  Arima: { regular: 'Arima_400Regular', bold: 'Arima_700Bold' },
  // Tamil - script
  Kavivanar: { regular: 'Kavivanar_400Regular', bold: 'Kavivanar_400Regular' },
  // Tamil - body
  'Anek Tamil': { regular: 'AnekTamil_400Regular', bold: 'AnekTamil_700Bold' },
  Catamaran: { regular: 'Catamaran_400Regular', bold: 'Catamaran_700Bold' },
  'Mukta Malar': { regular: 'MuktaMalar_400Regular', bold: 'MuktaMalar_700Bold' },
  'Hind Madurai': { regular: 'HindMadurai_400Regular', bold: 'HindMadurai_700Bold' },
  'Noto Sans Tamil': { regular: 'NotoSansTamil_400Regular', bold: 'NotoSansTamil_700Bold' },
};

/**
 * Undefined for an unknown family, which leaves the app's own styling in
 * place. Returning the raw name instead would hand React Native a family it
 * never loaded and quietly drop the text to the system font.
 */
export const resolveBannerFont = (
  family: string | undefined | null,
  variant: 'regular' | 'bold',
): string | undefined => {
  const entry = BANNER_FONTS[String(family || '').trim()];
  return entry ? entry[variant] : undefined;
};
