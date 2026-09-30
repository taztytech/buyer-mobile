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
import { WebView } from 'react-native-webview';

interface ContentPageProps {
  title: string;
  url?: string;
  onBack?: () => void;
}

export const ContentPage: React.FC<ContentPageProps> = ({ title, url, onBack }) => {
  // JavaScript to hide only logo elements
  const hideLogoScript = `
    (function() {
      // Create and inject CSS to hide logos
      const style = document.createElement('style');
      style.innerHTML = \`
        /* Hide logo images */
        img[alt*="Tazty"],
        img[alt*="tazty"],
        img[alt*="TAZTY"],
        img[src*="logo"],
        img[src*="Logo"],
        img[src*="LOGO"],
        /* Hide logo links */
        a[href="/"] img,
        /* Hide header logo containers */
        header img,
        nav img,
        /* Hide specific logo classes/IDs */
        .logo,
        #logo,
        [class*="logo" i],
        [id*="logo" i],
        /* Hide any image in the header/nav area */
        header a img,
        nav a img
        {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          width: 0 !important;
        }
      \`;
      
      if (document.head) {
        document.head.appendChild(style);
      } else {
        document.addEventListener('DOMContentLoaded', function() {
          if (document.head) {
            document.head.appendChild(style);
          }
        });
      }
      
      // Function to hide logo elements
      function hideLogos() {
        const logoSelectors = [
          'img[alt*="Tazty" i]',
          'img[alt*="tazty" i]',
          'img[src*="logo" i]',
          '.logo',
          '#logo',
          'header img',
          'nav img',
          '[class*="logo" i]',
          '[id*="logo" i]',
          'a[href="/"] img'
        ];
        
        logoSelectors.forEach(function(selector) {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(function(el) {
              if (el && el.parentNode) {
                el.style.display = 'none';
                el.style.visibility = 'hidden';
                el.style.opacity = '0';
                el.style.height = '0';
                el.style.width = '0';
              }
            });
          } catch(e) {}
        });
      }
      
      // Hide logos immediately
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hideLogos);
      } else {
        hideLogos();
      }
      
      // Hide logos after delays (for dynamically loaded content)
      setTimeout(hideLogos, 500);
      setTimeout(hideLogos, 1000);
      setTimeout(hideLogos, 2000);
      
      // Use MutationObserver to hide logos that are added dynamically
      if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(function(mutations) {
          hideLogos();
        });
        
        if (document.body) {
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        } else {
          document.addEventListener('DOMContentLoaded', function() {
            if (document.body) {
              observer.observe(document.body, {
                childList: true,
                subtree: true
              });
            }
          });
        }
      }
    })();
    true;
  `;

  return (
    <View style={styles.outerContainer}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      </SafeAreaView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#001E1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <SafeAreaView style={styles.container} edges={['bottom']}>
        {url ? (
          <WebView
            source={{ uri: url }}
            style={styles.webView}
            startInLoadingState
            injectedJavaScript={hideLogoScript}
            injectedJavaScriptBeforeContentLoaded={hideLogoScript}
          />
        ) : (
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
        )}
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
  webView: {
    flex: 1,
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
    flex: 1,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    lineHeight: 27,
    textAlign: 'center',
    color: '#FFFFFF',
    opacity: 0.85,
  },
  headerPlaceholder: {
    width: 40,
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
