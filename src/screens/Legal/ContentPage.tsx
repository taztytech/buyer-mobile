import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

interface ContentPageProps {
  title: string;
  onBack?: () => void;
}

export const ContentPage: React.FC<ContentPageProps> = ({ title, onBack }) => {
  return (
    <View style={styles.outerContainer}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      </SafeAreaView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={24} color="#00B14F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentSection}>
            <Text style={styles.sectionTitle}>Introduction</Text>
            <Text style={styles.paragraph}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation ullamco laboris
              nisi ut aliquip ex ea commodo consequat.
            </Text>
          </View>

          <View style={styles.contentSection}>
            <Text style={styles.sectionTitle}>Terms of Service</Text>
            <Text style={styles.paragraph}>
              Duis aute irure dolor in reprehenderit in voluptate velit esse
              cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat
              cupidatat non proident, sunt in culpa qui officia deserunt mollit
              anim id est laborum.
            </Text>
            <Text style={styles.paragraph}>
              Sed ut perspiciatis unde omnis iste natus error sit voluptatem
              accusantium doloremque laudantium, totam rem aperiam, eaque ipsa
              quae ab illo inventore veritatis et quasi architecto beatae vitae
              dicta sunt explicabo.
            </Text>
          </View>

          <View style={styles.contentSection}>
            <Text style={styles.sectionTitle}>User Responsibilities</Text>
            <Text style={styles.paragraph}>
              Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit
              aut fugit, sed quia consequuntur magni dolores eos qui ratione
              voluptatem sequi nesciunt.
            </Text>
            <Text style={styles.bulletPoint}>
              • You must provide accurate information
            </Text>
            <Text style={styles.bulletPoint}>
              • You are responsible for maintaining account security
            </Text>
            <Text style={styles.bulletPoint}>
              • You must comply with all applicable laws
            </Text>
            <Text style={styles.bulletPoint}>
              • You must not misuse our services
            </Text>
          </View>

          <View style={styles.contentSection}>
            <Text style={styles.sectionTitle}>Privacy & Data</Text>
            <Text style={styles.paragraph}>
              At vero eos et accusamus et iusto odio dignissimos ducimus qui
              blanditiis praesentium voluptatum deleniti atque corrupti quos
              dolores et quas molestias excepturi sint occaecati cupiditate non
              provident.
            </Text>
            <Text style={styles.paragraph}>
              Similique sunt in culpa qui officia deserunt mollitia animi, id
              est laborum et dolorum fuga. Et harum quidem rerum facilis est et
              expedita distinctio.
            </Text>
          </View>

          <View style={styles.contentSection}>
            <Text style={styles.sectionTitle}>Updates & Modifications</Text>
            <Text style={styles.paragraph}>
              Nam libero tempore, cum soluta nobis est eligendi optio cumque
              nihil impedit quo minus id quod maxime placeat facere possimus,
              omnis voluptas assumenda est, omnis dolor repellendus.
            </Text>
          </View>

          <View style={styles.contentSection}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <Text style={styles.paragraph}>
              If you have any questions about these terms, please contact us at
              support@tazty.com or call us at +91 1234567890.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#00B14F',
  },
  safeAreaTop: {
    backgroundColor: '#00B14F',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#00B14F',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 76,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    lineHeight: 27,
    textAlign: 'center',
    color: '#FFFFFF',
    opacity: 0.85,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  contentSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
    opacity: 0.85,
    marginBottom: 12,
  },
  paragraph: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#000000',
    opacity: 0.7,
    marginBottom: 12,
    textAlign: 'justify',
  },
  bulletPoint: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#000000',
    opacity: 0.7,
    marginBottom: 6,
    paddingLeft: 8,
  },
});
